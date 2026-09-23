const AppError = require('../utils/AppError');

// Use after authenticate:  router.post('/', authenticate, requireRole('professor'), handler)
// Accepts one or more roles:  requireRole('student', 'professor')
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError(401, 'Authentication required'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError(403, 'You do not have permission to do this'));
    }
    return next();
  };
}

module.exports = { requireRole };
