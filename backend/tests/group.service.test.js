// Tests the rules of group.service: who may create, view and acknowledge a group.
// PostgreSQL is replaced by a small in-memory fake that understands only the queries
// group.service sends (course.service is replaced by a stand-in with the same access
// rules). So this checks the rules and status codes; the SQL itself, the transaction
// and the database constraints are only exercised against a real PostgreSQL.
const test = require('node:test');
const assert = require('node:assert/strict');
const AppError = require('../src/utils/AppError');

const db = { users: [], courses: [], enrollments: [], assignments: [], groups: [], submissions: [], nextId: 1 };

const userName = (id) => db.users.find((u) => u.id === id).name;

function groupRow(g) {
  const a = db.assignments.find((x) => x.id === g.assignment_id);
  const s = db.submissions.find((x) => x.group_id === g.id);
  return {
    id: g.id, assignment_id: g.assignment_id, leader_id: g.leader_id, created_at: new Date(0),
    assignment_title: a.title, assignment_deadline: a.deadline, course_id: a.course_id, submission_type: a.submission_type,
    leader_name: userName(g.leader_id),
    members: g.members.map((id) => ({ id, name: userName(id) })).sort((x, y) => x.name.localeCompare(y.name)),
    submission_status: s ? s.status : 'not_submitted',
    submitted_at: s ? s.submitted_at : null,
    submission_content: s ? s.content : null,
    acknowledged_at: s ? s.acknowledged_at : null,
    submitted_by_name: s ? userName(s.student_id) : null,
  };
}

async function fakeQuery(text, params = []) {
  const sql = text.replace(/\s+/g, ' ').trim();

  if (sql.startsWith('SELECT id, course_id, submission_type FROM assignments WHERE id = $1')) {
    const a = db.assignments.find((x) => x.id === params[0]);
    return { rows: a ? [a] : [] };
  }
  if (sql.includes('FROM users u JOIN course_enrollments e ON e.student_id = u.id AND e.course_id = $2')) {
    const [ids, courseId] = params;
    return { rows: db.users.filter((u) => u.role === 'student' && ids.includes(u.id)
      && db.enrollments.some((e) => e.course_id === courseId && e.student_id === u.id)).map((u) => ({ id: u.id })) };
  }
  if (sql.includes('FROM group_members gm JOIN groups g ON g.id = gm.group_id JOIN users u ON u.id = gm.student_id')) {
    const [assignmentId, ids] = params;
    const rows = db.groups.filter((g) => g.assignment_id === assignmentId)
      .flatMap((g) => g.members).filter((id) => ids.includes(id))
      .map((id) => ({ id, name: userName(id) })).sort((a, b) => a.name.localeCompare(b.name));
    return { rows };
  }
  if (sql.startsWith('INSERT INTO groups')) {
    const group = { id: db.nextId++, assignment_id: params[0], leader_id: params[1], members: [] };
    db.groups.push(group);
    return { rows: [{ id: group.id }] };
  }
  if (sql.startsWith('INSERT INTO group_members')) {
    const group = db.groups.find((g) => g.id === params[0]);
    group.members.push(...params[1]);
    return { rows: [] };
  }
  if (sql.includes('FROM groups g JOIN assignments a') && sql.includes('WHERE g.id = $1')) {
    const g = db.groups.find((x) => x.id === params[0]);
    return { rows: g ? [groupRow(g)] : [] };
  }
  if (sql.includes('FROM groups g JOIN assignments a') && sql.includes('EXISTS (SELECT 1 FROM group_members m')) {
    return { rows: db.groups.filter((g) => g.assignment_id === params[0] && g.members.includes(params[1])).map(groupRow) };
  }
  if (sql.includes('FROM groups g JOIN assignments a') && sql.includes('WHERE g.assignment_id = $1')) {
    const status = params[1];
    return { rows: db.groups.filter((g) => g.assignment_id === params[0]).map(groupRow)
      .filter((r) => !status || r.submission_status === status) };
  }
  if (sql.includes('FROM course_enrollments e JOIN users u ON u.id = e.student_id')) {
    const [courseId, me, assignmentId] = params;
    const grouped = db.groups.filter((g) => g.assignment_id === assignmentId).flatMap((g) => g.members);
    return { rows: db.enrollments.filter((e) => e.course_id === courseId).map((e) => db.users.find((u) => u.id === e.student_id))
      .filter((u) => u.role === 'student' && u.id !== me && !grouped.includes(u.id))
      .map((u) => ({ id: u.id, name: u.name })).sort((a, b) => a.name.localeCompare(b.name)) };
  }
  if (sql.startsWith('UPDATE submissions SET acknowledged_at')) {
    const s = db.submissions.find((x) => x.group_id === params[0] && x.acknowledged_at === null);
    if (s) Object.assign(s, { acknowledged_at: new Date(), acknowledged_by: params[1] });
    return { rows: s ? [{ id: 1 }] : [] };
  }
  throw new Error(`fake db does not understand: ${sql}`);
}

