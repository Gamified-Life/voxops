const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();
const COOKIE_OPTS = { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 3600 * 1000 };

function sign(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '7d' });
}

// Demo-friendly by design: signs in if the account exists, otherwise creates
// it on the spot. This is a portfolio project people click into cold, not a
// bank — there's no separate signup screen to fall through to.
router.post('/login', async (req, res) => {
  const { email, password, mode } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  const [[existing]] = await db.pool.query('SELECT * FROM users WHERE email=?', [email]);
  let user = existing;

  if (user) {
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });
  } else {
    const displayName = email
      .split('@')[0]
      .split(/[._]/)
      .filter(Boolean)
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(' ');
    const hash = await bcrypt.hash(password, 10);
    const avatarSeed = Math.random().toString(36).slice(2, 10);
    const [result] = await db.pool.query(
      'INSERT INTO users (email, password_hash, display_name, mode, avatar_seed) VALUES (?,?,?,?,?)',
      [email, hash, displayName || 'Player', mode === 'team' ? 'team' : 'personal', avatarSeed]
    );
    [[user]] = await db.pool.query('SELECT * FROM users WHERE id=?', [result.insertId]);
  }

  res.cookie('voxops_token', sign(user.id), COOKIE_OPTS);
  res.json({ id: user.id, email: user.email, displayName: user.display_name, mode: user.mode, avatarSeed: user.avatar_seed });
});

router.post('/logout', (req, res) => {
  res.clearCookie('voxops_token');
  res.json({ ok: true });
});

module.exports = router;
