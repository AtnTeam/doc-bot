import { Router } from 'express';
import { generateToken } from '../auth.js';

const router = Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD || 'admin';

  if (username === adminUser && password === adminPass) {
    const token = generateToken({ username, role: 'admin' });
    return res.json({ token, username });
  }

  return res.status(401).json({ error: 'Invalid credentials' });
});

export default router;
