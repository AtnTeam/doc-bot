# Doc AI Bot

Telegram-бот, який відповідає на питання з внутрішньої `.md`-документації за допомогою RAG (Retrieval-Augmented Generation). Включає веб-адмінпанель для моніторингу, управління документами та контролю доступу користувачів.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js (ES Modules) |
| Bot | Telegraf v4 |
| RAG | LangChain — RecursiveCharacterTextSplitter, MemoryVectorStore, hash-based embeddings |
| LLM | OpenRouter API via `@langchain/openai` |
| Admin API | Express.js |
| Admin UI | Next.js 14 (App Router) + Tailwind CSS 3 |
| Database | SQLite via `better-sqlite3` (WAL mode) |
| Auth | JWT (`jsonwebtoken`) |
| Real-time | Server-Sent Events (SSE) |
| Tests | Vitest + Supertest |

## Architecture

Bot (Telegraf) and admin API (Express) run in a **single Node.js process**. No IPC needed.

```
index.js                 # Entry point — bot + Express
src/
  database.js            # SQLite init, tables, CRUD helpers
  logger.js              # RequestLogger (EventEmitter + SQLite)
  rag.js                 # RAG: embeddings, vector store, search, LLM
  server/
    index.js             # Express app factory
    auth.js              # JWT: generateToken(), authMiddleware
    routes/
      auth.js            # POST /api/auth/login
      docs.js            # CRUD /api/docs
      logs.js            # GET/DELETE /api/logs, SSE /api/logs/stream
      users.js           # GET/PUT /api/users
      database.js        # GET /api/database/tables, SSE
docs/                    # Markdown knowledge base (.md files)
admin/                   # Next.js frontend
  src/app/
    login/page.js        # Login page
    logs/page.js         # Real-time request monitoring (SSE)
    users/page.js        # User management + document access
    docs/page.js         # Document CRUD with markdown preview
    database/page.js     # Database table viewer
tests/                   # Vitest test suite
```

## Quick Start

### Prerequisites

- Node.js >= 18
- Telegram bot token (from [@BotFather](https://t.me/BotFather))
- OpenRouter API key (from [openrouter.ai](https://openrouter.ai))

### Setup

```bash
# Clone and install
npm install
cd admin && npm install && cd ..

# Configure environment
cp .env.example .env
# Edit .env — set TELEGRAM_BOT_TOKEN, OPENROUTER_API_KEY, JWT_SECRET
```

### Running

```bash
# Start bot + admin API (port 3100)
npm start

# Start admin UI (port 3000, proxies /api → :3100)
npm run admin
```

### Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch
```

## API Endpoints

All endpoints except `/api/auth/login` and `/api/health` require JWT auth:
`Authorization: Bearer <token>` header or `?token=<token>` query parameter.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Admin login → returns JWT |
| GET | `/api/health` | Health check |
| GET | `/api/logs` | List request logs |
| GET | `/api/logs/:id` | Single log details |
| GET | `/api/logs/stream` | SSE — real-time log updates |
| DELETE | `/api/logs` | Delete all logs |
| DELETE | `/api/logs/:id` | Delete single log |
| GET | `/api/docs` | List documents |
| GET | `/api/docs/:filename` | Read document content |
| POST | `/api/docs` | Create document |
| PUT | `/api/docs/:filename` | Update document |
| DELETE | `/api/docs/:filename` | Delete document |
| GET | `/api/users` | List bot users |
| GET | `/api/users/:telegramId` | Single user details |
| PUT | `/api/users/:telegramId/approve` | Approve/revoke user |
| PUT | `/api/users/:telegramId/access` | Set document access |
| GET | `/api/database/tables` | List DB tables |
| GET | `/api/database/tables/:name` | Table rows (paginated) |
| GET | `/api/database/stream` | SSE — DB change events |

## Bot User Flow

1. User sends `/start` → auto-created in `bot_users` with `is_approved = false`
2. Admin approves user via `/users` page
3. Admin assigns documents via toggle switches
4. User asks questions → RAG search filtered by allowed docs → LLM response

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | — | Telegram bot token |
| `OPENROUTER_API_KEY` | Yes | — | OpenRouter API key |
| `PORT` | No | `3100` | Express API port |
| `ADMIN_USERNAME` | No | `admin` | Admin panel login |
| `ADMIN_PASSWORD` | No | `admin` | Admin panel password |
| `JWT_SECRET` | No | fallback | JWT signing secret |
| `DATABASE_PATH` | No | `data/logs.db` | SQLite database file path |

## Database

SQLite with WAL mode. Tables:

- **`request_logs`** — bot request history (id, timestamp, status, user info, question, RAG results, prompt, AI response, timings, error)
- **`bot_users`** — Telegram users (telegram_id, username, first_name, is_approved, created_at)
- **`user_doc_access`** — per-user document permissions (telegram_id, filename)

Database file is auto-created on first run at `data/logs.db` (or path from `DATABASE_PATH`).

## License

Private — internal team use only.
