const { query } = require('../db/pool');

// Never select the password column unless it is needed for a login check.
const PUBLIC_COLUMNS = 'id, name, email, role, created_at';

async function createUser({ name, email, passwordHash, role }) {
  const { rows } = await query(
    `INSERT INTO users (name, email, password, role)
     VALUES ($1, $2, $3, $4)
     RETURNING ${PUBLIC_COLUMNS}`,
    [name, email, passwordHash, role]
  );
  return rows[0];
}

async function findByEmail(email) {
  const { rows } = await query(`SELECT ${PUBLIC_COLUMNS}, password FROM users WHERE email = $1`, [email]);
  return rows[0];
}

async function findById(id) {
  const { rows } = await query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id]);
  return rows[0];
}

module.exports = { createUser, findByEmail, findById };
