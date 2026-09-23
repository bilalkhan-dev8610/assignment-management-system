const test = require('node:test');
const assert = require('node:assert/strict');
const { validateRegister, validateLogin } = require('../src/utils/validators');

const validBody = {
  name: '  Ada Lovelace ',
  email: '  Ada@Example.COM ',
  password: 'analytics1',
  role: 'professor',
};

test('register: valid input is cleaned (trimmed name, lowercased email)', () => {
  const { errors, value } = validateRegister(validBody);
  assert.deepEqual(errors, {});
  assert.equal(value.name, 'Ada Lovelace');
  assert.equal(value.email, 'ada@example.com');
  assert.equal(value.role, 'professor');
});

test('register: empty body reports every required field', () => {
  const { errors } = validateRegister({});
  assert.deepEqual(Object.keys(errors).sort(), ['email', 'name', 'password', 'role']);
});

test('register: no body at all does not throw', () => {
  const { errors } = validateRegister(undefined);
  assert.equal(Object.keys(errors).length, 4);
});

test('register: whitespace-only name is rejected', () => {
  assert.ok(validateRegister({ ...validBody, name: '   ' }).errors.name);
});

test('register: invalid emails are rejected', () => {
  for (const email of ['plain', 'a@b', '@example.com', 'a b@example.com', '', 42, null]) {
    assert.ok(validateRegister({ ...validBody, email }).errors.email, `should reject ${email}`);
  }
});

test('register: weak passwords are rejected', () => {
  for (const password of ['short1', 'allletters', '12345678', '        ', '', 12345678, undefined]) {
    assert.ok(validateRegister({ ...validBody, password }).errors.password, `should reject ${password}`);
  }
});

test('register: password longer than 72 bytes is rejected', () => {
  assert.ok(validateRegister({ ...validBody, password: 'a1'.repeat(37) }).errors.password);
});

test('register: only student and professor roles are allowed', () => {
  assert.equal(validateRegister({ ...validBody, role: 'student' }).errors.role, undefined);
  for (const role of ['admin', 'Student', '', undefined, null, ['student']]) {
    assert.ok(validateRegister({ ...validBody, role }).errors.role, `should reject ${role}`);
  }
});

test('login: valid input passes and lowercases the email', () => {
  const { errors, value } = validateLogin({ email: 'A@B.co', password: 'x' });
  assert.deepEqual(errors, {});
  assert.equal(value.email, 'a@b.co');
});

test('login: missing or malformed fields are rejected', () => {
  assert.ok(validateLogin({ email: 'nope', password: 'x' }).errors.email);
  assert.ok(validateLogin({ email: 'a@b.co', password: '' }).errors.password);
  assert.equal(Object.keys(validateLogin({}).errors).length, 2);
});
