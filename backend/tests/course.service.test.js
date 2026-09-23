// Tests the business and authorization rules of course.service.
// The database is replaced by a small in-memory fake that understands only the
// queries course.service sends, so no PostgreSQL is needed. This checks the
// rules (who may do what, which error code comes back); the SQL itself is
// only exercised against a real PostgreSQL.
const test = require('node:test');
const assert = require('node:assert/strict');

const db = { users: [], courses: [], enrollments: [], nextId: 1, log: [] };
const pgError = (code) => Object.assign(new Error(`pg error ${code}`), { code });

function view(course) {
  const professor = db.users.find((u) => u.id === course.professor_id);
  return {
    ...course,
    professor_name: professor.name,
    student_count: db.enrollments.filter((e) => e.course_id === course.id).length,
  };
}

async function fakeQuery(text, params = []) {
  const sql = text.replace(/\s+/g, ' ').trim();
  db.log.push(sql);

  if (sql.startsWith('INSERT INTO courses')) {
    const [name, code, description, professor_id] = params;
    if (db.courses.some((c) => c.code === code)) throw pgError('23505');
    const course = { id: db.nextId++, name, code, description, professor_id, created_at: new Date() };
    db.courses.push(course);
    return { rows: [{ id: course.id }] };
  }
  if (sql.includes('FROM courses c') && sql.includes('WHERE c.id = $1')) {
    const course = db.courses.find((c) => c.id === params[0]);
    return { rows: course ? [view(course)] : [] };
  }
  if (sql.includes('FROM courses c') && sql.includes('WHERE c.professor_id = $1')) {
    return { rows: db.courses.filter((c) => c.professor_id === params[0]).map(view) };
  }
  if (sql.includes('JOIN course_enrollments e') && sql.includes('WHERE e.student_id = $1')) {
    const ids = db.enrollments.filter((e) => e.student_id === params[0]).map((e) => e.course_id);
    return { rows: db.courses.filter((c) => ids.includes(c.id)).map(view) };
  }
  if (sql.startsWith('SELECT 1 FROM course_enrollments')) {
    const found = db.enrollments.some((e) => e.course_id === params[0] && e.student_id === params[1]);
    return { rows: found ? [{ '?column?': 1 }] : [] };
  }
  if (sql.startsWith('INSERT INTO course_enrollments')) {
    const [course_id, student_id] = params;
    if (db.enrollments.some((e) => e.course_id === course_id && e.student_id === student_id)) {
      throw pgError('23505');
    }
    const enrollment = { course_id, student_id, enrolled_at: new Date() };
    db.enrollments.push(enrollment);
    return { rows: [enrollment] };
  }
  if (sql.startsWith('UPDATE courses SET')) {
    const [name, code, description, id, professor_id] = params;
    if (db.courses.some((c) => c.code === code && c.id !== id)) throw pgError('23505');
    const course = db.courses.find((c) => c.id === id && c.professor_id === professor_id);
    if (course) Object.assign(course, { name, code, description });
    return { rows: [], rowCount: course ? 1 : 0 };
  }
  if (sql.startsWith('DELETE FROM courses')) {
    const [id, professor_id] = params;
    const before = db.courses.length;
    db.courses = db.courses.filter((c) => !(c.id === id && c.professor_id === professor_id));
    db.enrollments = db.enrollments.filter((e) => db.courses.some((c) => c.id === e.course_id)); // ON DELETE CASCADE
    return { rows: [], rowCount: before - db.courses.length };
  }
  if (sql.includes('FROM users WHERE id = $1')) {
    const user = db.users.find((u) => u.id === params[0]);
    return { rows: user ? [{ ...user }] : [] };
  }
  throw new Error(`fake db does not understand: ${sql}`);
}

// Swap the real pool (which needs pg and a database) for the fake before loading the service.
const poolPath = require.resolve('../src/db/pool');
require.cache[poolPath] = { id: poolPath, filename: poolPath, loaded: true, exports: { query: fakeQuery, pool: {} } };
const courseService = require('../src/services/course.service');

const PROF_A = { id: 1, name: 'Prof A', email: 'a@uni.edu', role: 'professor' };
const PROF_B = { id: 2, name: 'Prof B', email: 'b@uni.edu', role: 'professor' };
const STUDENT_1 = { id: 3, name: 'Student One', email: 's1@uni.edu', role: 'student' };
const STUDENT_2 = { id: 4, name: 'Student Two', email: 's2@uni.edu', role: 'student' };

test.beforeEach(() => {
  db.users = [PROF_A, PROF_B, STUDENT_1, STUDENT_2];
  db.courses = [];
  db.enrollments = [];
  db.nextId = 1;
  db.log = [];
});

const rejectsWith = (promise, status) =>
  assert.rejects(promise, (err) => {
    assert.equal(err.statusCode, status, `expected ${status}, got ${err.statusCode}: ${err.message}`);
    return true;
  });

const makeCourse = (professor = PROF_A, code = 'CS101') =>
  courseService.createCourse(professor.id, { name: 'Databases', code, description: null });

// ------------------------------------------------------------------ create

test('create: returns the course owned by the professor', async () => {
  const course = await makeCourse();
  assert.equal(course.professor_id, PROF_A.id);
  assert.equal(course.professor_name, 'Prof A');
  assert.equal(course.student_count, 0);
});

test('create: a duplicate code is a 409 with a field error', async () => {
  await makeCourse(PROF_A, 'CS101');
  await assert.rejects(makeCourse(PROF_B, 'CS101'), (err) => {
    assert.equal(err.statusCode, 409);
    assert.ok(err.errors.code);
    return true;
  });
  assert.equal(db.courses.length, 1);
});

// -------------------------------------------------------------------- list

