const statsEl = document.getElementById("stats");
const docsEl = document.getElementById("docs");
const chatThreadEl = document.getElementById("chat-thread");
const answerStatusEl = document.getElementById("answer-status");
const docsModalEl = document.getElementById("docs-modal");
const docsModalCloseEl = document.getElementById("docs-modal-close");
const openDocsModalButtonEl = document.getElementById("open-docs-modal-button");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderEmpty(container, text) {
  container.innerHTML = `<div class="empty-state">${escapeHtml(text)}</div>`;
}

function scrollChatToBottom() {
  requestAnimationFrame(() => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  });
}

function dedupeSources(sources) {
  const seen = new Set();
  return (sources || []).filter((source) => {
    const key = source.doc_id || source.file_path || source.title;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function renderStats(stats) {
  statsEl.innerHTML = `
    <div class="stat-card">
      <span>Documents</span>
      <strong>${stats.docs_count}</strong>
    </div>
    <div class="stat-card">
      <span>Chunks</span>
      <strong>${stats.chunks_count}</strong>
    </div>
    <div class="stat-card">
      <span>Chat</span>
      <strong>ON</strong>
    </div>
    <div class="stat-card">
      <span>Status</span>
      <strong>OK</strong>
    </div>
  `;
}

function buildSourcesMarkup(sources) {
  const uniqueSources = dedupeSources(sources);
  if (!uniqueSources.length) {
    return `<div class="empty-state">No sources were found for this answer.</div>`;
  }

  return `
    <div class="message-sources">
      <p class="message-sources-title">Sources</p>
      <div class="sources-list">
        ${uniqueSources
          .map(
            (source) => `
              <article class="source-card">
                <h3>${escapeHtml(source.title)}</h3>
                <p>${escapeHtml(source.description || "")}</p>
                <p class="meta">${escapeHtml(source.file_path)}</p>
                <p>${escapeHtml(source.snippet)}</p>
                <div class="source-actions">
                  ${source.can_preview
                    ? `
                  <a
                    class="secondary-button link-button"
                    href="/api/docs/${encodeURIComponent(source.doc_id)}/file"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open document
                  </a>`
                    : ""}
                  <a
                    class="secondary-button link-button"
                    href="/api/docs/${encodeURIComponent(source.doc_id)}/file?download=true"
                  >
                    Download
                  </a>
                </div>
              </article>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function appendMessage({ role, text, sources = [], pending = false }) {
  const wrapper = document.createElement("article");
  wrapper.className = `message message-${role}`;

  const roleLabel = role === "user" ? "You" : "Assistant";
  wrapper.innerHTML = `
    <div class="message-role">${roleLabel}</div>
    <div class="message-card">
      <pre class="answer-output">${escapeHtml(text)}</pre>
      ${role === "assistant" && !pending ? buildSourcesMarkup(sources) : ""}
    </div>
  `;

  chatThreadEl.appendChild(wrapper);
  scrollChatToBottom();
  return wrapper;
}

function renderDocs(items) {
  if (!items.length) {
    renderEmpty(docsEl, "No documents have been indexed yet.");
    return;
  }

  docsEl.innerHTML = items
    .map(
      (item) => `
        <article class="source-card">
          <h3>${escapeHtml(item.title)}</h3>
          <p class="meta">${escapeHtml(item.file_type)} • ${escapeHtml(item.file_path)}</p>
          <p>${escapeHtml(item.description)}</p>
          <div class="source-actions">
            ${item.can_preview
              ? `
            <a
              class="secondary-button link-button"
              href="/api/docs/${encodeURIComponent(item.id)}/file"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open
            </a>`
              : ""}
            <a
              class="secondary-button link-button"
              href="/api/docs/${encodeURIComponent(item.id)}/file?download=true"
            >
              Download
            </a>
          </div>
        </article>
      `,
    )
    .join("");
}

async function loadStats() {
  const response = await fetch("/api/stats");
  const stats = await response.json();
  renderStats(stats);
}

async function loadDocs() {
  const response = await fetch("/api/docs");
  const items = await response.json();
  renderDocs(items);
}

function openDocsModal() {
  docsModalEl.classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeDocsModal() {
  docsModalEl.classList.add("hidden");
  document.body.classList.remove("modal-open");
}

function handleDocsModalBackdrop(event) {
  if (event.target === docsModalEl) {
    closeDocsModal();
  }
}

function handleEscape(event) {
  if (event.key === "Escape" && !docsModalEl.classList.contains("hidden")) {
    closeDocsModal();
  }
}

async function askQuestion(event) {
  event.preventDefault();
  const questionInput = document.getElementById("question");
  const question = questionInput.value.trim();
  const topK = Number(document.getElementById("top-k").value || 8);
  if (!question) {
    return;
  }

  appendMessage({ role: "user", text: question });
  const pendingMessage = appendMessage({
    role: "assistant",
    text: "Searching for relevant passages and preparing an answer...",
    pending: true,
  });

  answerStatusEl.textContent = "Searching";
  answerStatusEl.classList.add("pending");
  questionInput.value = "";

  const response = await fetch("/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, top_k: topK }),
  });
  const payload = await response.json();

  if (!response.ok) {
    pendingMessage.querySelector(".answer-output").textContent =
      payload.detail || "Unable to retrieve an answer.";
    answerStatusEl.textContent = "Error";
    answerStatusEl.classList.remove("pending");
    return;
  }

  pendingMessage.querySelector(".message-card").innerHTML = `
    <pre class="answer-output">${escapeHtml(payload.answer)}</pre>
    ${buildSourcesMarkup(payload.sources || [])}
  `;
  answerStatusEl.textContent = "Ready";
  answerStatusEl.classList.remove("pending");

  await loadStats();
}

document.getElementById("ask-form").addEventListener("submit", askQuestion);
openDocsModalButtonEl.addEventListener("click", openDocsModal);
docsModalCloseEl.addEventListener("click", closeDocsModal);
docsModalEl.addEventListener("click", handleDocsModalBackdrop);
document.addEventListener("keydown", handleEscape);

renderEmpty(docsEl, "Loading documents...");
loadStats();
loadDocs();