const fakeCourseService = {
  async getCourseForUser(courseId, user) {
    const course = db.courses.find((c) => c.id === courseId);
    if (!course) throw new AppError(404, 'Course not found');
    if (user.role === 'professor') {
      if (course.professor_id !== user.id) throw new AppError(403, 'You can only view your own courses');
    } else if (!db.enrollments.some((e) => e.course_id === courseId && e.student_id === user.id)) {
      throw new AppError(403, 'You are not enrolled in this course');
    }
    return course;
  },
};

const stub = (modulePath, exports) => {
  const resolved = require.resolve(modulePath);
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
};
stub('../src/db/pool', { query: fakeQuery, pool: {}, withTransaction: async (work) => work(fakeQuery) });
stub('../src/config/env', { groupMaxMembers: 3 });
stub('../src/services/course.service', fakeCourseService);
const svc = require('../src/services/group.service');

const PROF_A = { id: 1, name: 'Prof A', email: 'a@uni.edu', role: 'professor' };
const PROF_B = { id: 2, name: 'Prof B', email: 'b@uni.edu', role: 'professor' };
const ANA = { id: 3, name: 'Ana', email: 'ana@uni.edu', role: 'student' };
const BEN = { id: 4, name: 'Ben', email: 'ben@uni.edu', role: 'student' };
const CY = { id: 5, name: 'Cy', email: 'cy@uni.edu', role: 'student' };
const DAN = { id: 6, name: 'Dan', email: 'dan@uni.edu', role: 'student' };
const EVE = { id: 7, name: 'Eve', email: 'eve@uni.edu', role: 'student' }; // only in course 2
const asUser = (u) => ({ id: u.id, role: u.role });

const GROUP_ASSIGNMENT = 1; // course 1, group
const INDIVIDUAL_ASSIGNMENT = 2; // course 1, individual
const OTHER_COURSE_GROUP_ASSIGNMENT = 3; // course 2, group

test.beforeEach(() => {
  db.users = [PROF_A, PROF_B, ANA, BEN, CY, DAN, EVE];
  db.courses = [{ id: 1, professor_id: PROF_A.id }, { id: 2, professor_id: PROF_B.id }];
  db.enrollments = [ANA, BEN, CY, DAN].map((u) => ({ course_id: 1, student_id: u.id }))
    .concat([{ course_id: 2, student_id: EVE.id }]);
  const deadline = '2099-01-01T00:00:00.000Z';
  db.assignments = [
    { id: 1, course_id: 1, title: 'Team project', deadline, submission_type: 'group' },
    { id: 2, course_id: 1, title: 'Essay', deadline, submission_type: 'individual' },
    { id: 3, course_id: 2, title: 'Lab', deadline, submission_type: 'group' },
  ];
  db.groups = [];
  db.submissions = [];
  db.nextId = 1;
});

const rejectsWith = (promise, status) =>
  assert.rejects(promise, (err) => {
    assert.equal(err.statusCode, status, `expected ${status}, got ${err.statusCode}: ${err.message}`);
    return true;
  });

const create = (user, body = {}, assignmentId = GROUP_ASSIGNMENT) => svc.createGroup(assignmentId, asUser(user), body);
const submitFor = (group, by) =>
  db.submissions.push({ group_id: group.id, student_id: by.id, status: 'submitted', content: 'team work',
    submitted_at: new Date(), acknowledged_at: null });

// ------------------------------------------------------------------ create

test('create: the group is linked to the assignment, the creator is a member and leads by default', async () => {
  const group = await create(ANA, { member_ids: [BEN.id] });
  assert.equal(group.assignment.id, GROUP_ASSIGNMENT);
  assert.equal(group.leader.id, ANA.id);
  assert.deepEqual(group.members.map((m) => m.name), ['Ana', 'Ben']);
  assert.ok(group.members.some((m) => m.id === group.leader.id), 'the leader is one of the members');
  assert.equal(group.submission.status, 'not_submitted');
  assert.equal(group.submission.acknowledged, false);
  assert.equal(db.groups.length, 1);
});

test('create: the leader can be another member', async () => {
  const group = await create(ANA, { member_ids: [BEN.id], leader_id: BEN.id });
  assert.equal(group.leader.name, 'Ben');
});

test('create: a group of one (just the creator) is allowed, and listing the creator again changes nothing', async () => {
  assert.equal((await create(ANA)).members.length, 1);
  db.groups = [];
  assert.equal((await create(ANA, { member_ids: [ANA.id, BEN.id] })).members.length, 2);
});

