const { Pool } = require('pg');
const config = require('../config/env');

const pool = new Pool({ connectionString: config.databaseUrl });

// An idle client can error (e.g. the database restarts). Log it instead of crashing.
pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL error:', err.message);
});

const query = (text, params) => pool.query(text, params);

// Runs work(query) on one connection inside BEGIN ... COMMIT; any error rolls everything back.
async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work((text, params) => client.query(text, params));
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
