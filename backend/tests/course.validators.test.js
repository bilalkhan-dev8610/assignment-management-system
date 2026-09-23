const test = require('node:test');
const assert = require('node:assert/strict');
const { validateCourse, parseId } = require('../src/utils/validators');

test('course create: valid input is cleaned and the code is upper-cased', () => {
  const { errors, value } = validateCourse({ name: '  Databases ', code: ' cs-301 ', description: '  Intro ' });
  assert.deepEqual(errors, {});
  assert.deepEqual(value, { name: 'Databases', code: 'CS-301', description: 'Intro' });
});

test('course create: name and code are required, description is optional', () => {
  assert.deepEqual(Object.keys(validateCourse({}).errors).sort(), ['code', 'name']);
  const { errors, value } = validateCourse({ name: 'A', code: 'A1' });
  assert.deepEqual(errors, {});
  assert.equal(value.description, undefined);
});

test('course create: blank, non-string and oversized values are rejected', () => {
  assert.ok(validateCourse({ name: '   ', code: 'A1' }).errors.name);
  assert.ok(validateCourse({ name: 42, code: 'A1' }).errors.name);
  assert.ok(validateCourse({ name: 'x'.repeat(201), code: 'A1' }).errors.name);
  assert.ok(validateCourse({ name: 'A', code: '   ' }).errors.code);
  assert.ok(validateCourse({ name: 'A', code: 'C'.repeat(21) }).errors.code);
  assert.ok(validateCourse({ name: 'A', code: 'CS 101!' }).errors.code);
  assert.ok(validateCourse({ name: 'A', code: '-CS101' }).errors.code);
  assert.ok(validateCourse({ name: 'A', code: 'A1', description: 'x'.repeat(2001) }).errors.description);
  assert.ok(validateCourse({ name: 'A', code: 'A1', description: 7 }).errors.description);
});

test('course create: an empty description becomes null', () => {
  assert.equal(validateCourse({ name: 'A', code: 'A1', description: '  ' }).value.description, null);
});

test('course create: owner fields in the body are ignored', () => {
  const { value } = validateCourse({ name: 'A', code: 'A1', professor_id: 99, id: 5 });
  assert.deepEqual(Object.keys(value).sort(), ['code', 'name']);
});

test('course update: any subset of fields is accepted', () => {
  assert.deepEqual(validateCourse({ name: 'New' }, { partial: true }).value, { name: 'New' });
  assert.deepEqual(validateCourse({ code: 'x9' }, { partial: true }).value, { code: 'X9' });
  assert.deepEqual(validateCourse({ description: '' }, { partial: true }).value, { description: null });
});

test('course update: sent fields must still be valid', () => {
  assert.ok(validateCourse({ name: '' }, { partial: true }).errors.name);
  assert.ok(validateCourse({ code: 'bad code!' }, { partial: true }).errors.code);
});

test('course update: an empty body is rejected', () => {
  assert.ok(validateCourse({}, { partial: true }).errors.body);
  assert.ok(validateCourse(undefined, { partial: true }).errors.body);
});

test('parseId: accepts positive integers only', () => {
  assert.equal(parseId('7'), 7);
  assert.equal(parseId('2147483647'), 2147483647);
  for (const bad of ['0', '-1', '1.5', 'abc', '', '007', '1e3', '2147483648', '99999999999', undefined]) {
    assert.equal(parseId(bad), undefined, `should reject ${bad}`);
  }
});