test('create: a leader who is not a member is 400 and nothing is stored', async () => {
  await assert.rejects(create(ANA, { member_ids: [BEN.id], leader_id: CY.id }), (err) => {
    assert.equal(err.statusCode, 400);
    assert.ok(err.errors.leader_id);
    return true;
  });
  assert.equal(db.groups.length, 0);
});

test('create: the size limit (3 here) is enforced, the limit itself is allowed', async () => {
  await create(ANA, { member_ids: [BEN.id, CY.id] }); // exactly 3
  db.groups = [];
  await assert.rejects(create(ANA, { member_ids: [BEN.id, CY.id, DAN.id] }), (err) => {
    assert.equal(err.statusCode, 400);
    assert.ok(err.errors.member_ids);
    return true;
  });
  assert.equal(db.groups.length, 0);
});

test('create: a nonexistent user, a student from another course and a professor are all 400', async () => {
  for (const bad of [999, EVE.id, PROF_B.id]) {
    await rejectsWith(create(ANA, { member_ids: [bad] }), 400);
  }
  assert.equal(db.groups.length, 0);
});

test('create: a student not enrolled in the course is 403, a professor 403, a missing assignment 404', async () => {
  await rejectsWith(create(EVE), 403);
  await rejectsWith(svc.createGroup(GROUP_ASSIGNMENT, asUser(PROF_A), {}), 403);
  await rejectsWith(create(ANA, {}, 999), 404);
  assert.equal(db.groups.length, 0);
});

test('create: an individual assignment cannot have groups', async () => {
  await rejectsWith(create(ANA, {}, INDIVIDUAL_ASSIGNMENT), 409);
  assert.equal(db.groups.length, 0);
});

test('create: nobody can be in two groups for one assignment (creator or invited student)', async () => {
  await create(ANA, { member_ids: [BEN.id] });
  await rejectsWith(create(ANA), 409); // creator already grouped
  await assert.rejects(create(CY, { member_ids: [BEN.id] }), (err) => { // invited student already grouped
    assert.equal(err.statusCode, 409);
    assert.match(err.message, /Ben/);
    return true;
  });
  assert.equal(db.groups.length, 1);
});

test('create: the same student can be in groups for different assignments', async () => {
  db.enrollments.push({ course_id: 2, student_id: ANA.id });
  await create(ANA, {}, GROUP_ASSIGNMENT);
  await create(ANA, {}, OTHER_COURSE_GROUP_ASSIGNMENT);
  assert.equal(db.groups.length, 2);
});

// -------------------------------------------------------------------- list

test('list (professor): the owner sees every group with leader, members, status and acknowledgement', async () => {
  const g1 = await create(ANA, { member_ids: [BEN.id] });
  await create(CY);
  submitFor(g1, BEN);
  const groups = await svc.listAssignmentGroups(GROUP_ASSIGNMENT, asUser(PROF_A));
  assert.equal(groups.length, 2);
  const first = groups.find((g) => g.id === g1.id);
  assert.equal(first.leader.name, 'Ana');
  assert.equal(first.submission.status, 'submitted');
  assert.equal(first.submission.acknowledged, false);
});

test('list (professor): filter by submission status', async () => {
  const g1 = await create(ANA);
  await create(CY);
  submitFor(g1, ANA);
  assert.deepEqual((await svc.listAssignmentGroups(GROUP_ASSIGNMENT, asUser(PROF_A), 'submitted')).map((g) => g.id), [g1.id]);
  assert.equal((await svc.listAssignmentGroups(GROUP_ASSIGNMENT, asUser(PROF_A), 'not_submitted')).length, 1);
});

test('list (professor): another professor 403, an individual assignment 409', async () => {
  await rejectsWith(svc.listAssignmentGroups(GROUP_ASSIGNMENT, asUser(PROF_B)), 403);
  await rejectsWith(svc.listAssignmentGroups(INDIVIDUAL_ASSIGNMENT, asUser(PROF_A)), 409);
});

test('list (student): only their own group; a student without one gets an empty list', async () => {
  await create(ANA, { member_ids: [BEN.id] });
  await create(CY);
  assert.deepEqual((await svc.listAssignmentGroups(GROUP_ASSIGNMENT, asUser(BEN))).map((g) => g.leader.name), ['Ana']);
  assert.deepEqual(await svc.listAssignmentGroups(GROUP_ASSIGNMENT, asUser(DAN)), []);
});

test('list (student): a student not enrolled in the course is 403', async () => {
  await rejectsWith(svc.listAssignmentGroups(GROUP_ASSIGNMENT, asUser(EVE)), 403);
});

// ----------------------------------------------------------------- details

test('details: members and the owning professor can open a group', async () => {
  const group = await create(ANA, { member_ids: [BEN.id] });
  for (const viewer of [ANA, BEN, PROF_A]) {
    assert.equal((await svc.getGroupForUser(group.id, asUser(viewer))).id, group.id);
  }
});

