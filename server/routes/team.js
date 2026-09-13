const express = require('express');
const { requireAuth } = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

// Every account lands in one shared team board — deliberately simple for a
// demo-scale app. Swap this for real invite/workspace logic to go multi-tenant.
async function ensureTeam(userId) {
  const [[existing]] = await db.pool.query(
    'SELECT t.id FROM teams t JOIN team_members tm ON tm.team_id=t.id WHERE tm.user_id=? LIMIT 1',
    [userId]
  );
  if (existing) return existing.id;

  let [[team]] = await db.pool.query('SELECT id FROM teams LIMIT 1');
  if (!team) {
    const [result] = await db.pool.query("INSERT INTO teams (name) VALUES ('VoxOps Team')");
    team = { id: result.insertId };
  }
  await db.pool.query('INSERT IGNORE INTO team_members (team_id, user_id) VALUES (?,?)', [team.id, userId]);
  return team.id;
}

router.get('/', requireAuth, async (req, res) => {
  const teamId = await ensureTeam(req.userId);
  const [members] = await db.pool.query(
    'SELECT u.id, u.display_name, u.level, u.avatar_seed FROM users u JOIN team_members tm ON tm.user_id=u.id WHERE tm.team_id=?',
    [teamId]
  );
  const [activity] = await db.pool.query(
    'SELECT a.action, a.xp_delta, a.created_at, u.display_name FROM activity_log a JOIN users u ON u.id=a.user_id WHERE a.team_id=? ORDER BY a.created_at DESC LIMIT 20',
    [teamId]
  );
  const [tasks] = await db.pool.query(
    'SELECT tt.*, u.display_name AS owner_name FROM team_tasks tt JOIN users u ON u.id=tt.owner_id WHERE tt.team_id=? ORDER BY tt.created_at DESC',
    [teamId]
  );
  res.json({ teamId, members, activity, tasks });
});

router.post('/tasks', requireAuth, async (req, res) => {
  const { name, priority } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const teamId = await ensureTeam(req.userId);
  const [result] = await db.pool.query(
    'INSERT INTO team_tasks (team_id, owner_id, name, priority) VALUES (?,?,?,?)',
    [teamId, req.userId, name, priority || 'm']
  );
  await db.pool.query('INSERT INTO activity_log (team_id, user_id, action, xp_delta) VALUES (?,?,?,0)', [
    teamId,
    req.userId,
    `added "${name}" to team board`,
  ]);
  const [[task]] = await db.pool.query('SELECT * FROM team_tasks WHERE id=?', [result.insertId]);
  res.json(task);
});

router.post('/tasks/:id/toggle', requireAuth, async (req, res) => {
  const [[task]] = await db.pool.query('SELECT * FROM team_tasks WHERE id=?', [req.params.id]);
  if (!task) return res.status(404).json({ error: 'not found' });
  const done = !task.done;
  await db.pool.query('UPDATE team_tasks SET done=? WHERE id=?', [done, task.id]);
  if (done) {
    await db.pool.query('INSERT INTO activity_log (team_id, user_id, action, xp_delta) VALUES (?,?,?,0)', [
      task.team_id,
      req.userId,
      `completed "${task.name}"`,
    ]);
  }
  res.json({ ...task, done });
});

module.exports = { router, ensureTeam };
