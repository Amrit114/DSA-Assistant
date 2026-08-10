<div align="center">

# 📚 DSA Book Assistant

### *Retrieval-Augmented Generation Chat for Data Structures & Algorithms*

[![Python](https://img.shields.io/badge/Python-3.11-3572A5?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-3.x-000000?style=flat-square&logo=flask&logoColor=white)](https://flask.palletsprojects.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-336791?style=flat-square&logo=postgresql&logoColor=white)](https://postgresql.org)
[![Groq](https://img.shields.io/badge/LLM-Groq%20LLaMA3-f55036?style=flat-square)](https://groq.com)
[![LangChain](https://img.shields.io/badge/RAG-LangChain-1C3C3C?style=flat-square)](https://langchain.com)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

**Ask any question about Data Structures and Algorithms — get accurate answers directly from your indexed textbooks, powered by RAG + LLaMA3.**

[Features](#-features) · [Architecture](#-architecture) · [Quick Start](#-quick-start) · [API Reference](#-api-reference) · [Deployment](#-deployment)

</div>

---

## ✨ Features

| Feature | Description |
|---|---|
| 🤖 **RAG Pipeline** | Retrieval-Augmented Generation using pgvector similarity search + LLaMA3 |
| 📖 **PDF Textbook Indexing** | Upload any DSA textbook PDF and index it in one click |
| 💬 **Multi-Session Chat** | Persistent conversation history with named sessions |
| 🔐 **User Authentication** | Secure signup/login with session management |
| 📧 **OTP Password Reset** | Email-based one-time password recovery flow |
| 🎨 **Modern Dark UI** | Claude/ChatGPT-style interface with dark red premium theme |
| 🌓 **Light/Dark Mode** | Persisted theme preference via localStorage |
| 📊 **Code Block Rendering** | Line-numbered code blocks with language detection and copy button |
| 🔍 **Spell Correction** | Automatic query spell-check before search |
| 📱 **Responsive Design** | Collapsible sidebar, mobile-friendly layout |
| 🚀 **Production Ready** | Gunicorn + Heroku/Render deployment configuration |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Browser (Client)                  │
│  Landing · Login · Signup · Chat UI (Vanilla JS)    │
└───────────────────────┬─────────────────────────────┘
                        │ HTTP / REST API
┌───────────────────────▼─────────────────────────────┐
│               Flask Application (app.py)             │
│                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ auth_    │ │  chat.py │ │ingest.py │ │session │ │
│  │ routes   │ │  /api/ask│ │/api/ingest│ │  s.py  │ │
│  └──────────┘ └────┬─────┘ └────┬─────┘ └────────┘ │
└───────────────────┬┴────────────┴────────────────────┘
                    │
         ┌──────────▼──────────┐
         │    RAG Pipeline      │
         │  rag/rag_pipeline.py │
         │                      │
         │  1. Spell Correct    │
         │  2. Similarity Search│
         │  3. LLM Generation   │
         └──────┬───────┬───────┘
                │       │
    ┌───────────▼─┐ ┌───▼────────────────┐
    │  pgvector   │ │   Groq API          │
    │ (PostgreSQL)│ │   LLaMA3-8b-8192   │
    │             │ │   via LangChain     │
    │ embeddings  │ └────────────────────┘
    │ documents   │
    │ users       │
    │ sessions    │
    │ messages    │
    └─────────────┘
```

### RAG Flow

```
User Question
      │
      ▼
Spell Correction (pyspellchecker)
      │
      ▼
Generate Query Embedding (all-MiniLM-L6-v2)
      │
      ▼
Vector Similarity Search (pgvector cosine)
      │
      ▼
Retrieved Context Chunks (top-k passages)
      │
      ▼
LLM Prompt Construction (LangChain)
      │
      ▼
Groq LLaMA3 Inference
      │
      ▼
Formatted Answer (Markdown → Rendered HTML)
```

---

## 📁 Project Structure

```
Dsa_RAG/
│
├── app.py                  # Flask app factory — registers all blueprints
├── auth.py                 # API key middleware & session helpers
├── config.py               # Environment config (DB, Groq, embeddings)
├── database.py             # DB init — creates all tables on startup
├── mailer.py               # SMTP email sender (welcome + OTP emails)
├── main.py                 # Entry point shim
│
├── routes/                 # Flask Blueprints
│   ├── auth_routes.py      # /signup /login /logout /api/me /forgot-password
│   ├── chat.py             # /api/ask  — core RAG endpoint
│   ├── ingest.py           # /api/ingest — PDF indexing trigger
│   ├── sessions.py         # /api/sessions — list / load / rename / delete
│   └── ui.py               # / /chat — serve HTML pages
│
├── rag/                    # RAG pipeline
│   ├── rag_pipeline.py     # Orchestrates: spell → search → LLM
│   ├── llm_runner.py       # Calls Groq LLaMA3 with prompt
│   ├── prompt.py           # System prompt template for DSA assistant
│   └── spell_correct.py    # Query spell correction
│
├── llm/
│   └── groq_llm.py         # Groq LLM client (LangChain-Groq)
│
├── embeddings/
│   └── embedder.py         # HuggingFace sentence-transformer singleton
│
├── loaders/                # PDF loading & chunking
│   ├── pdf_loader.py       # Load PDFs from directory, split into chunks
│   ├── loader.py           # LangChain document loader wrapper
│   ├── splitter.py         # Text splitter (chunk_size, overlap)
│   ├── filter.py           # Duplicate / noise filter
│   └── hasher.py           # MD5 file hash for dedup tracking
│
├── db/                     # Database layer
│   ├── connection.py       # psycopg2 connection factory
│   ├── schema.py           # Ensure pgvector columns exist
│   ├── ingester.py         # Batch embed + insert chunks to PostgreSQL
│   ├── retriever.py        # Cosine similarity retrieval
│   ├── vector_store.py     # Facade: store_documents + similarity_search
│   ├── user_store.py       # CRUD for users + OTP management
│   ├── tracker.py          # Track which PDF files are already ingested
│   └── cleaner.py          # Clean / normalize extracted text
│
├── templates/              # Jinja2 HTML templates
│   ├── landing.html        # Public landing page
│   ├── login.html          # Login + forgot-password flow
│   ├── signup.html         # Registration page
│   └── index.html          # Main chat application
│
├── static/                 # Frontend assets
│   ├── style.css           # Global design system (dark red theme)
│   ├── script.js           # Chat logic, markdown renderer, session management
│   └── theme.js            # Light/dark mode persistence
│
├── data/                   # PDF storage directory (gitignored)
├── Procfile                # Gunicorn production server config
├── runtime.txt             # Python 3.11
├── requirements.txt        # Python dependencies
└── .env                    # Environment variables (not committed)
```

---

## ⚡ Quick Start

### Prerequisites

- Python 3.11+
- PostgreSQL 14+ with `pgvector` extension enabled
- [Groq API key](https://console.groq.com) (free tier available)

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/Dsa_RAG.git
cd Dsa_RAG

python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
```

### 2. Configure Environment

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dsa_rag
# OR individual fields:
DB_HOST=localhost
DB_PORT=5432
DB_NAME=dsa_rag
DB_USER=postgres
DB_PASSWORD=yourpassword

# Groq LLM
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
GROQ_MODEL=llama3-8b-8192

# Embeddings
EMBEDDING_MODEL=all-MiniLM-L6-v2

# App
SECRET_KEY=your-very-secret-key-here
PDF_DIR=data

# Email (for OTP password reset)
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=your@gmail.com
MAIL_PASSWORD=your-app-password
MAIL_FROM=your@gmail.com
```

### 3. Set Up PostgreSQL

```sql
-- In psql or pgAdmin:
CREATE DATABASE dsa_rag;
\c dsa_rag
CREATE EXTENSION IF NOT EXISTS vector;
```

### 4. Add Your PDFs

Place your DSA textbook PDF files inside the `data/` directory:

```
data/
├── introduction_to_algorithms.pdf
├── data_structures_and_algorithms.pdf
└── cracking_the_coding_interview.pdf
```

### 5. Run the Application

```bash
python app.py
```

The app starts at **http://localhost:5000**

### 6. Index Your PDFs

1. Log in to the application
2. Click **"Index PDFs"** in the sidebar
3. Wait for indexing to complete (progress shown in terminal)
4. Start chatting! 🎉

---

## 🔌 API Reference

All API endpoints require the header:
```
X-API-KEY: my-secret-key
```

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/signup` | Register a new user |
| `POST` | `/api/login` | Login and get session |
| `GET`  | `/api/me` | Get current user info |
| `GET`  | `/logout` | Clear session |
| `POST` | `/api/forgot-password` | Send OTP to email |
| `POST` | `/api/verify-otp` | Verify OTP code |
| `POST` | `/api/reset-password` | Set new password |

### Chat

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/ask` | Send a question, get RAG answer |

**Request:**
```json
{
  "question": "Explain binary search trees",
  "session_id": "optional-existing-session-uuid"
}
```

**Response:**
```json
{
  "question": "Explain binary search trees",
  "answer": "## Binary Search Trees\n\nA **BST** is...",
  "session_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Sessions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`    | `/api/sessions` | List all user sessions |
| `GET`    | `/api/sessions/:id` | Load a session with messages |
| `PATCH`  | `/api/sessions/:id/title` | Rename a session |
| `DELETE` | `/api/sessions/:id` | Delete a session |
| `DELETE` | `/api/sessions` | Delete all sessions |

### Ingestion

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/ingest` | Index all PDFs in the `data/` directory |

**Response:**
```json
{
  "indexed": {
    "files": ["algorithms.pdf"],
    "message": "1 file(s) successfully indexed."
  },
  "timing": {
    "total_chunks": 1240,
    "stored": 1238,
    "embed_time_sec": 45.2,
    "total_time_sec": 67.8
  },
  "skipped": {
    "files": ["already_ingested.pdf"],
    "message": "1 file(s) already exist in the database."
  }
}
```

---

## 🗄️ Database Schema

```sql
-- Users
CREATE TABLE users (
    id         SERIAL PRIMARY KEY,
    username   TEXT UNIQUE NOT NULL,
    email      TEXT UNIQUE NOT NULL,
    password   TEXT NOT NULL,          -- bcrypt hashed
    created_at TEXT
);

-- Chat Sessions
CREATE TABLE sessions (
    id         TEXT PRIMARY KEY,       -- UUID
    user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title      TEXT,                   -- Auto-generated from first question
    created_at TEXT,
    updated_at TEXT
);

-- Chat Messages
CREATE TABLE messages (
    id         SERIAL PRIMARY KEY,
    session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
    role       TEXT,                   -- 'user' or 'assistant'
    content    TEXT,
    created_at TEXT
);

-- OTP Password Reset
CREATE TABLE reset_tokens (
    id         SERIAL PRIMARY KEY,
    email      TEXT,
    otp        TEXT,
    expires_at TEXT,
    used       INTEGER DEFAULT 0
);

-- Vector Documents (pgvector)
CREATE TABLE documents (
    id          SERIAL PRIMARY KEY,
    content     TEXT,
    embedding   vector(384),           -- all-MiniLM-L6-v2 dimension
    source_file TEXT,
    file_hash   TEXT                   -- MD5 for deduplication
);
```

---

## 🎨 Frontend Overview

The frontend is built with **pure Vanilla HTML, CSS, and JavaScript** — no frameworks.

### Design System

- **Theme**: Dark red (`#e53935`) on deep black (`#0a0a0a`)
- **Fonts**: `Bebas Neue` (headings), `Outfit` (body), `JetBrains Mono` (code)
- **Color mode**: Persisted via `localStorage` with CSS `[data-theme]` attribute

### Key JavaScript Features (`static/script.js`)

| Function | Purpose |
|---|---|
| `formatMessage(text)` | Markdown → HTML renderer with code block extraction |
| `renderMessage(text, role)` | Appends a new chat bubble to the container |
| `askQuestion()` | Sends question to `/api/ask`, shows loading state |
| `copyCode(id)` | Copies code block text to clipboard (excludes line numbers) |
| `toggleSidebarCollapse()` | Collapses/expands sidebar with localStorage persistence |
| `loadSession(id)` | Fetches and renders a full past conversation |
| `ingestPDFs()` | Triggers PDF indexing via `/api/ingest` |

### Markdown Rendering Pipeline

The `formatMessage()` function processes AI responses through this pipeline:

```
1. Extract fenced code blocks → safe placeholders (%%CB0%%, %%CB1%%, ...)
2. Process blockquotes, headings (h1–h4), horizontal rules
3. Process bold, italic, inline code
4. Convert ordered/unordered lists to HTML
5. Paragraph-wrap remaining plain text
6. Inject rendered code blocks (line-numbered, language-colored)
```

> **Note:** Code blocks are extracted **first** before any other processing,
> ensuring code content is never parsed as markdown and always stays intact.

---

## 🚀 Deployment

### Heroku / Render

The project includes a `Procfile` ready for Heroku/Render:

```
gunicorn app:app --bind 0.0.0.0:$PORT --timeout 300 --workers 1
```

**Steps:**

```bash
# Heroku
heroku create your-app-name
heroku addons:create heroku-postgresql:mini
heroku config:set GROQ_API_KEY=gsk_xxx SECRET_KEY=your-secret
git push heroku main

# Render — connect GitHub repo, set environment variables in dashboard
```

### Docker (Self-Hosted)

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["gunicorn", "app:app", "--bind", "0.0.0.0:5000", "--timeout", "300"]
```

---

## 🔧 Configuration Reference

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | — | Full PostgreSQL URL (overrides individual fields) |
| `DB_HOST` | — | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | — | Database name |
| `DB_USER` | — | Database username |
| `DB_PASSWORD` | — | Database password |
| `GROQ_API_KEY` | — | **Required.** Groq API key |
| `GROQ_MODEL` | `llama3-8b-8192` | LLM model ID |
| `EMBEDDING_MODEL` | `all-MiniLM-L6-v2` | HuggingFace embedding model |
| `PDF_DIR` | `data` | Directory containing PDF textbooks |
| `SECRET_KEY` | `fallback-secret-key` | Flask session secret |
| `MAIL_SERVER` | — | SMTP server for emails |
| `MAIL_PORT` | `587` | SMTP port |
| `MAIL_USERNAME` | — | SMTP username |
| `MAIL_PASSWORD` | — | SMTP app password |

---

## 🧠 How the RAG Pipeline Works

### 1. PDF Ingestion (`/api/ingest`)

```
PDF Files in data/
       │
       ▼ PyMuPDF / PyPDF loader
Extract raw text + metadata (page numbers, source file)
       │
       ▼ LangChain TextSplitter
Split into overlapping chunks (chunk_size, overlap)
       │
       ▼ Filter & Clean
Remove noise, normalize whitespace, deduplicate by MD5 hash
       │
       ▼ HuggingFace all-MiniLM-L6-v2
Generate 384-dim embedding vector for each chunk
       │
       ▼ pgvector INSERT
Store (content, embedding, source_file, file_hash) in PostgreSQL
```

### 2. Query & Answer (`/api/ask`)

```
User Question
       │
       ▼ pyspellchecker
Correct spelling errors in query
       │
       ▼ HuggingFace embedding
Generate 384-dim query vector
       │
       ▼ pgvector cosine similarity
Retrieve top-k most relevant chunks from documents table
       │
       ▼ LangChain prompt
Inject chunks as context into DSA system prompt
       │
       ▼ Groq API (LLaMA3-8b-8192)
Generate markdown-formatted answer
       │
       ▼ Save to PostgreSQL
Persist question + answer in sessions/messages tables
       │
       ▼ Return JSON
{answer, session_id, question}
```

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📋 Roadmap

- [ ] Streaming LLM responses (SSE)
- [ ] Multiple PDF collection support per user
- [ ] Syntax highlighting with highlight.js
- [ ] Export conversation as PDF/Markdown
- [ ] Admin panel for user management
- [ ] Rate limiting per user
- [ ] Docker Compose setup with PostgreSQL

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

Built with ❤️ by **Amrit** · Powered by [Groq](https://groq.com) + [LangChain](https://langchain.com) + [pgvector](https://github.com/pgvector/pgvector)

</div>
