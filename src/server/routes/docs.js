import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { authMiddleware } from '../auth.js';

export default function createDocsRouter(docsDir, onDocsChanged) {
  const router = Router();
  router.use(authMiddleware);

  function safePath(filename) {
    const sanitized = path.basename(filename);
    if (!sanitized.endsWith('.md') && !sanitized.endsWith('.txt')) return null;
    if (/[\\/:*?"<>|]/.test(sanitized.replace(/\.[^.]+$/, ''))) return null;
    return path.join(docsDir, sanitized);
  }

  router.get('/', async (_req, res) => {
    try {
      const files = await fs.readdir(docsDir);
      const result = [];

      for (const file of files) {
        if (!file.endsWith('.md') && !file.endsWith('.txt')) continue;
        const stat = await fs.stat(path.join(docsDir, file));
        result.push({
          filename: file,
          size: stat.size,
          modified: stat.mtime.toISOString(),
        });
      }

      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/:filename', async (req, res) => {
    const filePath = safePath(req.params.filename);
    if (!filePath) return res.status(400).json({ error: 'Invalid filename' });

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      res.json({ filename: req.params.filename, content });
    } catch {
      res.status(404).json({ error: 'File not found' });
    }
  });

  router.post('/', async (req, res) => {
    const { filename, content } = req.body;
    if (!filename || typeof content !== 'string') {
      return res.status(400).json({ error: 'filename and content required' });
    }

    const name = filename.endsWith('.md') ? filename : filename + '.md';
    const filePath = safePath(name);
    if (!filePath) return res.status(400).json({ error: 'Invalid filename' });

    try {
      await fs.access(filePath);
      return res.status(409).json({ error: 'File already exists' });
    } catch {
      // does not exist — good
    }

    try {
      await fs.writeFile(filePath, content, 'utf-8');
      if (onDocsChanged) await onDocsChanged();
      res.status(201).json({ filename: name, message: 'Created' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:filename', async (req, res) => {
    const filePath = safePath(req.params.filename);
    if (!filePath) return res.status(400).json({ error: 'Invalid filename' });

    const { content } = req.body;
    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'content is required' });
    }

    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'File not found' });
    }

    try {
      await fs.writeFile(filePath, content, 'utf-8');
      if (onDocsChanged) await onDocsChanged();
      res.json({ filename: req.params.filename, message: 'Updated' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:filename', async (req, res) => {
    const filePath = safePath(req.params.filename);
    if (!filePath) return res.status(400).json({ error: 'Invalid filename' });

    try {
      await fs.unlink(filePath);
      if (onDocsChanged) await onDocsChanged();
      res.json({ filename: req.params.filename, message: 'Deleted' });
    } catch {
      res.status(404).json({ error: 'File not found' });
    }
  });

  return router;
}
