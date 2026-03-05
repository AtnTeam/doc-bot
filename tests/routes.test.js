import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import supertest from 'supertest';
import { createServer } from '../src/server/index.js';
import { generateToken } from '../src/server/auth.js';

const DOCS_DIR = path.join(process.cwd(), 'tests', '__route_docs__');
let request;
let token;

beforeAll(() => {
  fs.mkdirSync(DOCS_DIR, { recursive: true });
  fs.writeFileSync(path.join(DOCS_DIR, 'test.md'), '# Test Doc\n\nContent here.');

  const app = createServer(DOCS_DIR, async () => {});
  request = supertest(app);
  token = generateToken({ username: 'admin', role: 'admin' });
});

afterAll(() => {
  fs.rmSync(DOCS_DIR, { recursive: true, force: true });
});

describe('POST /api/auth/login', () => {
  it('returns token for valid credentials', async () => {
    const res = await request
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.username).toBe('admin');
  });

  it('rejects invalid credentials', async () => {
    const res = await request
      .post('/api/auth/login')
      .send({ username: 'wrong', password: 'wrong' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/health', () => {
  it('returns ok status', async () => {
    const res = await request.get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('uptime');
  });
});

describe('GET /api/logs', () => {
  it('rejects without auth', async () => {
    const res = await request.get('/api/logs');
    expect(res.status).toBe(401);
  });

  it('returns logs array with auth', async () => {
    const res = await request
      .get('/api/logs')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('/api/docs', () => {
  it('lists documents', async () => {
    const res = await request
      .get('/api/docs')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.some((d) => d.filename === 'test.md')).toBe(true);
  });

  it('gets a single document', async () => {
    const res = await request
      .get('/api/docs/test.md')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.content).toContain('Test Doc');
  });

  it('creates a new document', async () => {
    const res = await request
      .post('/api/docs')
      .set('Authorization', `Bearer ${token}`)
      .send({ filename: 'new-doc', content: '# New\n\nBody' });
    expect(res.status).toBe(201);

    await request
      .delete('/api/docs/new-doc.md')
      .set('Authorization', `Bearer ${token}`);
  });

  it('rejects duplicate document', async () => {
    const res = await request
      .post('/api/docs')
      .set('Authorization', `Bearer ${token}`)
      .send({ filename: 'test.md', content: 'dup' });
    expect(res.status).toBe(409);
  });

  it('updates a document', async () => {
    const res = await request
      .put('/api/docs/test.md')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: '# Updated' });
    expect(res.status).toBe(200);

    await request
      .put('/api/docs/test.md')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: '# Test Doc\n\nContent here.' });
  });

  it('rejects path traversal', async () => {
    const res = await request
      .get('/api/docs/..%2F..%2Fetc%2Fpasswd')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe('/api/users', () => {
  it('lists users', async () => {
    const res = await request
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('/api/database', () => {
  it('lists tables', async () => {
    const res = await request
      .get('/api/database/tables')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const names = res.body.map((t) => t.name);
    expect(names).toContain('request_logs');
    expect(names).toContain('bot_users');
  });

  it('gets table rows', async () => {
    const res = await request
      .get('/api/database/tables/bot_users')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('rows');
    expect(res.body).toHaveProperty('total');
  });

  it('rejects unknown table', async () => {
    const res = await request
      .get('/api/database/tables/hackers')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
