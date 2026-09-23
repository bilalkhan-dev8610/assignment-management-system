require('dotenv').config();

const required = ['DATABASE_URL', 'JWT_SECRET'];
const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(
    `Missing required environment variables: ${missing.join(', ')}\n` +
      'Copy backend/.env.example to backend/.env and fill in the values.'
  );
  process.exit(1);
}

// Largest allowed group, leader included. Optional; 4 when not set.
const groupMaxMembers = process.env.GROUP_MAX_MEMBERS === undefined ? 4 : Number(process.env.GROUP_MAX_MEMBERS);
if (!Number.isInteger(groupMaxMembers) || groupMaxMembers < 1) {
  console.error('GROUP_MAX_MEMBERS must be a whole number of at least 1');
  process.exit(1);
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: '1d',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  groupMaxMembers,
};