test('professor list: only their own courses', async () => {
  await makeCourse(PROF_A, 'A1');
  await makeCourse(PROF_B, 'B1');
  const list = await courseService.listProfessorCourses(PROF_A.id);
  assert.deepEqual(list.map((c) => c.code), ['A1']);
});

test('student list: only enrolled courses, and empty when none', async () => {
  const one = await makeCourse(PROF_A, 'A1');
  await makeCourse(PROF_A, 'A2');
  assert.deepEqual(await courseService.listStudentCourses(STUDENT_1.id), []);
  await courseService.enrollStudent(one.id, STUDENT_1.id);
  const list = await courseService.listStudentCourses(STUDENT_1.id);
  assert.deepEqual(list.map((c) => c.code), ['A1']);
  assert.deepEqual(await courseService.listStudentCourses(STUDENT_2.id), []);
});

test('course objects expose no student details', async () => {
  const course = await makeCourse();
  await courseService.enrollStudent(course.id, STUDENT_1.id);
  const seen = await courseService.getCourseForUser(course.id, { id: STUDENT_1.id, role: 'student' });
  assert.deepEqual(
    Object.keys(seen).sort(),
    ['code', 'created_at', 'description', 'id', 'name', 'professor_id', 'professor_name', 'student_count']
  );
  assert.ok(!JSON.stringify(seen).includes('s1@uni.edu'));
});

// ------------------------------------------------------------------ details

test('details: enrolled student and owning professor can view', async () => {
  const course = await makeCourse();
  await courseService.enrollStudent(course.id, STUDENT_1.id);
  assert.equal((await courseService.getCourseForUser(course.id, { id: STUDENT_1.id, role: 'student' })).id, course.id);
  assert.equal((await courseService.getCourseForUser(course.id, { id: PROF_A.id, role: 'professor' })).id, course.id);
});

test('details: a student who is not enrolled gets 403', async () => {
  const course = await makeCourse();
  await rejectsWith(courseService.getCourseForUser(course.id, { id: STUDENT_2.id, role: 'student' }), 403);
});

test('details: another professor gets 403, a missing course 404', async () => {
  const course = await makeCourse();
  await rejectsWith(courseService.getCourseForUser(course.id, { id: PROF_B.id, role: 'professor' }), 403);
  await rejectsWith(courseService.getCourseForUser(999, { id: PROF_A.id, role: 'professor' }), 404);
});

// ------------------------------------------------------------------- update

test('update: owner changes only the fields sent', async () => {
  const course = await makeCourse();
  const updated = await courseService.updateCourse(course.id, PROF_A.id, { name: 'Advanced Databases' });
  assert.equal(updated.name, 'Advanced Databases');
  assert.equal(updated.code, 'CS101');
});

test('update: owner can clear the description', async () => {
  const course = await courseService.createCourse(PROF_A.id, { name: 'X', code: 'X1', description: 'old' });
  const updated = await courseService.updateCourse(course.id, PROF_A.id, { description: null });
  assert.equal(updated.description, null);
});

test('update: another professor gets 403 and nothing is written', async () => {
  const course = await makeCourse();
  await rejectsWith(courseService.updateCourse(course.id, PROF_B.id, { name: 'Hacked' }), 403);
  assert.equal(db.courses[0].name, 'Databases');
  assert.ok(!db.log.some((sql) => sql.startsWith('UPDATE')));
});

test('update: a code already used by another course is 409', async () => {
  await makeCourse(PROF_A, 'A1');
  const second = await makeCourse(PROF_A, 'A2');
  await rejectsWith(courseService.updateCourse(second.id, PROF_A.id, { code: 'A1' }), 409);
});

test('update: keeping the same code is allowed; a missing course is 404', async () => {
  const course = await makeCourse();
  await courseService.updateCourse(course.id, PROF_A.id, { code: 'CS101', name: 'Renamed' });
  await rejectsWith(courseService.updateCourse(999, PROF_A.id, { name: 'x' }), 404);
});

// ------------------------------------------------------------------- delete

test('delete: another professor gets 403 and the course remains', async () => {
  const course = await makeCourse();
  await rejectsWith(courseService.deleteCourse(course.id, PROF_B.id), 403);
  assert.equal(db.courses.length, 1);
});

test('delete: owner removes the course and its enrollments', async () => {
  const course = await makeCourse();
  await courseService.enrollStudent(course.id, STUDENT_1.id);
  await courseService.deleteCourse(course.id, PROF_A.id);
  assert.equal(db.courses.length, 0);
  assert.equal(db.enrollments.length, 0);
  await rejectsWith(courseService.deleteCourse(course.id, PROF_A.id), 404);
});

// ------------------------------------------------------------------- enroll

test('enroll: a student joins a course and the count goes up', async () => {
  const course = await makeCourse();
  const { enrollment, course: after } = await courseService.enrollStudent(course.id, STUDENT_1.id);
  assert.equal(enrollment.student_id, STUDENT_1.id);
  assert.equal(after.student_count, 1);
});

test('enroll: enrolling twice is a 409 and creates no second row', async () => {
  const course = await makeCourse();
  await courseService.enrollStudent(course.id, STUDENT_1.id);
  await rejectsWith(courseService.enrollStudent(course.id, STUDENT_1.id), 409);
  assert.equal(db.enrollments.length, 1);
});

test('enroll: unknown course is 404, unknown student is 404', async () => {
  const course = await makeCourse();
  await rejectsWith(courseService.enrollStudent(999, STUDENT_1.id), 404);
  await rejectsWith(courseService.enrollStudent(course.id, 999), 404);
});

test('enroll: a professor cannot be enrolled as a student', async () => {
  const course = await makeCourse();
  await rejectsWith(courseService.enrollStudent(course.id, PROF_B.id), 403);
  assert.equal(db.enrollments.length, 0);
});
