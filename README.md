# Document RAG Assistant

A self-hosted AI assistant that indexes a local document collection and answers questions through an HTTP API, a web interface, an admin dashboard, and a Telegram bot.

The service extracts text and metadata from files in `docs/`, stores documents and chunks in PostgreSQL, retrieves relevant passages with full-text search, and optionally uses an OpenAI-compatible language model to generate grounded answers.

## Features

- indexes PDF, DOCX, DOTX, XLSX, XLS, and CSV files
- stores document metadata and searchable chunks in PostgreSQL
- skips unchanged files by comparing checksums
- exposes a question-answering API at `POST /ask`
- includes a browser-based document chat at `/`
- includes a protected document management dashboard at `/admin`
- offers the same question-answering workflow through Telegram
- provides source passages with every grounded answer
- falls back to retrieved passages when no language model is configured
- runs as a single Docker Compose stack

The application is domain-agnostic: replace the contents of `docs/` with the document collection you want to search.

## Architecture

The project uses a single Python codebase for all interfaces:

- `postgres`: document metadata and text chunks
- `api`: FastAPI endpoints, the user interface, and the admin dashboard
- `bot`: Telegram interface using the same retrieval and answer pipeline

The static frontend is served directly by FastAPI from `app/static/`. The Telegram bot imports the shared application modules instead of calling the HTTP API.

## Quick start with Docker

1. Create the environment file:

   ```bash
   copy .env.example .env
   ```

   On macOS or Linux, use `cp .env.example .env`.

2. Configure the values you need. The most common ones are:

   - `LLM_API_KEY`
   - `TELEGRAM_BOT_TOKEN`
   - `ADMIN_PASSWORD`
   - `ADMIN_SESSION_SECRET`

3. Build and start the stack:

   ```bash
   docker compose up --build
   ```

The application will expose:

- document chat: <http://localhost:8000/>
- admin dashboard: <http://localhost:8000/admin>
- API: <http://localhost:8000>

The Telegram bot also starts when `TELEGRAM_BOT_TOKEN` is configured.

## Local development

1. Create `.env` from `.env.example`.
2. Start PostgreSQL:

   ```bash
   docker compose up -d postgres
   ```

3. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

4. Start the API:

   ```bash
   uvicorn app.main:app --reload
   ```

5. Optionally start the Telegram bot in a second terminal:

   ```bash
   python -m bot.main
   ```

## Configuration

### Core settings

- `DATABASE_URL`: PostgreSQL connection string
- `DATA_DIR`: directory containing documents; defaults to `./docs`
- `LOG_LEVEL`: application log level
- `AUTO_INDEX_ON_STARTUP`: indexes `DATA_DIR` when the API or bot starts

Docker Compose overrides `DATABASE_URL` and `DATA_DIR` with container-specific values.

### Language model

- `LLM_BASE_URL`: base URL for an OpenAI-compatible API
- `LLM_API_KEY`: API key
- `LLM_MODEL`: model identifier

Example:

```env
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=...
LLM_MODEL=gpt-4o-mini
```

Without an LLM, the application remains usable and returns the most relevant retrieved passages.

### Telegram

- `TELEGRAM_BOT_TOKEN`: bot token
- `TELEGRAM_ALLOWED_CHAT_IDS`: optional comma-separated allowlist of chat IDs

Example:

```env
TELEGRAM_ALLOWED_CHAT_IDS=123456789,987654321
```

### Admin dashboard

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`

Document-management endpoints remain unavailable until admin authentication is configured.

## Index documents

Documents can be indexed automatically at startup, through the admin dashboard, through the API, or with the CLI.

CLI:

```bash
python -m scripts.index --path ./docs
```

API:

```bash
curl -X POST http://localhost:8000/index \
  -H "Content-Type: application/json" \
  -d '{"path":"./docs"}'
```

The indexer calculates a checksum, skips unchanged files, generates a short description, splits extracted text into chunks, and stores the result for PostgreSQL full-text search.

## API

Main endpoints:

- `GET /health`
- `POST /ask`
- `POST /index`
- `GET /api/docs`
- `GET /api/docs/{doc_id}/file`
- `GET /api/stats`
- `GET /api/history`

Health check:

```bash
curl http://localhost:8000/health
```

Ask a question:

```bash
curl -X POST http://localhost:8000/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"What is the document retention policy?","top_k":5}'
```

Example response:

```json
{
  "answer": "The indexed policy states that ...",
  "sources": [
    {
      "title": "Document Retention Policy",
      "file_path": "/app/docs/retention-policy.pdf",
      "chunk_index": 0,
      "snippet": "..."
    }
  ]
}
```

## Project structure

- `app/main.py`: FastAPI application and HTTP endpoints
- `app/indexer.py`: file extraction and indexing
- `app/search.py`: full-text and fallback retrieval
- `app/rag.py`: retrieval-augmented answer pipeline
- `app/llm.py`: OpenAI-compatible LLM client
- `app/models.py`: database models
- `app/admin_auth.py`: admin authentication
- `app/static/`: user and admin interfaces
- `bot/main.py`: Telegram bot
- `scripts/index.py`: indexing CLI
- `docker-compose.yml`: complete local stack

## Current limitations

- request history is stored in process memory and is cleared on restart
- retrieval uses PostgreSQL full-text search rather than embeddings
- answer quality depends on successful text extraction from source files
- the API and bot share the database but not in-memory request history
- the configured LLM is an external network dependency
