import { Router } from 'express';
import { authMiddleware } from '../auth.js';
import { logger } from '../../logger.js';
import { dbDeleteLog, dbDeleteAllLogs } from '../../database.js';

const router = Router();
router.use(authMiddleware);

router.get('/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  const onNew = (entry) => {
    res.write(`event: new\ndata: ${JSON.stringify(entry)}\n\n`);
  };

  const onUpdate = (entry) => {
    res.write(`event: update\ndata: ${JSON.stringify(entry)}\n\n`);
  };

  logger.on('new', onNew);
  logger.on('update', onUpdate);

  req.on('close', () => {
    logger.off('new', onNew);
    logger.off('update', onUpdate);
  });
});

router.get('/', (_req, res) => {
  res.json(logger.getAll());
});

router.get('/:id', (req, res) => {
  const entry = logger.getById(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Not found' });
  res.json(entry);
});

router.delete('/', (_req, res) => {
  const count = dbDeleteAllLogs();
  res.json({ deleted: count });
});

router.delete('/:id', (req, res) => {
  const ok = dbDeleteLog(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Not found' });
  res.json({ deleted: true });
});

export default router;
