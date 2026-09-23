const AppError = require('../utils/AppError');
const { verifyToken } = require('../utils/token');

// Reads "Authorization: Bearer <jwt>", verifies it and sets req.user = { id, role }.
function authenticate(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');

  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
    return next(new AppError(401, 'Authentication required'));
  }

  try {
    const payload = verifyToken(token);
    req.user = { id: Number(payload.sub), role: payload.role };
    return next();
  } catch (err) {
    const message =
      err.name === 'TokenExpiredError' ? 'Session expired. Please sign in again' : 'Invalid token';
    return next(new AppError(401, message));
  }
}

module.exports = { authenticate };
