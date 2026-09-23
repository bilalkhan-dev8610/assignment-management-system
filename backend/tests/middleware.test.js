const test = require('node:test');
const assert = require('node:assert/strict');
const { requireRole } = require('../src/middleware/role');
const { notFound, errorHandler } = require('../src/middleware/errorHandler');
const AppError = require('../src/utils/AppError');

// Runs a middleware and returns whatever it passed to next().
function run(middleware, req) {
  let result;
  middleware(req, {}, (arg) => {
    result = arg;
  });
  return result;
}

function fakeRes() {
  return {
    headersSent: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('requireRole: allows a matching role', () => {
  assert.equal(run(requireRole('professor'), { user: { id: 1, role: 'professor' } }), undefined);
});

test('requireRole: allows any of several roles', () => {
  assert.equal(run(requireRole('student', 'professor'), { user: { id: 1, role: 'student' } }), undefined);
});

test('requireRole: rejects the wrong role with 403', () => {
  const err = run(requireRole('professor'), { user: { id: 1, role: 'student' } });
  assert.equal(err.statusCode, 403);
});

test('requireRole: rejects a missing req.user with 401', () => {
  assert.equal(run(requireRole('student'), {}).statusCode, 401);
});

test('notFound: forwards a 404 AppError', () => {
  const err = run(notFound, { method: 'GET', originalUrl: '/api/nope' });
  assert.equal(err.statusCode, 404);
});

test('errorHandler: AppError keeps its status, message and field errors', () => {
  const res = fakeRes();
  errorHandler(new AppError(400, 'Validation failed', { email: 'bad' }), {}, res, () => {});
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { success: false, message: 'Validation failed', errors: { email: 'bad' } });
});

test('errorHandler: malformed JSON becomes 400', () => {
  const res = fakeRes();
  errorHandler(Object.assign(new Error('x'), { type: 'entity.parse.failed' }), {}, res, () => {});
  assert.equal(res.statusCode, 400);
});

test('errorHandler: unexpected errors become 500 without leaking details', () => {
  const res = fakeRes();
  const originalLog = console.error;
  console.error = () => {};
  try {
    errorHandler(new Error('connection string postgres://secret'), {}, res, () => {});
  } finally {
    console.error = originalLog;
  }
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.message, 'Internal server error');
  assert.ok(!JSON.stringify(res.body).includes('secret'));
});
