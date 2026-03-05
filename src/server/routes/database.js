import { Router } from 'express';
import { authMiddleware } from '../auth.js';
import { dbGetTables, dbGetTableInfo, dbGetTableRows } from '../../database.js';
import { logger } from '../../logger.js';

const router = Router();
router.use(authMiddleware);

router.get('/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  const onChanged = () => {
    res.write(`event: db-change\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);
  };

  logger.on('new', onChanged);
  logger.on('update', onChanged);
  logger.on('db-change', onChanged);

  req.on('close', () => {
    logger.off('new', onChanged);
    logger.off('update', onChanged);
    logger.off('db-change', onChanged);
  });
});

router.get('/tables', (_req, res) => {
  const tables = dbGetTables();
  const result = tables.map((name) => ({
    name,
    columns: dbGetTableInfo(name),
    rowCount: dbGetTableRows(name, 0, 0).total,
  }));
  res.json(result);
});

router.get('/tables/:name', (req, res) => {
  const { name } = req.params;
  const limit = Math.min(Number(req.query.limit) || 200, 1000);
  const offset = Number(req.query.offset) || 0;

  const columns = dbGetTableInfo(name);
  if (columns.length === 0) {
    return res.status(404).json({ error: 'Table not found' });
  }

  const { rows, total } = dbGetTableRows(name, limit, offset);
  res.json({ name, columns, rows, total, limit, offset });
});

export default router;
