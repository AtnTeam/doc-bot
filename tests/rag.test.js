import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { initRAG, rebuildIndex, search, createLLM } from '../src/rag.js';

const DOCS_DIR = path.join(process.cwd(), 'tests', '__rag_docs__');

beforeAll(async () => {
  fs.mkdirSync(DOCS_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(DOCS_DIR, 'onboarding.md'),
    '# Onboarding Guide\n\nNew team members should complete the checklist within the first week.\n\n1. Get access to tools\n2. Meet the team\n3. Read documentation'
  );
  fs.writeFileSync(
    path.join(DOCS_DIR, 'finance.md'),
    '# Finance\n\nPayments are processed on the 1st and 15th of each month.\nMinimum payout is $100.'
  );
  await initRAG(DOCS_DIR);
});

afterAll(() => {
  fs.rmSync(DOCS_DIR, { recursive: true, force: true });
});

describe('initRAG', () => {
  it('initializes with correct doc/chunk count', async () => {
    const result = await initRAG(DOCS_DIR);
    expect(result.docCount).toBe(2);
    expect(result.chunkCount).toBeGreaterThanOrEqual(2);
  });

  it('throws on missing directory', async () => {
    await expect(initRAG('/nonexistent/dir')).rejects.toThrow();
  });
});

describe('search', () => {
  it('returns results for a valid query', async () => {
    const results = await search('onboarding process', 3);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('content');
    expect(results[0]).toHaveProperty('filename');
    expect(results[0]).toHaveProperty('score');
  });

  it('filters by allowed filenames', async () => {
    const results = await search('payment schedule', 3, ['finance.md']);
    for (const r of results) {
      expect(r.filename).toBe('finance.md');
    }
  });

  it('returns empty for non-existent allowed files', async () => {
    const results = await search('onboarding', 3, ['ghost.md']);
    expect(results).toHaveLength(0);
  });
});

describe('rebuildIndex', () => {
  it('rebuilds without errors', async () => {
    const result = await rebuildIndex(DOCS_DIR);
    expect(result.docCount).toBe(2);
  });
});

describe('createLLM', () => {
  it('creates a ChatOpenAI instance with invoke method', () => {
    const llm = createLLM('test-key');
    expect(llm).toBeDefined();
    expect(typeof llm.invoke).toBe('function');
  });
});
