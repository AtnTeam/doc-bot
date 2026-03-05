import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { generateToken, authMiddleware } from '../src/server/auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';

function mockRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.body = data; return res; };
  return res;
}

describe('generateToken', () => {
  it('generates a valid JWT with payload', () => {
    const token = generateToken({ username: 'admin', role: 'admin' });
    const decoded = jwt.verify(token, JWT_SECRET);
    expect(decoded.username).toBe('admin');
    expect(decoded.role).toBe('admin');
  });

  it('includes expiration claim', () => {
    const token = generateToken({ username: 'admin' });
    expect(jwt.decode(token)).toHaveProperty('exp');
  });
});

describe('authMiddleware', () => {
  it('passes with valid Bearer token', () => {
    const token = generateToken({ username: 'admin' });
    const req = { headers: { authorization: `Bearer ${token}` }, query: {} };
    const res = mockRes();
    const next = vi.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user.username).toBe('admin');
  });

  it('passes with valid query token', () => {
    const token = generateToken({ username: 'admin' });
    const req = { headers: {}, query: { token } };
    const res = mockRes();
    const next = vi.fn();

    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('rejects when no token is provided', () => {
    const req = { headers: {}, query: {} };
    const res = mockRes();
    const next = vi.fn();

    authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('No token provided');
  });

  it('rejects invalid token', () => {
    const req = { headers: { authorization: 'Bearer bad.token.here' }, query: {} };
    const res = mockRes();
    const next = vi.fn();

    authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('Invalid token');
  });
});
