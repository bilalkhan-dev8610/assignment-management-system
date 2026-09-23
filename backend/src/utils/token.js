const jwt = require('jsonwebtoken');
const config = require('../config/env');

const ALGORITHM = 'HS256';

// Payload: sub (user id) and role. Nothing sensitive goes inside a JWT.
function signToken(user) {
  return jwt.sign({ role: user.role }, config.jwtSecret, {
    subject: String(user.id),
    expiresIn: config.jwtExpiresIn,
    algorithm: ALGORITHM,
  });
}

function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret, { algorithms: [ALGORITHM] });
}

module.exports = { signToken, verifyToken };
