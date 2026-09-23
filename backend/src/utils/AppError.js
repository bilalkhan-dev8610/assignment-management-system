// An error we throw on purpose, carrying the HTTP status to send back.
class AppError extends Error {
  constructor(statusCode, message, errors) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errors = errors; // optional field-level messages, e.g. { email: '...' }
  }
}

module.exports = AppError;
