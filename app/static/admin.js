const statsEl = document.getElementById("admin-stats");
const sessionBadgeEl = document.getElementById("session-badge");
const sessionStatusEl = document.getElementById("session-status");
const logoutButtonEl = document.getElementById("logout-button");
const loginPanelEl = document.getElementById("login-panel");
const workspacePanelEl = document.getElementById("workspace-panel");
const uploadPanelEl = document.getElementById("upload-panel");
const reindexPanelEl = document.getElementById("reindex-panel");
const loginStatusEl = document.getElementById("login-status");
const uploadStatusEl = document.getElementById("upload-status");
const reindexStatusEl = document.getElementById("admin-reindex-status");
const docsEl = document.getElementById("admin-docs");

const modalEl = document.getElementById("doc-modal");
const modalCloseEl = document.getElementById("doc-modal-close");
const modalTypeEl = document.getElementById("doc-modal-type");
const modalTitleEl = document.getElementById("doc-modal-title");
const modalPathEl = document.getElementById("doc-modal-path");
const modalPreviewEl = document.getElementById("doc-modal-preview");
const modalOpenEl = document.getElementById("doc-modal-open");
const modalDownloadEl = document.getElementById("doc-modal-download");
const modalDeleteEl = document.getElementById("doc-modal-delete");
const modalFormEl = document.getElementById("doc-modal-form");
const modalStatusEl = document.getElementById("doc-modal-status");
const modalTitleInputEl = document.getElementById("doc-modal-title-input");
const modalDescriptionInputEl = document.getElementById("doc-modal-description-input");

const docsState = new Map();
let activeDocId = null;

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

