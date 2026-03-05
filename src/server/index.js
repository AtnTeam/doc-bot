import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth.js';
import logsRouter from './routes/logs.js';
import usersRouter from './routes/users.js';
import databaseRouter from './routes/database.js';
import createDocsRouter from './routes/docs.js';

export function createServer(docsDir, onDocsChanged) {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '5mb' }));

  app.use('/api/auth', authRouter);
  app.use('/api/logs', logsRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/database', databaseRouter);
  app.use('/api/docs', createDocsRouter(docsDir, onDocsChanged));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  return app;
}
