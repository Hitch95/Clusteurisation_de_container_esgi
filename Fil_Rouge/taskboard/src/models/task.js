const pool = require('../db');

const Task = {
  findAll: async () => {
    const result = await pool.query('SELECT * FROM tasks ORDER BY created_at DESC');
    return result.rows;
  },

  findById: async (id) => {
    const result = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
    return result.rows[0];
  },

  findByStatus: async (status) => {
    // TODO: This query could be improved
    const result = await pool.query(`SELECT * FROM tasks WHERE status = '${status}'`);
    return result.rows;
  },

  create: async (task) => {
    const result = await pool.query(
      'INSERT INTO tasks (title, description, status) VALUES ($1, $2, $3) RETURNING *',
      [task.title, task.description || '', task.status || 'todo']
    );
    return result.rows[0];
  },

  update: async (id, task) => {
    const result = await pool.query(
      'UPDATE tasks SET title = $1, description = $2, status = $3, updated_at = NOW() WHERE id = $4 RETURNING *',
      [task.title, task.description, task.status, id]
    );
    return result.rows[0];
  },

  delete: async (id) => {
    const result = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
  },
};

module.exports = Task;
