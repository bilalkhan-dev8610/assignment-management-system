const test = require('node:test');
const assert = require('node:assert/strict');
const { validateAssignment, validateSubmission, parseDeadline } = require('../src/utils/validators');

const valid = {
  course_id: 3,
  title: '  Essay 1 ',
  description: ' Write 500 words ',
  deadline: '2030-05-01T17:00:00Z',
  submission_type: 'individual',
};

test('parseDeadline: accepts ISO date-times and rejects everything else', () => {
  assert.equal(parseDeadline('2030-05-01T17:00:00Z').toISOString(), '2030-05-01T17:00:00.000Z');
  assert.equal(parseDeadline('2030-05-01T17:00:00+05:30').toISOString(), '2030-05-01T11:30:00.000Z');
  assert.equal(parseDeadline('2030-05-01T17:00').toISOString().slice(0, 10), '2030-05-01');
  for (const bad of ['2030-05-01', 'tomorrow', '2030-02-31T10:00:00Z', '2030-13-01T10:00:00Z', '2030-05-01T24:00:00Z',
    '2030-05-01T17:60:00Z', '0000-01-01T00:00:00Z', '', 12345, null, undefined, {}]) {
    assert.equal(parseDeadline(bad), undefined, `should reject ${JSON.stringify(bad)}`);
  }
});

test('assignment create: valid input is cleaned and the deadline normalized', () => {
  const { errors, value } = validateAssignment(valid);
  assert.deepEqual(errors, {});
  assert.deepEqual(value, {
    course_id: 3,
    title: 'Essay 1',
    description: 'Write 500 words',
    deadline: '2030-05-01T17:00:00.000Z',
    submission_type: 'individual',
  });
});

test('assignment create: every field is required', () => {
  assert.deepEqual(
    Object.keys(validateAssignment({}).errors).sort(),
    ['course_id', 'deadline', 'description', 'submission_type', 'title']
  );
});

test('assignment create: course_id must be a positive integer', () => {
  for (const course_id of [0, -1, 'abc', 1.5, null, undefined, '2147483648', [5], {}]) {
    assert.ok(validateAssignment({ ...valid, course_id }).errors.course_id, `should reject ${course_id}`);
  }
  assert.equal(validateAssignment({ ...valid, course_id: '7' }).value.course_id, 7);
});

test('assignment create: blank or oversized title and description are rejected', () => {
  assert.ok(validateAssignment({ ...valid, title: '   ' }).errors.title);
  assert.ok(validateAssignment({ ...valid, title: 'x'.repeat(201) }).errors.title);
  assert.ok(validateAssignment({ ...valid, description: '' }).errors.description);
  assert.ok(validateAssignment({ ...valid, description: 'x'.repeat(5001) }).errors.description);
  assert.ok(validateAssignment({ ...valid, title: 42 }).errors.title);
});

test('assignment create: an invalid or missing deadline is rejected', () => {
  assert.equal(validateAssignment({ ...valid, deadline: undefined }).errors.deadline, 'Deadline is required');
  assert.ok(validateAssignment({ ...valid, deadline: 'next friday' }).errors.deadline);
  assert.ok(validateAssignment({ ...valid, deadline: '2030-02-31T10:00:00Z' }).errors.deadline);
});

test('assignment create: only individual and group are valid submission types', () => {
  assert.equal(validateAssignment({ ...valid, submission_type: 'group' }).errors.submission_type, undefined);
  for (const submission_type of ['team', 'Individual', '', 5, ['group']]) {
    assert.ok(validateAssignment({ ...valid, submission_type }).errors.submission_type, `should reject ${submission_type}`);
  }
});

test('assignment create: created_by in the body is ignored', () => {
  const { value } = validateAssignment({ ...valid, created_by: 99, id: 5 });
  assert.equal(value.created_by, undefined);
  assert.equal(value.id, undefined);
});

test('assignment update: any subset is accepted and course_id is ignored', () => {
  assert.deepEqual(validateAssignment({ title: 'New' }, { partial: true }).value, { title: 'New' });
  assert.deepEqual(validateAssignment({ course_id: 9, submission_type: 'group' }, { partial: true }).value, {
    submission_type: 'group',
  });
  assert.equal(validateAssignment({ deadline: '2031-01-01T00:00:00Z' }, { partial: true }).value.deadline, '2031-01-01T00:00:00.000Z');
});

test('assignment update: sent fields must be valid and the body must not be empty', () => {
  assert.ok(validateAssignment({ title: '' }, { partial: true }).errors.title);
  assert.ok(validateAssignment({ deadline: 'soon' }, { partial: true }).errors.deadline);
  assert.ok(validateAssignment({ submission_type: 'x' }, { partial: true }).errors.submission_type);
  assert.ok(validateAssignment({}, { partial: true }).errors.body);
  assert.ok(validateAssignment({ course_id: 9 }, { partial: true }).errors.body);
});

test('submission: content is required text, trimmed, up to 5000 characters', () => {
  assert.equal(validateSubmission({ content: '  https://example.com/work  ' }).value.content, 'https://example.com/work');
  for (const content of [undefined, null, '', '   ', 42, {}, 'x'.repeat(5001)]) {
    assert.ok(validateSubmission({ content }).errors.content, `should reject ${JSON.stringify(content)?.slice(0, 20)}`);
  }
  assert.ok(validateSubmission(undefined).errors.content);
});
