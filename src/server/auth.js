import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';
const TOKEN_EXPIRY = '24h';

export function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function authMiddleware(req, res, next) {
  let token = null;

  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    token = header.slice(7);
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
