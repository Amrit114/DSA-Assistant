<div align="center">

# 📚 DSA Assistant

### *Textbook-grounded AI tutor for Data Structures & Algorithms*

[![Python](https://img.shields.io/badge/Python-3.13-3572A5?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-3.x-000000?style=flat-square&logo=flask&logoColor=white)](https://flask.palletsprojects.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-336791?style=flat-square&logo=postgresql&logoColor=white)](https://github.com/pgvector/pgvector)
[![Groq](https://img.shields.io/badge/LLM-Groq-f55036?style=flat-square)](https://groq.com)
[![ONNX Runtime](https://img.shields.io/badge/Embeddings-ONNX%20Runtime-005CED?style=flat-square)](https://onnxruntime.ai)

**Ask any Data Structures & Algorithms question and get a clear, step-by-step answer drawn from your own indexed textbooks, with the sources it used.**

[Features](#-features) · [Architecture](#%EF%B8%8F-architecture) · [Quick Start](#-quick-start) · [Deployment](#-deployment-render) · [API](#-api-reference) · [Configuration](#-configuration-reference)

</div>

---

## ✨ Features

| Feature | Description |
|---|---|
| 🤖 **RAG answers** | pgvector similarity search over your PDFs + a Groq-hosted LLM. Answers use only the retrieved passages and end with a **Sources** list. |
| 🧭 **Structured, step-by-step answers** | Direct answer first, then key ideas, numbered steps, examples, code, complexity tables and takeaways, only where the textbooks support them. |
| 📖 **Bring your own textbooks** | Upload a PDF from the chat (or drop files in `data/pdf/`) and it is chunked, embedded and indexed. Unchanged files are skipped. |
| ⚡ **Streaming answer animation** | Answers type out live; list items, table rows and code lines appear in sequence. Click to show everything at once. |
| 🔄 **Background chats** | Ask a question, switch to another chat, and it keeps running. You get an **Answer ready → Open** notification when it finishes. |
| 💬 **Chat history** | Saved per user; search (Ctrl K), rename, delete, grouped by date. |
| 🎨 **5 themes** | Daylight, Midnight, Aurora, Sunset and Ocean, plus an animated graph background with BFS-traversal effects and a reading animation while the AI searches. |
| 🧑‍💻 **Readable code** | Syntax colours, line numbers, language labels and one-click copy. |
| 🔐 **Accounts** | Sign up / sign in, salted password hashing, email OTP password reset with rate limits. |
| 📧 **Emails that work on Render** | Welcome + OTP emails via Brevo's HTTPS API (Render's free plan blocks SMTP), with Gmail SMTP as the local fallback. |
| 📱 **Responsive** | Collapsible icon-rail sidebar on desktop, slide-out drawer on mobile. |

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ Browser — vanilla HTML/CSS/JS                                 │
│ landing · login · signup · chat (static/*.js, static/*.css)  │
└──────────────────────────────┬───────────────────────────────┘
                               │ JSON over HTTP (session cookie)
┌──────────────────────────────▼───────────────────────────────┐
│ Flask app (app.py) — blueprints in routes/                    │
│ auth_routes · chat (/api/ask) · ingest · sessions · ui        │
└───────────────┬───────────────────────────────┬──────────────┘
                │                               │
     ┌──────────▼──────────┐          ┌─────────▼──────────┐
     │ RAG pipeline (rag/) │          │ PDF ingestion      │
     │ 1. spell-correct    │          │ load → split →     │
     │ 2. similarity search│          │ embed → INSERT     │
     │ 3. LLM answer       │          └─────────┬──────────┘
     └────┬───────────┬────┘                    │
          │           │                         │
┌─────────▼──────┐ ┌──▼──────────────┐ ┌────────▼───────────────┐
│ Groq API       │ │ ONNX Runtime    │ │ PostgreSQL + pgvector  │
│ (LangChain-    │ │ all-MiniLM-L6-v2│ │ documents · users ·    │
│  Groq)         │ │ 384-dim vectors │ │ sessions · messages ·  │
└────────────────┘ └─────────────────┘ │ reset_tokens           │
                                       └────────────────────────┘
```

### How a question is answered (`/api/ask`)

1. **Spell-correct** the query for search (DSA terms like *bfs*, *heapify*, *memoization* are protected). The original question is what the LLM sees.
2. **Embed** it with `all-MiniLM-L6-v2` on ONNX Runtime (no PyTorch, about 240 MB of RAM).
3. **Search** the top 7 chunks by L2 distance in pgvector and keep those within **0.95** (see `db/retriever.py`). If nothing is close enough, the app replies *"I could not find information about this in the indexed textbooks."*
4. **Prompt** the LLM (`rag/prompt.py`) with the labelled passages; it must answer only from them and list its sources.
5. **Save** the question and answer to the chat session and return `{question, answer, session_id}`.

### How PDFs are indexed (`/api/ingest`, `/api/upload-pdf`)

PyMuPDF loads each page → 500-character chunks with 100 overlap → each chunk is embedded → stored with `source_file` and an MD5 `file_hash`, so files already indexed are skipped next time.

---

## 📁 Project Structure

```
DSA-Assistant/
├── app.py                  # Flask app — config, blueprints, JSON error handlers
├── auth.py                 # login_required, current user, json_body() helper
├── config.py               # Environment config (DB, Groq, PDF folder)
├── database.py             # Creates users / sessions / messages / reset_tokens on startup
├── mailer.py               # Welcome + OTP emails (Brevo HTTPS API, Gmail SMTP fallback)
├── main.py                 # Unused placeholder
│
├── routes/                 # Flask blueprints
│   ├── auth_routes.py      # /signup /login /logout /api/me + password-reset API
│   ├── chat.py             # /api/ask — core RAG endpoint
│   ├── ingest.py           # /api/ingest, /api/upload-pdf
│   ├── sessions.py         # /api/sessions — list / load / rename / delete
│   └── ui.py               # / and /chat pages
│
├── rag/
│   ├── rag_pipeline.py     # spell-correct → search → LLM
│   ├── llm_runner.py       # Calls the LLM, keeps clean refusals
│   ├── prompt.py           # Answer prompt (grounding, structure, formatting rules)
│   └── spell_correct.py    # Query spell correction with a DSA vocabulary
│
├── llm/groq_llm.py         # Groq chat model (LangChain-Groq)
├── embeddings/embedder.py  # all-MiniLM-L6-v2 on ONNX Runtime
│
├── loaders/                # PDF loading, hashing, de-duplication, chunking
├── db/                     # connection, schema, ingester, retriever, user_store, tracker
│
├── templates/              # landing.html · login.html · signup.html · index.html (chat)
├── static/
│   ├── base.css            # Design system: 5 themes, components, animated background styles
│   ├── style.css           # Chat app
│   ├── auth.css            # Sign in / sign up / reset
│   ├── landing.css         # Landing page
│   ├── theme.js            # Theme picker + persistence
│   ├── bg.js               # Animated graph background, glyphs, cursor glow
│   └── script.js           # Chat logic, markdown renderer, streaming, background chats
│
├── data/pdf/               # Textbook PDFs to index (committed)
├── Procfile                # gunicorn start command
├── requirements.txt        # Python dependencies (used by pip / Render)
└── .env                    # Your secrets (git-ignored, never commit it)
```

---

## ⚡ Quick Start

### Prerequisites

- Python 3.11+ (3.13 recommended; see `.python-version`)
- PostgreSQL with the [`pgvector`](https://github.com/pgvector/pgvector) extension (for example a free [Neon](https://neon.tech) database)
- A [Groq API key](https://console.groq.com)

### 1. Clone and install

```bash
git clone https://github.com/Amrit114/DSA-Assistant.git
cd DSA-Assistant
python -m venv .venv
```

```bash
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate
```

```bash
pip install -r requirements.txt
```

### 2. Create `.env` in the project root

```env
# Database (connections use sslmode=require)
DATABASE_URL=postgresql://user:password@host/dbname

# Groq LLM — set the model explicitly (the code's default, llama3-8b-8192, has been retired by Groq)
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
GROQ_MODEL=openai/gpt-oss-120b

# App
SECRET_KEY=generate-one-with-the-command-below
PDF_DIR=data/pdf

# Email — production (Render's free plan blocks SMTP)
BREVO_API_KEY=xkeysib-xxxxxxxx
MAIL_FROM=you@example.com          # must be a verified sender in Brevo
APP_URL=http://localhost:5000      # your public URL in production

# Email — local fallback (used when BREVO_API_KEY is not set)
SMTP_EMAIL=you@gmail.com
SMTP_PASSWORD=your-gmail-app-password
```

Generate a `SECRET_KEY` (the app refuses to start without one):

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

### 3. Prepare the database (once)

The app creates the user and chat tables itself. Create the extension and the vector table yourself:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
    id          SERIAL PRIMARY KEY,
    content     TEXT,
    embedding   vector(384),
    source_file TEXT,
    file_hash   TEXT
);
```

### 4. Run

```bash
python app.py
```

Open **http://localhost:5000**, create an account, then click **Index PDFs** in the sidebar to index everything in `data/pdf/`, or use **Upload textbook** to add a single PDF. The first question downloads the embedding model (~90 MB) into `/tmp/hf_cache`.

> Flask caches templates in this mode. Restart the server after editing files in `templates/`.

---

## 🚀 Deployment (Render)

1. **New → Web Service**, connect the GitHub repo.
2. **Build command:** `pip install -r requirements.txt`
3. **Start command:** `gunicorn app:app --bind 0.0.0.0:$PORT --timeout 300 --workers 1` (same as `Procfile`)
4. **Environment:** add every variable from the `.env` above. `SECRET_KEY`, `DATABASE_URL`, `GROQ_API_KEY` and `GROQ_MODEL` are required; set `APP_URL` to your Render URL.
5. **Email:** Render's free plan blocks outbound SMTP (ports 25/465/587), so set `BREVO_API_KEY` and `MAIL_FROM`:
   create a free account at [brevo.com](https://www.brevo.com) → verify your sender address → **SMTP & API → API keys**.
   Logs show `[mailer] … sent via Brevo` or the exact error.

**Memory:** with ONNX Runtime the app uses about 240 MB after the first answer, which fits Render's 512 MB free instance.
**Storage:** Render's disk is temporary. Uploaded PDFs are lost on restart, but their chunks stay in PostgreSQL, so answers keep working.

---

## 🔌 API Reference

All `/api/*` routes except signup, login and password reset need the session cookie set by `/api/login`.
Errors are returned as JSON: `{"error": "…"}`.

### Authentication

| Method | Endpoint | Body | Description |
|---|---|---|---|
| `POST` | `/api/signup` | `username, email, password` | Create an account and sign in |
| `POST` | `/api/login` | `email, password` | Sign in |
| `GET`  | `/api/me` | — | Current user (401 if signed out or the account no longer exists) |
| `GET`  | `/logout` | — | Sign out |
| `POST` | `/api/forgot-password` | `email` | Email a 6-digit code (max 3 per 10 minutes) |
| `POST` | `/api/verify-otp` | `email, otp` | Check a code (5 wrong tries burn it) |
| `POST` | `/api/reset-password` | `email, otp, new_password` | Set a new password |

### Chat

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/ask` | Ask a question. Omit `session_id` (or send `null`) to start a new chat. |

```json
{ "question": "Explain binary search trees", "session_id": "optional-existing-session-uuid" }
```

```json
{ "question": "Explain binary search trees", "answer": "## Binary Search Tree\n…", "session_id": "550e8400-…" }
```

Returns `404` if `session_id` belongs to another user.

### Sessions

| Method | Endpoint | Description |
|---|---|---|
| `GET`    | `/api/sessions` | List your chats |
| `GET`    | `/api/sessions/<id>` | A chat with its messages |
| `PATCH`  | `/api/sessions/<id>/title` | Rename (`{"title": "…"}`) |
| `DELETE` | `/api/sessions/<id>` | Delete one chat |
| `DELETE` | `/api/sessions` | Delete all your chats |

### Indexing

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/ingest` | Index all PDFs in `PDF_DIR` (already-indexed files are skipped) |
| `POST` | `/api/upload-pdf` | Upload one PDF (`multipart/form-data`, field `file`) and index it |

---

## 🗄️ Database Schema

```sql
CREATE TABLE users (
    id         SERIAL PRIMARY KEY,
    username   TEXT UNIQUE NOT NULL,
    email      TEXT UNIQUE NOT NULL,
    password   TEXT NOT NULL,          -- werkzeug salted hash (old SHA-256 hashes upgrade on login)
    created_at TEXT
);

CREATE TABLE sessions (
    id         TEXT PRIMARY KEY,       -- UUID
    user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title      TEXT,                   -- first question
    created_at TEXT,
    updated_at TEXT
);

CREATE TABLE messages (
    id         SERIAL PRIMARY KEY,
    session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
    role       TEXT,                   -- 'user' or 'assistant'
    content    TEXT,
    created_at TEXT
);

CREATE TABLE reset_tokens (
    id         SERIAL PRIMARY KEY,
    email      TEXT,
    otp        TEXT,
    expires_at TEXT,
    used       INTEGER DEFAULT 0,
    attempts   INTEGER DEFAULT 0       -- wrong guesses; the code is burned after 5
);

CREATE TABLE documents (               -- create manually (see Quick Start)
    id          SERIAL PRIMARY KEY,
    content     TEXT,
    embedding   vector(384),           -- all-MiniLM-L6-v2
    source_file TEXT,
    file_hash   TEXT                   -- MD5, for skipping already-indexed files
);
```

---

## 🔐 Security

- Passwords are stored as salted werkzeug hashes; accounts with old SHA-256 hashes are upgraded on their next login.
- `SECRET_KEY` is required; the session cookie is `HttpOnly` and `SameSite=Lax`.
- Reset codes are generated with `secrets`, expire after 10 minutes, allow 5 wrong guesses and are limited to 3 per email per 10 minutes.
- Answer text is HTML-escaped before markdown rendering, so content from PDFs or the model can't inject scripts.
- Users' names in emails are escaped; the welcome email never contains the password.
- Never commit `.env`. It is git-ignored.

---

## 🔧 Configuration Reference

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | — | PostgreSQL URL (or use `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`) |
| `GROQ_API_KEY` | — | **Required.** Groq API key |
| `GROQ_MODEL` | `llama3-8b-8192` | Groq model ID. **Set this**; the default has been retired by Groq. |
| `EMBEDDING_MODEL` | `all-MiniLM-L6-v2` | Must have an ONNX export on Hugging Face and match the 384-dim `documents` table |
| `PDF_DIR` | `pdfs` | Folder of PDFs to index; set it to `data/pdf` for the bundled books |
| `SECRET_KEY` | — | **Required.** Flask session secret |
| `BREVO_API_KEY` | — | Send email over Brevo's HTTPS API (needed on Render's free plan) |
| `MAIL_FROM` | `SMTP_EMAIL` | Sender address; must be verified in Brevo |
| `APP_URL` | — | Public URL, used for the sign-in link in the welcome email |
| `SMTP_EMAIL` | — | Gmail address for the local SMTP fallback |
| `SMTP_PASSWORD` | — | Gmail [app password](https://myaccount.google.com/apppasswords) for the local fallback |
| `PORT` | `5000` | Port for `python app.py` (Render sets it automatically) |

---

## 📋 Roadmap

- [x] Syntax-highlighted, line-numbered code blocks
- [x] Streaming answer animation and background chats
- [x] Multiple themes
- [ ] True server-side streaming (SSE) from the LLM
- [ ] Per-user PDF collections
- [ ] Export a conversation as PDF / Markdown
- [ ] Rate limiting per user
- [ ] Automated tests and a Docker Compose setup with PostgreSQL

---

## 🤝 Contributing

1. Fork the repository
2. Create a branch: `git checkout -b feature/my-change`
3. Commit: `git commit -m "Describe the change"`
4. Push: `git push origin feature/my-change`
5. Open a pull request

---

<div align="center">

Built by **Amrit** · Powered by [Groq](https://groq.com), [LangChain](https://langchain.com), [pgvector](https://github.com/pgvector/pgvector) and [ONNX Runtime](https://onnxruntime.ai)

</div>
