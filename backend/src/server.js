const config = require('./config/env');
const app = require('./app');
const { pool } = require('./db/pool');

async function start() {
  try {
    await pool.query('SELECT 1');
    console.log('PostgreSQL connected');
  } catch (err) {
    console.error('Could not connect to PostgreSQL:', err.message || err.code || err);
    process.exit(1);
  }

  const server = app.listen(config.port, () => {
    console.log(`API running on http://localhost:${config.port}/api`);
  });

  const shutdown = () => {
    server.close(() => pool.end().then(() => process.exit(0)));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start();
