const test = require('node:test');
const assert = require('node:assert/strict');
const { validateGroup } = require('../src/utils/validators');

test('group: an empty body is valid (just the creator, who leads)', () => {
  const { errors, value } = validateGroup({});
  assert.deepEqual(errors, {});
  assert.deepEqual(value, { member_ids: [], leader_id: undefined });
  assert.deepEqual(validateGroup(undefined).errors, {});
});

test('group: member ids and leader id are read as numbers', () => {
  const { errors, value } = validateGroup({ member_ids: [4, '5'], leader_id: '4' });
  assert.deepEqual(errors, {});
  assert.deepEqual(value, { member_ids: [4, 5], leader_id: 4 });
});

test('group: member_ids must be a list of positive whole numbers', () => {
  for (const member_ids of ['4', 4, {}, [0], [-1], ['a'], [1.5], [null], [[1]], [1, undefined]]) {
    assert.ok(validateGroup({ member_ids }).errors.member_ids, `should reject ${JSON.stringify(member_ids)}`);
  }
});

test('group: the same student listed twice is rejected', () => {
  assert.ok(validateGroup({ member_ids: [4, 4] }).errors.member_ids);
  assert.ok(validateGroup({ member_ids: [4, '4'] }).errors.member_ids);
});

test('group: an oversized list is rejected before it reaches the database', () => {
  assert.ok(validateGroup({ member_ids: Array.from({ length: 51 }, (_, i) => i + 1) }).errors.member_ids);
});

test('group: leader_id must be a positive whole number when sent', () => {
  for (const leader_id of ['x', 0, -3, 2.5, {}]) {
    assert.ok(validateGroup({ leader_id }).errors.leader_id, `should reject ${JSON.stringify(leader_id)}`);
  }
  assert.equal(validateGroup({ leader_id: null }).errors.leader_id, undefined);
});
