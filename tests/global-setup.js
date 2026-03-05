import fs from 'fs';

export function teardown() {
  for (const f of ['data/test.db', 'data/test.db-wal', 'data/test.db-shm']) {
    try { fs.unlinkSync(f); } catch {}
  }
}
