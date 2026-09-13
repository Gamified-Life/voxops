require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const { initSchema } = require('./db');

const authRoutes = require('./routes/auth');
const stateRoutes = require('./routes/state');
const { router: taskRoutes } = require('./routes/tasks');
const { router: teamRoutes } = require('./routes/team');
const workflowRoutes = require('./routes/workflows');
const voiceRoutes = require('./routes/voice');

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/state', stateRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/voice', voiceRoutes);

const PORT = process.env.PORT || 4000;

try {
  initSchema();
  app.listen(PORT, () => console.log(`VoxOps backend listening on :${PORT}`));
} catch (err) {
  console.error('Failed to initialise database schema:', err.message);
  process.exit(1);
}