test('details: a student who is not a member, another professor and an outsider are 403; missing group 404', async () => {
  const group = await create(ANA, { member_ids: [BEN.id] });
  await rejectsWith(svc.getGroupForUser(group.id, asUser(CY)), 403);
  await rejectsWith(svc.getGroupForUser(group.id, asUser(EVE)), 403);
  await rejectsWith(svc.getGroupForUser(group.id, asUser(PROF_B)), 403);
  await rejectsWith(svc.getGroupForUser(999, asUser(ANA)), 404);
});

test('details: no emails or other private fields are exposed', async () => {
  const group = await create(ANA, { member_ids: [BEN.id] });
  const text = JSON.stringify(await svc.getGroupForUser(group.id, asUser(BEN)));
  assert.ok(!/@uni\.edu|password|token/i.test(text));
  assert.deepEqual(Object.keys(group.members[0]).sort(), ['id', 'name']);
});

// -------------------------------------------------------------- candidates

test('candidates: classmates not yet in a group, without the requester, plus the size limit', async () => {
  await create(BEN);
  const { students, max_members: max } = await svc.listCandidates(GROUP_ASSIGNMENT, asUser(ANA));
  assert.deepEqual(students.map((s) => s.name), ['Cy', 'Dan']);
  assert.deepEqual(Object.keys(students[0]).sort(), ['id', 'name']);
  assert.equal(max, 3);
});

test('candidates: not for professors, unenrolled students or individual assignments', async () => {
  await rejectsWith(svc.listCandidates(GROUP_ASSIGNMENT, asUser(PROF_A)), 403);
  await rejectsWith(svc.listCandidates(GROUP_ASSIGNMENT, asUser(EVE)), 403);
  await rejectsWith(svc.listCandidates(INDIVIDUAL_ASSIGNMENT, asUser(ANA)), 409);
});

// ------------------------------------------------------------- acknowledge

test('acknowledge: the leader acknowledges once the group has submitted, and every member then sees it', async () => {
  const group = await create(ANA, { member_ids: [BEN.id, CY.id] });
  submitFor(group, BEN);
  const after = await svc.acknowledgeGroup(group.id, asUser(ANA));
  assert.equal(after.submission.acknowledged, true);
  for (const viewer of [ANA, BEN, CY, PROF_A]) {
    const seen = await svc.getGroupForUser(group.id, asUser(viewer));
    assert.equal(seen.submission.acknowledged, true, `${viewer.name} sees acknowledged`);
  }
});

test('acknowledge: a normal member is 403 and nothing changes', async () => {
  const group = await create(ANA, { member_ids: [BEN.id] });
  submitFor(group, BEN);
  await assert.rejects(svc.acknowledgeGroup(group.id, asUser(BEN)), (err) => {
    assert.equal(err.statusCode, 403);
    assert.match(err.message, /leader/); // members are told only the leader can acknowledge
    return true;
  });
  assert.equal(db.submissions[0].acknowledged_at, null);
  assert.equal((await svc.getGroupForUser(group.id, asUser(ANA))).submission.acknowledged, false);
});

test('acknowledge: a student outside the group is 403, a professor 403, an unknown group 404', async () => {
  const group = await create(ANA, { member_ids: [BEN.id] });
  submitFor(group, ANA);
  await assert.rejects(svc.acknowledgeGroup(group.id, asUser(CY)), (err) => {
    assert.equal(err.statusCode, 403);
    assert.match(err.message, /not a member/); // outsiders are told they are not in the group
    return true;
  });
  await rejectsWith(svc.acknowledgeGroup(group.id, asUser(PROF_A)), 403);
  await rejectsWith(svc.acknowledgeGroup(999, asUser(ANA)), 404);
  assert.equal(db.submissions[0].acknowledged_at, null);
});

test('acknowledge: before the group has submitted is 409', async () => {
  const group = await create(ANA);
  await rejectsWith(svc.acknowledgeGroup(group.id, asUser(ANA)), 409);
});

test('acknowledge: a second acknowledgement is 409 and keeps the first', async () => {
  const group = await create(ANA);
  submitFor(group, ANA);
  await svc.acknowledgeGroup(group.id, asUser(ANA));
  const first = db.submissions[0].acknowledged_at;
  await rejectsWith(svc.acknowledgeGroup(group.id, asUser(ANA)), 409);
  assert.equal(db.submissions[0].acknowledged_at, first);
});

test('acknowledge: acknowledging never creates extra submissions', async () => {
  const group = await create(ANA, { member_ids: [BEN.id, CY.id] });
  submitFor(group, CY);
  await svc.acknowledgeGroup(group.id, asUser(ANA));
  assert.equal(db.submissions.length, 1);
});
