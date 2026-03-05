import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from '../src/logger.js';
import { dbDeleteAllLogs } from '../src/database.js';

describe('RequestLogger', () => {
  beforeEach(() => dbDeleteAllLogs());

  it('creates an entry and emits "new"', () => {
    const handler = vi.fn();
    logger.on('new', handler);

    const entry = logger.create({
      userId: 123,
      username: 'tester',
      question: 'Hello?',
    });

    expect(entry).toHaveProperty('id');
    expect(entry.status).toBe('processing');
    expect(entry.question).toBe('Hello?');
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id: entry.id }));

    logger.off('new', handler);
  });

  it('updates an entry and emits "update"', () => {
    const handler = vi.fn();
    logger.on('update', handler);

    const entry = logger.create({ userId: 1, question: 'Q' });
    const updated = logger.update(entry.id, {
      status: 'completed',
      finalAnswer: 'A',
    });

    expect(updated.status).toBe('completed');
    expect(updated.finalAnswer).toBe('A');
    expect(handler).toHaveBeenCalledOnce();

    logger.off('update', handler);
  });

  it('preserves existing fields on partial update', () => {
    const entry = logger.create({ userId: 1, question: 'Q' });
    logger.update(entry.id, { timings: { rag: 50 } });
    logger.update(entry.id, { timings: { rag: 50, ai: 100 }, status: 'completed' });

    const result = logger.getById(entry.id);
    expect(result.timings).toEqual({ rag: 50, ai: 100 });
    expect(result.status).toBe('completed');
    expect(result.question).toBe('Q');
  });

  it('returns null when updating non-existent entry', () => {
    expect(logger.update('ghost', { status: 'error' })).toBeNull();
  });

  it('retrieves all entries', () => {
    logger.create({ userId: 1, question: 'Q1' });
    logger.create({ userId: 2, question: 'Q2' });
    expect(logger.getAll().length).toBe(2);
  });

  it('retrieves entry by id', () => {
    const entry = logger.create({ userId: 1, question: 'Find me' });
    const found = logger.getById(entry.id);
    expect(found).not.toBeNull();
    expect(found.question).toBe('Find me');
  });
});
