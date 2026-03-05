import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, '..', 'data');
const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'logs.db');
const dbDir = path.dirname(path.resolve(dbPath));

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS request_logs (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'processing',
    user_id INTEGER,
    username TEXT,
    question TEXT,
    rag_results TEXT,
    prompt TEXT,
    ai_response TEXT,
    final_answer TEXT,
    timings TEXT,
    error TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS bot_users (
    telegram_id INTEGER PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    is_approved INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS user_doc_access (
    telegram_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    PRIMARY KEY (telegram_id, filename),
    FOREIGN KEY (telegram_id) REFERENCES bot_users(telegram_id) ON DELETE CASCADE
  )
`);

const insertStmt = db.prepare(`
  INSERT INTO request_logs (id, timestamp, status, user_id, username, question, rag_results, prompt, ai_response, final_answer, timings, error)
  VALUES (@id, @timestamp, @status, @userId, @username, @question, @ragResults, @prompt, @aiResponse, @finalAnswer, @timings, @error)
`);

const updateStmt = db.prepare(`
  UPDATE request_logs
  SET status = @status,
      rag_results = @ragResults,
      prompt = @prompt,
      ai_response = @aiResponse,
      final_answer = @finalAnswer,
      timings = @timings,
      error = @error
  WHERE id = @id
`);

const selectAllStmt = db.prepare(
  'SELECT * FROM request_logs ORDER BY timestamp DESC LIMIT ?'
);

const selectByIdStmt = db.prepare(
  'SELECT * FROM request_logs WHERE id = ?'
);

function rowToEntry(row) {
  if (!row) return null;
  return {
    id: row.id,
    timestamp: row.timestamp,
    status: row.status,
    userId: row.user_id,
    username: row.username,
    question: row.question,
    ragResults: JSON.parse(row.rag_results || '[]'),
    prompt: row.prompt || '',
    aiResponse: JSON.parse(row.ai_response || '""'),
    finalAnswer: row.final_answer || '',
    timings: JSON.parse(row.timings || '{}'),
    error: row.error || null,
  };
}

function entryToRow(entry) {
  return {
    id: entry.id,
    timestamp: entry.timestamp,
    status: entry.status,
    userId: entry.userId,
    username: entry.username,
    question: entry.question,
    ragResults: JSON.stringify(entry.ragResults ?? []),
    prompt: entry.prompt ?? '',
    aiResponse: JSON.stringify(entry.aiResponse ?? ''),
    finalAnswer: entry.finalAnswer ?? '',
    timings: JSON.stringify(entry.timings ?? {}),
    error: entry.error ?? null,
  };
}

export function dbInsert(entry) {
  insertStmt.run(entryToRow(entry));
}

export function dbUpdate(entry) {
  updateStmt.run(entryToRow(entry));
}

export function dbGetAll(limit = 200) {
  return selectAllStmt.all(limit).map(rowToEntry);
}

export function dbGetById(id) {
  return rowToEntry(selectByIdStmt.get(id));
}

const deleteLogStmt = db.prepare('DELETE FROM request_logs WHERE id = ?');
const deleteAllLogsStmt = db.prepare('DELETE FROM request_logs');

export function dbDeleteLog(id) {
  return deleteLogStmt.run(id).changes > 0;
}

export function dbDeleteAllLogs() {
  return deleteAllLogsStmt.run().changes;
}

// ── Bot Users ──

const upsertUserStmt = db.prepare(`
  INSERT INTO bot_users (telegram_id, username, first_name, is_approved, created_at)
  VALUES (@telegramId, @username, @firstName, @isApproved, @createdAt)
  ON CONFLICT(telegram_id) DO UPDATE SET
    username = excluded.username,
    first_name = excluded.first_name
`);

const getUserStmt = db.prepare(
  'SELECT * FROM bot_users WHERE telegram_id = ?'
);

const getAllUsersStmt = db.prepare(
  'SELECT * FROM bot_users ORDER BY created_at DESC'
);

const setApprovedStmt = db.prepare(
  'UPDATE bot_users SET is_approved = ? WHERE telegram_id = ?'
);

function userRowToObj(row) {
  if (!row) return null;
  return {
    telegramId: row.telegram_id,
    username: row.username,
    firstName: row.first_name,
    isApproved: !!row.is_approved,
    createdAt: row.created_at,
  };
}

export function dbUpsertUser(telegramId, username, firstName) {
  const existing = getUserStmt.get(telegramId);
  if (existing) {
    upsertUserStmt.run({
      telegramId,
      username,
      firstName,
      isApproved: existing.is_approved,
      createdAt: existing.created_at,
    });
    return userRowToObj(getUserStmt.get(telegramId));
  }
  upsertUserStmt.run({
    telegramId,
    username,
    firstName,
    isApproved: 0,
    createdAt: new Date().toISOString(),
  });
  return userRowToObj(getUserStmt.get(telegramId));
}

export function dbGetUser(telegramId) {
  return userRowToObj(getUserStmt.get(telegramId));
}

export function dbGetAllUsers() {
  return getAllUsersStmt.all().map(userRowToObj);
}

export function dbSetUserApproved(telegramId, approved) {
  setApprovedStmt.run(approved ? 1 : 0, telegramId);
}

// ── User Document Access ──

const getUserAccessStmt = db.prepare(
  'SELECT filename FROM user_doc_access WHERE telegram_id = ?'
);

const deleteUserAccessStmt = db.prepare(
  'DELETE FROM user_doc_access WHERE telegram_id = ?'
);

const insertAccessStmt = db.prepare(
  'INSERT OR IGNORE INTO user_doc_access (telegram_id, filename) VALUES (?, ?)'
);

export function dbGetUserAccess(telegramId) {
  return getUserAccessStmt.all(telegramId).map((r) => r.filename);
}

export function dbSetUserAccess(telegramId, filenames) {
  const setAccess = db.transaction((tid, files) => {
    deleteUserAccessStmt.run(tid);
    for (const f of files) {
      insertAccessStmt.run(tid, f);
    }
  });
  setAccess(telegramId, filenames);
}

// ── Database Viewer ──

const ALLOWED_TABLES = ['request_logs', 'bot_users', 'user_doc_access'];

export function dbGetTables() {
  return db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all()
    .map((r) => r.name);
}

export function dbGetTableInfo(tableName) {
  if (!ALLOWED_TABLES.includes(tableName)) return [];
  return db.prepare(`PRAGMA table_info("${tableName}")`).all();
}

export function dbGetTableRows(tableName, limit = 200, offset = 0) {
  if (!ALLOWED_TABLES.includes(tableName)) return { rows: [], total: 0 };
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM "${tableName}"`).get().cnt;
  const rows = db.prepare(`SELECT * FROM "${tableName}" LIMIT ? OFFSET ?`).all(limit, offset);
  return { rows, total };
}
