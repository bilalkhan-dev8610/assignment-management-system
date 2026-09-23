// Tests the business and authorization rules of assignment.service.
// PostgreSQL is replaced by a small in-memory fake that understands only the
// queries assignment.service sends, and course.service and group.service (each
// tested on its own) by stand-ins with the same behavior. So this checks the rules
// (who may do what, which status code comes back); the SQL itself is only
// exercised against a real PostgreSQL.
const test = require('node:test');
const assert = require('node:assert/strict');
const AppError = require('../src/utils/AppError');

const db = { users: [], courses: [], enrollments: [], assignments: [], groups: [], submissions: [], nextId: 1, log: [] };
const pgError = (code) => Object.assign(new Error(`pg error ${code}`), { code });

function assignmentView(a) {
  const course = db.courses.find((c) => c.id === a.course_id);
  return { ...a, course_name: course.name, course_code: course.code };
}

async function fakeQuery(text, params = []) {
  const sql = text.replace(/\s+/g, ' ').trim();
  db.log.push(sql);

  if (sql.startsWith('INSERT INTO assignments')) {
    const [course_id, title, description, deadline, submission_type, created_by] = params;
    const row = { id: db.nextId++, course_id, title, description, deadline, submission_type, created_by,
      created_at: new Date(), updated_at: new Date(0) };
    db.assignments.push(row);
    return { rows: [{ id: row.id }] };
  }
  if (sql.includes('FROM assignments a JOIN courses c') && sql.includes('WHERE a.id = $1')) {
    const a = db.assignments.find((x) => x.id === params[0]);
    return { rows: a ? [assignmentView(a)] : [] };
  }
  if (sql.includes('submitted_count') && sql.includes('WHERE a.course_id = $1')) {
    const rows = db.assignments.filter((a) => a.course_id === params[0]).map((a) => ({
      ...assignmentView(a),
      submitted_count: db.submissions.filter((s) => s.assignment_id === a.id && s.status === 'submitted').length,
      student_count: db.enrollments.filter((e) => e.course_id === a.course_id).length,
    }));
    return { rows };
  }
  if (sql.includes('LEFT JOIN submissions s ON s.assignment_id = a.id') && sql.includes('WHERE a.course_id = $1')) {
    const myGroupIds = db.groups.filter((g) => g.members.includes(params[1])).map((g) => g.id);
    const rows = db.assignments.filter((a) => a.course_id === params[0]).map((a) => {
      const own = db.submissions.find((s) => s.assignment_id === a.id && (a.submission_type === 'group'
        ? myGroupIds.includes(s.group_id)
        : s.student_id === params[1]));
      return { ...assignmentView(a), submission_status: own ? own.status : 'not_submitted', submitted_at: own ? own.submitted_at : null };
    });
    return { rows };
  }
  if (sql.startsWith('SELECT 1 FROM submissions WHERE assignment_id = $1')) {
    return { rows: db.submissions.some((s) => s.assignment_id === params[0]) ? [{}] : [] };
  }
  if (sql.startsWith('SELECT 1 FROM groups WHERE assignment_id = $1')) {
    return { rows: db.groups.some((g) => g.assignment_id === params[0]) ? [{}] : [] };
  }
  if (sql.startsWith('UPDATE assignments SET')) {
    const [title, description, deadline, submission_type, id] = params;
    const a = db.assignments.find((x) => x.id === id);
    Object.assign(a, { title, description, deadline, submission_type, updated_at: new Date() });
    return { rows: [], rowCount: 1 };
  }
  if (sql.startsWith('SELECT (SELECT COUNT(*)::int FROM submissions')) {
    return { rows: [{
      submitted_count: db.submissions.filter((s) => s.assignment_id === params[0] && s.status === 'submitted').length,
      student_count: db.enrollments.filter((e) => e.course_id === params[1]).length,
    }] };
  }
  if (sql.includes('FROM course_enrollments e JOIN users u')) {
    const [assignmentId, courseId, status] = params;
    const rows = db.enrollments
      .filter((e) => e.course_id === courseId)
      .map((e) => {
        const u = db.users.find((x) => x.id === e.student_id);
        const s = db.submissions.find((x) => x.assignment_id === assignmentId && x.student_id === u.id);
        return { student_id: u.id, name: u.name, email: u.email, status: s ? s.status : 'not_submitted',
          submitted_at: s ? s.submitted_at : null, content: s ? s.content : null };
      })
      .filter((r) => !status || r.status === status)
      .sort((a, b) => a.name.localeCompare(b.name));
    return { rows };
  }
  if (sql.startsWith('INSERT INTO submissions')) {
    const [assignment_id, student_id, group_id, content] = params;
    if (db.submissions.some((s) => s.assignment_id === assignment_id && s.student_id === student_id)) throw pgError('23505');
    if (group_id !== null && db.submissions.some((s) => s.group_id === group_id)) throw pgError('23505');
    const row = { assignment_id, student_id, group_id, content, status: 'submitted', submitted_at: new Date(), acknowledged_at: null };
    db.submissions.push(row);
    return { rows: [row] };
  }
  if (sql.includes('FROM submissions s JOIN users u ON u.id = s.student_id WHERE s.group_id = $1')) {
    const s = db.submissions.find((x) => x.group_id === params[0]);
    const submitter = s && db.users.find((u) => u.id === s.student_id);
    return { rows: s ? [{ ...s, submitted_by_name: submitter.name }] : [] };
  }
  if (sql.includes('FROM submissions WHERE assignment_id = $1 AND student_id = $2')) {
    const s = db.submissions.find((x) => x.assignment_id === params[0] && x.student_id === params[1]);
    return { rows: s ? [s] : [] };
  }
  throw new Error(`fake db does not understand: ${sql}`);
}

