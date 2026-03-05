import { Router } from 'express';
import { authMiddleware } from '../auth.js';
import {
  dbGetAllUsers,
  dbGetUser,
  dbSetUserApproved,
  dbGetUserAccess,
  dbSetUserAccess,
} from '../../database.js';
import { logger } from '../../logger.js';

const router = Router();
router.use(authMiddleware);

router.get('/', (_req, res) => {
  const users = dbGetAllUsers();
  const result = users.map((u) => ({
    ...u,
    access: dbGetUserAccess(u.telegramId),
  }));
  res.json(result);
});

router.get('/:telegramId', (req, res) => {
  const tid = Number(req.params.telegramId);
  const user = dbGetUser(tid);
  if (!user) return res.status(404).json({ error: 'User not found' });

  res.json({ ...user, access: dbGetUserAccess(tid) });
});

router.put('/:telegramId/approve', (req, res) => {
  const tid = Number(req.params.telegramId);
  const user = dbGetUser(tid);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { approved } = req.body;
  if (typeof approved !== 'boolean') {
    return res.status(400).json({ error: '"approved" (boolean) is required' });
  }

  dbSetUserApproved(tid, approved);
  logger.emit('db-change');
  res.json({ ...dbGetUser(tid), access: dbGetUserAccess(tid) });
});

router.put('/:telegramId/access', (req, res) => {
  const tid = Number(req.params.telegramId);
  const user = dbGetUser(tid);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { filenames } = req.body;
  if (!Array.isArray(filenames)) {
    return res.status(400).json({ error: '"filenames" (string[]) is required' });
  }

  dbSetUserAccess(tid, filenames);
  logger.emit('db-change');
  res.json({ ...dbGetUser(tid), access: dbGetUserAccess(tid) });
});

export default router;
