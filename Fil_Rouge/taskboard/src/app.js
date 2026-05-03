const express = require('express');
const path = require('path');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const { loggingMiddleware } = require('./middleware/logging');
const { errorHandler } = require('./middleware/errors');
const pool = require('./db');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(loggingMiddleware);

// Serve static frontend
app.use(express.static(path.join(__dirname, '..', 'public')));

// Routes
app.use('/auth', authRoutes);
app.use('/tasks', taskRoutes);

// Health check
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('Health check failed:', err.message);
    res.status(503).json({ status: 'error', message: 'Database connection failed' });
  }
});

// Metrics endpoint — to be implemented
app.get('/metrics', (req, res) => {
  res.status(501).json({ message: 'Metrics endpoint not yet implemented' });
});

// Error handler (must be last)
app.use(errorHandler);

module.exports = app;
