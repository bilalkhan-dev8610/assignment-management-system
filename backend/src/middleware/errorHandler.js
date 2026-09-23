const AppError = require('../utils/AppError');

// Any request that matched no route.
function notFound(req, res, next) {
  next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

// Single place where every error becomes a JSON response:
//   { success: false, message, errors? }
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  let statusCode = 500;
  let message = 'Internal server error';
  let errors;

  if (err instanceof AppError) {
    ({ statusCode, message, errors } = err);
  } else if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Request body is not valid JSON';
  } else if (err.type === 'entity.too.large') {
    statusCode = 413;
    message = 'Request body is too large';
  } else {
    // Unexpected: log the details, but never leak them to the client.
    console.error(err);
  }

  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
}

module.exports = { notFound, errorHandler };
