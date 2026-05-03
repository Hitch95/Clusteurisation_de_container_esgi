require('dotenv').config();

const app = require('./app');
const pool = require('./db');
const bcrypt = require('bcryptjs');

const PORT = process.env.PORT || 3000;
const DEFAULT_ADMIN_USERNAME = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD;

const initDb = async () => {
  console.log('Initializing database...');

  // Create tables
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT DEFAULT '',
      status VARCHAR(20) DEFAULT 'todo' CHECK (status IN ('todo', 'in-progress', 'done')),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Seed default admin user if no users exist and credentials are configured
  const { rows } = await pool.query('SELECT COUNT(*) FROM users');
  if (parseInt(rows[0].count, 10) === 0) {
    if (!DEFAULT_ADMIN_PASSWORD) {
      console.warn('DEFAULT_ADMIN_PASSWORD is not configured; skipping default admin user creation');
    } else {
      const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
      await pool.query(
        'INSERT INTO users (username, password) VALUES ($1, $2)',
        [DEFAULT_ADMIN_USERNAME, hashedPassword]
      );
      console.log(`Default user created — username: ${DEFAULT_ADMIN_USERNAME}`);
    }
  }

  console.log('Database initialized successfully');
};

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Taskboard API running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
