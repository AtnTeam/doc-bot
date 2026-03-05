import { describe, it, expect, beforeAll } from 'vitest';
import {
  dbInsert, dbUpdate, dbGetAll, dbGetById, dbDeleteLog, dbDeleteAllLogs,
  dbUpsertUser, dbGetUser, dbGetAllUsers, dbSetUserApproved,
  dbGetUserAccess, dbSetUserAccess,
  dbGetTables, dbGetTableInfo, dbGetTableRows,
} from '../src/database.js';

describe('request_logs CRUD', () => {
  const entry = {
    id: 'test-log-001',
    timestamp: new Date().toISOString(),
    status: 'processing',
    userId: 12345,
    username: 'testuser',
    question: 'What is testing?',
    ragResults: [{ content: 'chunk', filename: 'test.md', score: 0.9 }],
    prompt: 'Test prompt',
    aiResponse: 'Test response',
    finalAnswer: 'Test answer',
    timings: { rag: 100, ai: 200, total: 300 },
    error: null,
  };

  beforeAll(() => dbDeleteAllLogs());

  it('inserts and retrieves a log entry', () => {
    dbInsert(entry);
    const result = dbGetById(entry.id);
    expect(result).not.toBeNull();
    expect(result.id).toBe(entry.id);
    expect(result.question).toBe(entry.question);
    expect(result.ragResults).toEqual(entry.ragResults);
    expect(result.timings).toEqual(entry.timings);
  });

  it('updates a log entry', () => {
    dbUpdate({ ...entry, status: 'completed', finalAnswer: 'Updated' });
    const result = dbGetById(entry.id);
    expect(result.status).toBe('completed');
    expect(result.finalAnswer).toBe('Updated');
  });

  it('returns all log entries with limit', () => {
    const results = dbGetAll(100);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('returns null for non-existent entry', () => {
    expect(dbGetById('non-existent')).toBeNull();
  });

  it('deletes a single log entry', () => {
    expect(dbDeleteLog(entry.id)).toBe(true);
    expect(dbGetById(entry.id)).toBeNull();
  });

  it('deletes all log entries', () => {
    dbInsert({ ...entry, id: 'del-1' });
    dbInsert({ ...entry, id: 'del-2' });
    const count = dbDeleteAllLogs();
    expect(count).toBeGreaterThanOrEqual(2);
    expect(dbGetAll().length).toBe(0);
  });
});

describe('bot_users CRUD', () => {
  const TID = 99999;

  it('creates a new user', () => {
    const user = dbUpsertUser(TID, 'tester', 'Test User');
    expect(user.telegramId).toBe(TID);
    expect(user.username).toBe('tester');
    expect(user.isApproved).toBe(false);
  });

  it('updates existing user without changing approval', () => {
    const user = dbUpsertUser(TID, 'new_name', 'New First');
    expect(user.username).toBe('new_name');
    expect(user.firstName).toBe('New First');
    expect(user.isApproved).toBe(false);
  });

  it('gets user by telegramId', () => {
    const user = dbGetUser(TID);
    expect(user).not.toBeNull();
    expect(user.telegramId).toBe(TID);
  });

  it('returns null for non-existent user', () => {
    expect(dbGetUser(0)).toBeNull();
  });

  it('gets all users', () => {
    const users = dbGetAllUsers();
    expect(users.length).toBeGreaterThanOrEqual(1);
  });

  it('approves and revokes user', () => {
    dbSetUserApproved(TID, true);
    expect(dbGetUser(TID).isApproved).toBe(true);

    dbSetUserApproved(TID, false);
    expect(dbGetUser(TID).isApproved).toBe(false);
  });
});

describe('user_doc_access', () => {
  const TID = 99999;

  it('sets and gets user access', () => {
    dbSetUserAccess(TID, ['doc1.md', 'doc2.md']);
    const access = dbGetUserAccess(TID);
    expect(access).toHaveLength(2);
    expect(access).toContain('doc1.md');
    expect(access).toContain('doc2.md');
  });

  it('replaces access on subsequent calls', () => {
    dbSetUserAccess(TID, ['doc3.md']);
    expect(dbGetUserAccess(TID)).toEqual(['doc3.md']);
  });

  it('clears access', () => {
    dbSetUserAccess(TID, []);
    expect(dbGetUserAccess(TID)).toEqual([]);
  });
});

describe('database viewer', () => {
  it('lists all tables', () => {
    const tables = dbGetTables();
    expect(tables).toContain('request_logs');
    expect(tables).toContain('bot_users');
    expect(tables).toContain('user_doc_access');
  });

  it('gets table column info', () => {
    const cols = dbGetTableInfo('bot_users');
    const names = cols.map((c) => c.name);
    expect(names).toContain('telegram_id');
    expect(names).toContain('username');
  });

  it('rejects unknown tables', () => {
    expect(dbGetTableInfo('evil_table')).toEqual([]);
    expect(dbGetTableRows('evil_table')).toEqual({ rows: [], total: 0 });
  });

  it('gets table rows with pagination', () => {
    const result = dbGetTableRows('bot_users', 10, 0);
    expect(result).toHaveProperty('rows');
    expect(result).toHaveProperty('total');
    expect(Array.isArray(result.rows)).toBe(true);
  });
});
