const express = require('express');
const { requireAuth } = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const [[user]] = await db.pool.query(
    'SELECT id, email, display_name, mode, xp, level, coins, avatar_seed FROM users WHERE id=?',
    [req.userId]
  );
  const [tasks] = await db.pool.query('SELECT * FROM tasks WHERE user_id=? ORDER BY created_at', [req.userId]);
  const [workflows] = await db.pool.query('SELECT * FROM workflows WHERE user_id=? ORDER BY created_at DESC', [
    req.userId,
  ]);

  res.json({
    user,
    habits: tasks.filter((t) => t.type === 'habit'),
    dailies: tasks.filter((t) => t.type === 'daily'),
    todos: tasks.filter((t) => t.type === 'todo'),
    rewards: tasks.filter((t) => t.type === 'reward'),
    workflows,
  });
});

module.exports = router;
