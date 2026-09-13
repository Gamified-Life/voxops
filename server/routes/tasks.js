const express = require('express');
const { requireAuth } = require('../middleware/auth');
const db = require('../db');
const { awardAndFetch } = require('../services/gamification');

const router = express.Router();
const TODO_XP = { h: 25, m: 15, l: 10 };

async function createTask(userId, { type, name, category, priority, cost, timerLabel }) {
  const [result] = await db.pool.query(
    'INSERT INTO tasks (user_id, type, name, category, priority, cost, timer_label) VALUES (?,?,?,?,?,?,?)',
    [userId, type, name, category || null, priority || null, cost ?? null, timerLabel || '30m']
  );
  const [[task]] = await db.pool.query('SELECT * FROM tasks WHERE id=?', [result.insertId]);
  return task;
}

async function logActivity(userId, action, xpDelta = 0) {
  await db.pool.query('INSERT INTO activity_log (user_id, action, xp_delta) VALUES (?,?,?)', [
    userId,
    action,
    xpDelta,
  ]);
}

router.post('/', requireAuth, async (req, res) => {
  const { type, name, category, priority, cost } = req.body || {};
  if (!type || !name) return res.status(400).json({ error: 'type and name required' });
  const task = await createTask(req.userId, { type, name, category, priority, cost });
  res.json(task);
});

router.delete('/:id', requireAuth, async (req, res) => {
  await db.pool.query('DELETE FROM tasks WHERE id=? AND user_id=?', [req.params.id, req.userId]);
  res.json({ ok: true });
});

// Habit +/- click.
router.post('/:id/complete', requireAuth, async (req, res) => {
  const delta = req.body && req.body.delta === -1 ? -1 : 1;
  const [[task]] = await db.pool.query('SELECT * FROM tasks WHERE id=? AND user_id=?', [req.params.id, req.userId]);
  if (!task) return res.status(404).json({ error: 'not found' });

  let streak = task.streak;
  let completeCount = task.complete_count;
  let xpDelta = 0;
  let coinDelta = 0;
  if (delta === 1) {
    streak += 1;
    completeCount += 1;
    xpDelta = 10;
    coinDelta = 5;
  } else {
    streak = Math.max(0, streak - 1);
    xpDelta = -5;
  }

  await db.pool.query('UPDATE tasks SET streak=?, complete_count=? WHERE id=?', [streak, completeCount, task.id]);
  const progress = await awardAndFetch(req.userId, xpDelta, coinDelta);
  if (delta === 1) await logActivity(req.userId, `completed "${task.name}"`, xpDelta);

  res.json({
    task: { ...task, streak, complete_count: completeCount },
    progress,
    stale: completeCount >= 3,
  });
});

// Daily / todo checkbox toggle.
router.post('/:id/toggle', requireAuth, async (req, res) => {
  const [[task]] = await db.pool.query('SELECT * FROM tasks WHERE id=? AND user_id=?', [req.params.id, req.userId]);
  if (!task) return res.status(404).json({ error: 'not found' });

  const done = !task.done;
  let streak = task.streak;
  let completeCount = task.complete_count;
  let xpDelta = 0;
  let coinDelta = 0;

  if (done) {
    completeCount += 1;
    if (task.type === 'daily') {
      streak += 1;
      xpDelta = 10;
      coinDelta = 5;
    } else {
      xpDelta = TODO_XP[task.priority] || 10;
      coinDelta = xpDelta;
    }
  } else if (task.type === 'daily') {
    streak = Math.max(0, streak - 1);
  }

  await db.pool.query('UPDATE tasks SET done=?, streak=?, complete_count=? WHERE id=?', [
    done,
    streak,
    completeCount,
    task.id,
  ]);
  const progress = xpDelta || coinDelta ? await awardAndFetch(req.userId, xpDelta, coinDelta) : null;
  if (done) await logActivity(req.userId, `completed "${task.name}"`, xpDelta);

  res.json({
    task: { ...task, done, streak, complete_count: completeCount },
    progress,
    stale: task.type === 'todo' && completeCount >= 3,
  });
});

router.post('/rewards/:id/buy', requireAuth, async (req, res) => {
  const [[reward]] = await db.pool.query('SELECT * FROM tasks WHERE id=? AND user_id=? AND type=\'reward\'', [
    req.params.id,
    req.userId,
  ]);
  if (!reward) return res.status(404).json({ error: 'not found' });
  const [[user]] = await db.pool.query('SELECT coins FROM users WHERE id=?', [req.userId]);
  if (user.coins < reward.cost) return res.status(400).json({ error: 'not enough coins' });

  const progress = await awardAndFetch(req.userId, 0, -reward.cost);
  await logActivity(req.userId, `redeemed reward "${reward.name}"`, 0);
  res.json({ ok: true, progress });
});

module.exports = { router, createTask };
