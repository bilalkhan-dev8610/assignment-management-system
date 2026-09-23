// Applies schema.sql to the database in DATABASE_URL. Run with: npm run db:init
const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');

async function init() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  try {
    await pool.query(sql);
    const { rows } = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    );
    console.log('Schema applied. Tables:', rows.map((r) => r.table_name).join(', '));
  } catch (err) {
    console.error('Failed to apply schema:', err.message || err.code || err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

init();
