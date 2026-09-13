const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { parseTaskIntent } = require('../services/intent');
const { createTask } = require('./tasks');

const router = express.Router();
const COLUMN_TO_TYPE = { habits: 'habit', dailies: 'daily', todos: 'todo' };

// Speech-to-text happens in the browser (Web Speech API) — this endpoint
// receives the transcript and runs the intent-parsing half of the pipeline:
// transcript -> {column, category, priority} -> a real task row.
router.post('/', requireAuth, async (req, res) => {
  const { transcript } = req.body || {};
  if (!transcript || !transcript.trim()) return res.status(400).json({ error: 'transcript required' });
  try {
    const parsed = parseTaskIntent(transcript);
    const task = await createTask(req.userId, {
      type: COLUMN_TO_TYPE[parsed.column] || 'todo',
      name: parsed.name,
      category: parsed.category || 'backend',
      priority: parsed.priority || 'm',
    });
    res.json({ transcript, task });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
