const express = require('express');
const { requireAuth } = require('../middleware/auth');
const db = require('../db');
const { triggerN8nWebhook } = require('../services/n8n');
const { awardAndFetch } = require('../services/gamification');

const router = express.Router();

const ACTIONS = {
  slack: ['log_event', 'send_slack_notification', 'update_task_status'],
  email: ['log_event', 'compose_email_digest', 'send_email', 'mark_notified'],
  calendar: ['log_event', 'find_free_slot', 'create_calendar_block', 'notify_user'],
};

router.get('/', requireAuth, async (req, res) => {
  const [rows] = await db.pool.query('SELECT * FROM workflows WHERE user_id=? ORDER BY created_at DESC', [
    req.userId,
  ]);
  res.json(rows);
});

router.post('/', requireAuth, async (req, res) => {
  const { taskId, action } = req.body || {};
  if (!taskId || !ACTIONS[action]) return res.status(400).json({ error: 'taskId and valid action required' });

  const [[task]] = await db.pool.query('SELECT * FROM tasks WHERE id=? AND user_id=?', [taskId, req.userId]);
  if (!task) return res.status(404).json({ error: 'task not found' });

  const delivery = await triggerN8nWebhook({
    event: 'voxops.workflow.deployed',
    userId: req.userId,
    task: { id: task.id, name: task.name, type: task.type },
    action,
    actions: ACTIONS[action],
  });

  const [result] = await db.pool.query(
    `INSERT INTO workflows (user_id, task_id, task_name, task_type, trigger_desc, action_type, actions_json, status)
     VALUES (?,?,?,?,?,?,?,?)`,
    [
      req.userId,
      task.id,
      task.name,
      task.type,
      'task completed 3+ times',
      action,
      JSON.stringify(ACTIONS[action]),
      delivery.delivered ? 'active' : 'deployed',
    ]
  );

  const progress = await awardAndFetch(req.userId, 150, 50);
  const [[workflow]] = await db.pool.query('SELECT * FROM workflows WHERE id=?', [result.insertId]);
  res.json({ workflow, delivery, progress });
});

module.exports = router;
