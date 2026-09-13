# VoxOps

A gamified, AI-powered work OS. Habits, dailies, and to-dos earn XP and coins
like an RPG; a voice pipeline turns spoken tasks into structured board items;
stale to-dos can be handed off to an n8n automation.

Runs with **zero external services** — no database server, no API keys.

## How it works

```
🎙️ mic ─▶ browser Speech Recognition ─▶ transcript ─▶ local intent parser ─▶ task row (SQLite)
                                                              │
                                                              ▼
                                                {column, name, category, priority}
```

- **Voice → task pipeline**: the browser's built-in Speech Recognition API
  (Chrome/Edge) transcribes speech directly — no audio upload, no API key.
  The transcript is sent to `/api/voice`, where a small keyword-based
  classifier (`server/services/intent.js`) decides which column it belongs
  on and what category/priority it gets, and the result is written straight
  to the board. It's a real pipeline end to end; the "AI" step is a local
  heuristic instead of a hosted model, which is what makes it runnable
  without any account or key.
- **Persistence**: SQLite via Node's built-in `node:sqlite` — the database
  file is created automatically at `server/data/voxops.db` on first boot.
  No server to install, no connection string to configure. Every board
  (habits, dailies, todos, rewards), the XP/level/coin economy, and workflow
  records persist across restarts, and each account has its own board.
- **Auth**: email + password, hashed with bcrypt, sessions via an httpOnly
  JWT cookie. Logging in with an email that doesn't exist yet creates the
  account on the spot (this is a portfolio project people click into cold).
- **Team mode**: every account joins one shared team board. Adding or
  completing a shared task logs a real activity-feed entry other members see;
  personal habit/daily/todo completions stay private to your own board.
- **n8n automation** *(optional)*: once a task has been completed 3+ times,
  you can deploy a workflow (Slack ping / email digest / calendar block). If
  `N8N_WEBHOOK_URL` is set, the backend actually POSTs the task + chosen
  action to it. If it isn't, the workflow is still generated and saved —
  it's just marked undelivered instead of pretending to reach a webhook that
  doesn't exist.

## Stack

Vanilla HTML/CSS/JS frontend (`public/index.html`) served by a Node.js +
Express backend (`server/`), SQLite (`node:sqlite`, built into Node — no
package to install) for storage, the browser's Speech Recognition API +
a local heuristic for the voice pipeline, and n8n for optional workflow
automation.

## Setup

```bash
npm install
npm start        # http://localhost:4000
```

That's it — no `.env` required. Copy `.env.example` to `.env` only if you
want to change the port, set a real `JWT_SECRET` for a non-local deployment,
or wire up a real `N8N_WEBHOOK_URL`.

Requires Node **22.5+** (for `node:sqlite`). Voice input requires Chrome or
Edge — Speech Recognition isn't implemented in Firefox/Safari yet; the app
tells you so instead of failing silently.

## API

| Route | What it does |
|---|---|
| `POST /api/auth/login` | Log in, or create the account if the email is new |
| `POST /api/auth/logout` | Clear the session cookie |
| `GET /api/state` | Full board + profile for the logged-in user |
| `POST /api/tasks` | Create a habit/daily/todo/reward |
| `POST /api/tasks/:id/complete` | Habit +/- click (streak, XP, coins) |
| `POST /api/tasks/:id/toggle` | Daily/todo checkbox |
| `POST /api/tasks/rewards/:id/buy` | Redeem a reward for coins |
| `DELETE /api/tasks/:id` | Remove a task |
| `GET /api/team` | Shared team board: members, activity, tasks |
| `POST /api/team/tasks` | Add a shared task |
| `POST /api/team/tasks/:id/toggle` | Toggle a shared task |
| `GET /api/workflows` / `POST /api/workflows` | List / deploy an n8n workflow |
| `POST /api/voice` | `{transcript}` in, parsed + created task out |

## Key features
- Voice-activated task entry (real speech recognition → structured task)
- Automatic task classification (column/category/priority) from what you say
- XP/level/coin gamification with milestone rewards
- Team dashboard with a live activity feed
- Optional n8n-backed workflow automation for stale tasks
