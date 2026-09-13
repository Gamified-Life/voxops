// Local, dependency-free stand-in for an LLM intent-classification call.
// The transcript itself comes from the browser's real Speech Recognition API
// (see voiceInput() in public/index.html) — this just decides which column,
// category, and priority it belongs on, using keyword heuristics instead of
// a hosted model, so the voice pipeline needs no API key to run end to end.

// Checked in order — more specific domain vocabulary first, since generic
// words like "fix"/"bug"/"issue" show up in descriptions of almost any kind
// of task and would otherwise swamp a real signal like "auth"/"sql"/"api".
const CATEGORY_KEYWORDS = {
  auth: ['auth', 'login', 'token', 'oauth', 'session', 'password'],
  sql: ['sql', 'query', 'database', 'migration', 'schema', 'db'],
  api: ['api', 'endpoint', 'rest', 'route', 'request'],
  debug: ['debug', 'bug', 'crash', 'exception', 'stack trace'],
};

const DAILY_HINTS = ['daily', 'every day', 'each day', 'standup', 'stand-up'];
const HABIT_HINTS = ['habit', 'routine', 'practice', 'recurring'];
const HIGH_PRIORITY_HINTS = ['urgent', 'asap', 'critical', 'high priority', 'production', 'prod', 'blocker'];
const LOW_PRIORITY_HINTS = ['low priority', 'whenever', 'someday', 'minor', 'small'];

function includesAny(text, phrases) {
  return phrases.some((p) => text.includes(p));
}

function detectCategory(text) {
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (includesAny(text, keywords)) return category;
  }
  return 'backend';
}

function detectColumn(text) {
  if (includesAny(text, DAILY_HINTS)) return 'dailies';
  if (includesAny(text, HABIT_HINTS)) return 'habits';
  return 'todos';
}

function detectPriority(text) {
  if (includesAny(text, HIGH_PRIORITY_HINTS)) return 'h';
  if (includesAny(text, LOW_PRIORITY_HINTS)) return 'l';
  return 'm';
}

// Trim filler the way a human jotting the task down would.
function cleanName(transcript) {
  return transcript
    .replace(/^(please\s+|can you\s+|i need to\s+|remind me to\s+|todo:?\s*)/i, '')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function parseTaskIntent(transcript) {
  const text = transcript.toLowerCase();
  return {
    column: detectColumn(text),
    name: cleanName(transcript) || transcript,
    category: detectCategory(text),
    priority: detectPriority(text),
  };
}

module.exports = { parseTaskIntent };