function previewText(value, limit = 180) {
  const text = String(value || "").trim();
  if (!text) {
    return "No description is available yet.";
  }
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit).trimEnd()}...`;
}

function renderStats({ enabled, authenticated, username }) {
  statsEl.innerHTML = `
    <div class="stat-card">
      <span>Admin auth</span>
      <strong>${enabled ? "ON" : "OFF"}</strong>
    </div>
    <div class="stat-card">
      <span>Session</span>
      <strong>${authenticated ? "OK" : "LOCK"}</strong>
    </div>
    <div class="stat-card">
      <span>User</span>
      <strong>${escapeHtml(username || "guest")}</strong>
    </div>
    <div class="stat-card">
      <span>Dashboard</span>
      <strong>CRUD</strong>
    </div>
  `;
}

function setSessionState(session) {
  renderStats(session);
  if (!session.enabled) {
    logoutButtonEl.classList.add("hidden");
    sessionBadgeEl.textContent = "OFF";
    sessionStatusEl.textContent =
      "Admin access is not configured. Set ADMIN_USERNAME, ADMIN_PASSWORD, and ADMIN_SESSION_SECRET.";
    loginStatusEl.textContent = "The server is not configured for admin sign-in.";
    loginPanelEl.classList.remove("hidden");
    workspacePanelEl.classList.add("hidden");
    uploadPanelEl.classList.add("hidden");
    reindexPanelEl.classList.add("hidden");
    closeDocModal();
    return;
  }

  if (session.authenticated) {
    logoutButtonEl.classList.remove("hidden");
    sessionBadgeEl.textContent = "Access";
    sessionStatusEl.textContent = `Signed in as ${session.username}. CRUD endpoints are unlocked.`;
    loginPanelEl.classList.add("hidden");
    workspacePanelEl.classList.remove("hidden");
    uploadPanelEl.classList.remove("hidden");
    reindexPanelEl.classList.remove("hidden");
    return;
  }

  logoutButtonEl.classList.add("hidden");
  sessionBadgeEl.textContent = "Sign in";
  sessionStatusEl.textContent = "Administrator authentication is required.";
  loginPanelEl.classList.remove("hidden");
  workspacePanelEl.classList.add("hidden");
  uploadPanelEl.classList.add("hidden");
  reindexPanelEl.classList.add("hidden");
  closeDocModal();
}

async function getJson(url, options = {}) {
  const response = await fetch(url, options);
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : null;
  if (!response.ok) {
    const detail = payload?.detail || "Request failed";
    throw new Error(detail);
  }
  return payload;
}

async function loadSession() {
  const session = await getJson("/admin/session");
  setSessionState(session);
  return session;
}

function renderDocs(items) {
  docsState.clear();
  items.forEach((item) => docsState.set(item.id, item));

  if (!items.length) {
    renderEmpty(docsEl, "No documents have been indexed yet.");
    return;
  }

  docsEl.innerHTML = items
    .map(
      (item) => `
        <article class="admin-doc-card" data-doc-id="${item.id}">
          <div class="admin-doc-kicker">${escapeHtml(item.file_type)}</div>
          <h3>${escapeHtml(item.title)}</h3>
          <p class="meta">${escapeHtml(previewText(item.description))}</p>
          <div class="admin-doc-summary-footer">
            <span class="tiny">Updated: ${new Date(item.updated_at).toLocaleString("en-US")}</span>
            <button class="secondary-button" type="button" data-action="open-modal">Details</button>
          </div>
        </article>
      `,
    )
    .join("");
}

function openDocModal(docId) {
  const doc = docsState.get(docId);
  if (!doc) {
    return;
  }

  activeDocId = docId;
  modalTypeEl.textContent = doc.file_type;
  modalTitleEl.textContent = doc.title;
  modalPathEl.textContent = doc.file_path;
  modalPreviewEl.textContent = doc.description || "No description is available yet.";
  modalTitleInputEl.value = doc.title || "";
  modalDescriptionInputEl.value = doc.description || "";
  modalOpenEl.href = `/api/docs/${encodeURIComponent(doc.id)}/file`;
  modalDownloadEl.href = `/api/docs/${encodeURIComponent(doc.id)}/file?download=true`;
  modalOpenEl.classList.toggle("hidden", !doc.can_preview);
  modalStatusEl.textContent = `Last updated: ${new Date(doc.updated_at).toLocaleString("en-US")}`;
  modalEl.classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeDocModal() {
  activeDocId = null;
  modalEl.classList.add("hidden");
  document.body.classList.remove("modal-open");
  modalFormEl.reset();
  modalStatusEl.textContent = "Select a document to edit.";
}

async function loadDocs() {
  try {
    const items = await getJson("/admin/api/docs");
    renderDocs(items);
  } catch (error) {
    if (error.message.includes("authentication")) {
      await loadSession();
      renderEmpty(docsEl, "The document list is available after sign-in.");
      return;
    }
    renderEmpty(docsEl, error.message);
  }
}

async function handleLogin(event) {
  event.preventDefault();
  loginStatusEl.textContent = "Checking credentials...";

  const form = new FormData(event.currentTarget);
  try {
    await getJson("/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: String(form.get("username") || "").trim(),
        password: String(form.get("password") || ""),
      }),
    });
    loginStatusEl.textContent = "Signed in.";
    await loadSession();
    await loadDocs();
  } catch (error) {
    loginStatusEl.textContent = error.message;
  }
}

async function handleLogout() {
  await getJson("/admin/logout", { method: "POST" });
  await loadSession();
  renderEmpty(docsEl, "The document list is available after sign-in.");
}

async function handleUpload(event) {
  event.preventDefault();
  const formEl = event.currentTarget;
  uploadStatusEl.textContent = "Uploading and indexing the document...";
  const form = new FormData(formEl);

  try {
    await getJson("/admin/api/docs", {
      method: "POST",
      body: form,
    });
    formEl.reset();
    uploadStatusEl.textContent = "Document uploaded.";
    await loadDocs();
  } catch (error) {
    uploadStatusEl.textContent = error.message;
  }
}

async function handleReindex() {
  reindexStatusEl.textContent = "Indexing started...";
  try {
    const payload = await getJson("/admin/api/reindex", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    reindexStatusEl.textContent =
      `New: ${payload.indexed_docs}, updated: ${payload.updated_docs}, skipped: ${payload.skipped_docs}`;
    await loadDocs();
  } catch (error) {
    reindexStatusEl.textContent = error.message;
  }
}

function handleDocAction(event) {
  const button = event.target.closest("[data-action]");
  const card = event.target.closest("[data-doc-id]");
  if (!button || !card) {
    return;
  }

  if (button.dataset.action === "open-modal") {
    openDocModal(card.dataset.docId);
  }
}

async function handleModalSubmit(event) {
  event.preventDefault();
  if (!activeDocId) {
    return;
  }

  modalStatusEl.textContent = "Saving changes...";
  try {
    const updated = await getJson(`/admin/api/docs/${activeDocId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: modalTitleInputEl.value.trim(),
        description: modalDescriptionInputEl.value,
      }),
    });

    docsState.set(updated.id, updated);
    modalTitleEl.textContent = updated.title;
    modalPreviewEl.textContent = updated.description || "No description is available yet.";
    modalStatusEl.textContent = `Saved: ${new Date(updated.updated_at).toLocaleString("en-US")}`;
    renderDocs(Array.from(docsState.values()));
  } catch (error) {
    modalStatusEl.textContent = error.message;
  }
}

async function handleModalDelete() {
  if (!activeDocId) {
    return;
  }

  modalStatusEl.textContent = "Deleting document...";
  const response = await fetch(`/admin/api/docs/${activeDocId}`, { method: "DELETE" });
  if (!response.ok) {
    modalStatusEl.textContent = "Unable to delete the document.";
    return;
  }

  docsState.delete(activeDocId);
  renderDocs(Array.from(docsState.values()));
  closeDocModal();
}

function handleModalBackdrop(event) {
  if (event.target === modalEl) {
    closeDocModal();
  }
}

function handleEscape(event) {
  if (event.key === "Escape" && !modalEl.classList.contains("hidden")) {
    closeDocModal();
  }
}

document.getElementById("login-form").addEventListener("submit", handleLogin);
document.getElementById("logout-button").addEventListener("click", handleLogout);
document.getElementById("upload-form").addEventListener("submit", handleUpload);
document.getElementById("admin-reindex-button").addEventListener("click", handleReindex);
document.getElementById("refresh-docs-button").addEventListener("click", loadDocs);
docsEl.addEventListener("click", handleDocAction);
modalCloseEl.addEventListener("click", closeDocModal);
modalDeleteEl.addEventListener("click", handleModalDelete);
modalFormEl.addEventListener("submit", handleModalSubmit);
modalEl.addEventListener("click", handleModalBackdrop);
document.addEventListener("keydown", handleEscape);

renderEmpty(docsEl, "The document list is available after sign-in.");
loadSession().then((session) => {
  if (session.authenticated) {
    loadDocs();
  }
});