// Same access rules as the real course.service.
const fakeCourseService = {
  async getOwnedCourse(courseId, professorId) {
    const course = db.courses.find((c) => c.id === courseId);
    if (!course) throw new AppError(404, 'Course not found');
    if (course.professor_id !== professorId) throw new AppError(403, 'You can only change your own courses');
    return course;
  },
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
stub('../src/db/pool', { query: fakeQuery, pool: {} });
stub('../src/services/course.service', fakeCourseService);
stub('../src/services/group.service', {
  async findGroupForStudent(assignmentId, studentId) {
    return db.groups.find((g) => g.assignment_id === assignmentId && g.members.includes(studentId));
  },
});
const svc = require('../src/services/assignment.service');

const PROF_A = { id: 1, name: 'Prof A', email: 'a@uni.edu', role: 'professor' };
const PROF_B = { id: 2, name: 'Prof B', email: 'b@uni.edu', role: 'professor' };
const ANA = { id: 3, name: 'Ana', email: 'ana@uni.edu', role: 'student' };
const BEN = { id: 4, name: 'Ben', email: 'ben@uni.edu', role: 'student' };
const CY = { id: 5, name: 'Cy', email: 'cy@uni.edu', role: 'student' }; // enrolled only in course 2
const asUser = (u) => ({ id: u.id, role: u.role });
const DAN = { id: 6, name: 'Dan', email: 'dan@uni.edu', role: 'student' }; // enrolled in course 1, never in a group
const CY_IN_COURSE_1 = () => DAN;

const FUTURE = '2099-01-01T00:00:00.000Z';
const PAST = '2000-01-01T00:00:00.000Z';

test.beforeEach(() => {
  db.users = [PROF_A, PROF_B, ANA, BEN, CY, DAN];
  db.courses = [
    { id: 1, name: 'Databases', code: 'CS301', professor_id: PROF_A.id },
    { id: 2, name: 'Networks', code: 'CS302', professor_id: PROF_B.id },
  ];
  db.enrollments = [
    { course_id: 1, student_id: ANA.id },
    { course_id: 1, student_id: BEN.id },
    { course_id: 1, student_id: DAN.id },
    { course_id: 2, student_id: CY.id },
  ];
  db.assignments = [];
  db.groups = [];
  db.submissions = [];
  db.nextId = 1;
  db.log = [];
});

const rejectsWith = (promise, status) =>
  assert.rejects(promise, (err) => {
    assert.equal(err.statusCode, status, `expected ${status}, got ${err.statusCode}: ${err.message}`);
    return true;
  });

const make = (overrides = {}, professor = PROF_A) =>
  svc.createAssignment(professor.id, {
    course_id: 1, title: 'Essay', description: 'Write it', deadline: FUTURE, submission_type: 'individual', ...overrides,
  });

// ------------------------------------------------------------------ create

test('create: the professor who owns the course creates it, created_by is that professor', async () => {
  const a = await make();
  assert.equal(a.created_by, PROF_A.id);
  assert.equal(a.course_id, 1);
  assert.equal(a.course_name, 'Databases');
  assert.equal(a.submission_type, 'individual');
});

test('create: another professor gets 403 and nothing is inserted', async () => {
  await rejectsWith(make({}, PROF_B), 403);
  assert.equal(db.assignments.length, 0);
  assert.ok(!db.log.some((sql) => sql.startsWith('INSERT')));
});

test('create: a course that does not exist is 404', async () => {
  await rejectsWith(make({ course_id: 999 }), 404);
});

// -------------------------------------------------------------------- list

test('list (professor): owner sees assignments with progress counts', async () => {
  const a = await make();
  await svc.submitAssignment(a.id, asUser(ANA), 'my work');
  const [row] = await svc.listCourseAssignments(1, asUser(PROF_A));
  assert.equal(row.submitted_count, 1);
  assert.equal(row.student_count, 3);
});

test('list (professor): another professor gets 403', async () => {
  await make();
  await rejectsWith(svc.listCourseAssignments(1, asUser(PROF_B)), 403);
});

test('list (student): enrolled student sees own status only, no counts', async () => {
  const a = await make();
  await svc.submitAssignment(a.id, asUser(ANA), 'my work');
  const [forAna] = await svc.listCourseAssignments(1, asUser(ANA));
  const [forBen] = await svc.listCourseAssignments(1, asUser(BEN));
  assert.equal(forAna.submission_status, 'submitted');
  assert.equal(forBen.submission_status, 'not_submitted');
  assert.equal(forBen.submitted_count, undefined);
  assert.equal(forBen.student_count, undefined);
});

test('list (student): a student not enrolled in the course gets 403; unknown course 404', async () => {
  await make();
  await rejectsWith(svc.listCourseAssignments(1, asUser(CY)), 403);
  await rejectsWith(svc.listCourseAssignments(999, asUser(ANA)), 404);
});

test('list: a course with no assignments returns an empty list', async () => {
  assert.deepEqual(await svc.listCourseAssignments(1, asUser(ANA)), []);
});

// ----------------------------------------------------------------- details

test('details: professor owner gets progress counts, enrolled student gets none', async () => {
  const a = await make();
  const asProf = await svc.getAssignmentForUser(a.id, asUser(PROF_A));
  assert.equal(asProf.student_count, 3);
  assert.equal(asProf.submitted_count, 0);
  const asStudent = await svc.getAssignmentForUser(a.id, asUser(ANA));
  assert.equal(asStudent.title, 'Essay');
  assert.equal(asStudent.submitted_count, undefined);
});

test('details: a student from an unrelated course and another professor get 403', async () => {
  const a = await make();
  await rejectsWith(svc.getAssignmentForUser(a.id, asUser(CY)), 403);
  await rejectsWith(svc.getAssignmentForUser(a.id, asUser(PROF_B)), 403);
});

test('details: a missing assignment is 404', async () => {
  await rejectsWith(svc.getAssignmentForUser(999, asUser(ANA)), 404);
});

// ------------------------------------------------------------------ update

test('update: owner changes only the fields sent and updated_at moves', async () => {
  const a = await make();
  const updated = await svc.updateAssignment(a.id, PROF_A.id, { title: 'Essay (revised)', deadline: '2098-01-01T00:00:00.000Z' });
  assert.equal(updated.title, 'Essay (revised)');
  assert.equal(updated.description, 'Write it');
  assert.equal(new Date(updated.deadline).toISOString(), '2098-01-01T00:00:00.000Z');
  assert.ok(updated.updated_at > a.updated_at);
});

test('update: another professor gets 403 and nothing is written', async () => {
  const a = await make();
  await rejectsWith(svc.updateAssignment(a.id, PROF_B.id, { title: 'Hacked' }), 403);
  assert.equal(db.assignments[0].title, 'Essay');
  assert.ok(!db.log.some((sql) => sql.startsWith('UPDATE')));
});

test('update: a missing assignment is 404', async () => {
  await rejectsWith(svc.updateAssignment(999, PROF_A.id, { title: 'x' }), 404);
});

test('update: the type can change until students have submitted, then it is locked', async () => {
  const a = await make();
  const asGroup = await svc.updateAssignment(a.id, PROF_A.id, { submission_type: 'group' });
  assert.equal(asGroup.submission_type, 'group');
  const b = await make({ title: 'Second' });
  await svc.submitAssignment(b.id, asUser(ANA), 'done');
  await rejectsWith(svc.updateAssignment(b.id, PROF_A.id, { submission_type: 'group' }), 409);
  await svc.updateAssignment(b.id, PROF_A.id, { submission_type: 'individual', title: 'Second (edited)' }); // same type is fine
});

// ------------------------------------------------------------------ submit

test('submit: an enrolled student submits and the row belongs to them', async () => {
  const a = await make();
  const s = await svc.submitAssignment(a.id, asUser(ANA), 'https://example.com/work');
  assert.equal(s.student_id, ANA.id);
  assert.equal(s.assignment_id, a.id);
  assert.equal(s.status, 'submitted');
  assert.ok(s.submitted_at);
});

test('submit: a student not enrolled in the course gets 403 and nothing is stored', async () => {
  const a = await make();
  await rejectsWith(svc.submitAssignment(a.id, asUser(CY), 'x'), 403);
  assert.equal(db.submissions.length, 0);
});

test('submit: a professor cannot submit (not a student of the course)', async () => {
  const a = await make();
  await rejectsWith(svc.submitAssignment(a.id, asUser(PROF_A), 'x'), 403);
  assert.equal(db.submissions.length, 0);
});

test('submit: a missing assignment is 404', async () => {
  await rejectsWith(svc.submitAssignment(999, asUser(ANA), 'x'), 404);
});

test('submit: after the deadline is 409 and nothing is stored', async () => {
  const a = await make({ deadline: PAST });
  await rejectsWith(svc.submitAssignment(a.id, asUser(ANA), 'late'), 409);
  assert.equal(db.submissions.length, 0);
});

test('submit: exactly at the deadline is still accepted, one moment later is not', async () => {
  const a = await make({ deadline: '2030-01-01T12:00:00.000Z' });
  await svc.submitAssignment(a.id, asUser(ANA), 'on time', new Date('2030-01-01T12:00:00.000Z'));
  await rejectsWith(svc.submitAssignment(a.id, asUser(BEN), 'late', new Date('2030-01-01T12:00:00.001Z')), 409);
});

// Puts students into a group for an assignment (what group.service does on create).
const formGroup = (assignmentId, memberIds, leaderId = memberIds[0]) => {
  const group = { id: db.groups.length + 1, assignment_id: assignmentId, leader_id: leaderId, members: memberIds };
  db.groups.push(group);
  return group;
};

test('submit (group): a student who is not in a group is 409 and nothing is stored', async () => {
  const a = await make({ submission_type: 'group' });
  await rejectsWith(svc.submitAssignment(a.id, asUser(ANA), 'x'), 409);
  assert.equal(db.submissions.length, 0);
});

test('submit (group): a member submits once, filed under the group and not per member', async () => {
  const a = await make({ submission_type: 'group' });
  const group = formGroup(a.id, [ANA.id, BEN.id]);
  const s = await svc.submitAssignment(a.id, asUser(BEN), 'team work');
  assert.equal(s.group_id, group.id);
  assert.equal(s.student_id, BEN.id); // who submitted for the group
  assert.equal(s.acknowledged, false);
  assert.equal(db.submissions.length, 1);
});

test('submit (group): the other member cannot submit again, the group already has a submission', async () => {
  const a = await make({ submission_type: 'group' });
  formGroup(a.id, [ANA.id, BEN.id]);
  await svc.submitAssignment(a.id, asUser(ANA), 'first');
  await rejectsWith(svc.submitAssignment(a.id, asUser(BEN), 'second'), 409);
  assert.equal(db.submissions.length, 1);
  assert.equal(db.submissions[0].content, 'first');
});

test('submit (group): the deadline applies to groups too', async () => {
  const a = await make({ submission_type: 'group', deadline: PAST });
  formGroup(a.id, [ANA.id]);
  await rejectsWith(svc.submitAssignment(a.id, asUser(ANA), 'late'), 409);
  assert.equal(db.submissions.length, 0);
});

test('my submission (group): every member sees the group submission; a student without a group sees not_submitted', async () => {
  const a = await make({ submission_type: 'group' });
  const group = formGroup(a.id, [ANA.id, BEN.id]);
  const before = await svc.getMySubmission(a.id, asUser(BEN));
  assert.equal(before.status, 'not_submitted');
  assert.equal(before.group_id, group.id);

  await svc.submitAssignment(a.id, asUser(ANA), 'team work');
  for (const member of [ANA, BEN]) {
    const seen = await svc.getMySubmission(a.id, asUser(member));
    assert.equal(seen.status, 'submitted');
    assert.equal(seen.group_id, group.id);
    assert.equal(seen.content, 'team work');
    assert.equal(seen.submitted_by_name, 'Ana');
    assert.equal(seen.acknowledged, false);
  }
  const outsider = await svc.getMySubmission(a.id, asUser(CY_IN_COURSE_1()));
  assert.equal(outsider.status, 'not_submitted');
  assert.equal(outsider.group_id, null);
});

test('list (student): a group submission shows as submitted for every member of the group only', async () => {
  const a = await make({ submission_type: 'group' });
  formGroup(a.id, [ANA.id]);
  await svc.submitAssignment(a.id, asUser(ANA), 'team work');
  const [forAna] = await svc.listCourseAssignments(1, asUser(ANA));
  const [forBen] = await svc.listCourseAssignments(1, asUser(BEN));
  assert.equal(forAna.submission_status, 'submitted');
  assert.equal(forBen.submission_status, 'not_submitted');
});

test('individual and group assignments in one course do not interfere', async () => {
  const individual = await make({ title: 'Solo' });
  const group = await make({ title: 'Team', submission_type: 'group' });
  formGroup(group.id, [ANA.id, BEN.id]);
  await svc.submitAssignment(individual.id, asUser(ANA), 'solo work');
  await svc.submitAssignment(group.id, asUser(BEN), 'team work');
  assert.equal(db.submissions.length, 2);
  assert.equal(db.submissions.filter((s) => s.group_id === null).length, 1);
  assert.equal((await svc.getMySubmission(individual.id, asUser(BEN))).status, 'not_submitted');
});

test('update: the type is locked once groups exist', async () => {
  const a = await make({ submission_type: 'group' });
  formGroup(a.id, [ANA.id]);
  await rejectsWith(svc.updateAssignment(a.id, PROF_A.id, { submission_type: 'individual' }), 409);
  await svc.updateAssignment(a.id, PROF_A.id, { title: 'Renamed' }); // other fields stay editable
});

test('monitoring: a group assignment is 409 (use the groups view)', async () => {
  const a = await make({ submission_type: 'group' });
  await rejectsWith(svc.listSubmissions(a.id, PROF_A.id), 409);
});

test('submit: submitting twice is 409 and keeps the first submission', async () => {
  const a = await make();
  await svc.submitAssignment(a.id, asUser(ANA), 'first');
  await rejectsWith(svc.submitAssignment(a.id, asUser(ANA), 'second'), 409);
  assert.equal(db.submissions.length, 1);
  assert.equal(db.submissions[0].content, 'first');
});

// --------------------------------------------------------- own status

test('my submission: not_submitted before, submitted with a time after', async () => {
  const a = await make();
  const before = await svc.getMySubmission(a.id, asUser(ANA));
  assert.equal(before.status, 'not_submitted');
  assert.equal(before.submitted_at, null);
  await svc.submitAssignment(a.id, asUser(ANA), 'work');
  const after = await svc.getMySubmission(a.id, asUser(ANA));
  assert.equal(after.status, 'submitted');
  assert.ok(after.submitted_at);
  assert.equal((await svc.getMySubmission(a.id, asUser(BEN))).status, 'not_submitted');
});

test('my submission: unrelated student 403, missing assignment 404', async () => {
  const a = await make();
  await rejectsWith(svc.getMySubmission(a.id, asUser(CY)), 403);
  await rejectsWith(svc.getMySubmission(999, asUser(ANA)), 404);
});

// ------------------------------------------------------ professor monitoring

test('monitoring: owner sees every enrolled student with a status', async () => {
  const a = await make();
  await svc.submitAssignment(a.id, asUser(BEN), 'ben work');
  const rows = await svc.listSubmissions(a.id, PROF_A.id);
  assert.deepEqual(rows.map((r) => [r.name, r.status]), [['Ana', 'not_submitted'], ['Ben', 'submitted'], ['Dan', 'not_submitted']]);
});

test('monitoring: filter by status', async () => {
  const a = await make();
  await svc.submitAssignment(a.id, asUser(BEN), 'ben work');
  assert.deepEqual((await svc.listSubmissions(a.id, PROF_A.id, 'submitted')).map((r) => r.name), ['Ben']);
  assert.deepEqual((await svc.listSubmissions(a.id, PROF_A.id, 'not_submitted')).map((r) => r.name), ['Ana', 'Dan']);
});

test('monitoring: rows contain only student name, email, status, time and content', async () => {
  const a = await make();
  const [row] = await svc.listSubmissions(a.id, PROF_A.id);
  assert.deepEqual(Object.keys(row).sort(), ['content', 'email', 'name', 'status', 'student_id', 'submitted_at']);
});

test('monitoring: another professor gets 403, a missing assignment 404', async () => {
  const a = await make();
  await rejectsWith(svc.listSubmissions(a.id, PROF_B.id), 403);
  await rejectsWith(svc.listSubmissions(999, PROF_A.id), 404);
});
