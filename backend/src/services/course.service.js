const { query } = require('../db/pool');
const AppError = require('../utils/AppError');
const userService = require('./user.service');

const UNIQUE_VIOLATION = '23505'; // PostgreSQL error codes
const FOREIGN_KEY_VIOLATION = '23503';

// Every course query returns the same shape: the course, its professor's name
// and how many students are enrolled. No student details are ever selected.
const COURSE_SELECT = `
  SELECT c.id, c.name, c.code, c.description, c.created_at,
         c.professor_id, u.name AS professor_name,
         (SELECT COUNT(*)::int FROM course_enrollments ce WHERE ce.course_id = c.id) AS student_count
  FROM courses c
  JOIN users u ON u.id = c.professor_id`;

async function findCourseById(courseId) {
  const { rows } = await query(`${COURSE_SELECT} WHERE c.id = $1`, [courseId]);
  return rows[0];
}

async function isEnrolled(courseId, studentId) {
  const { rows } = await query(
    'SELECT 1 FROM course_enrollments WHERE course_id = $1 AND student_id = $2',
    [courseId, studentId]
  );
  return rows.length > 0;
}

// The UNIQUE constraint on courses.code is the source of truth for duplicates.
function rethrowDuplicateCode(err) {
  if (err.code === UNIQUE_VIOLATION) {
    throw new AppError(409, 'A course with this code already exists', {
      code: 'This course code is already in use',
    });
  }
  throw err;
}

// Loads a course and makes sure the given professor owns it.
async function getOwnedCourse(courseId, professorId) {
  const course = await findCourseById(courseId);
  if (!course) throw new AppError(404, 'Course not found');
  if (course.professor_id !== professorId) {
    throw new AppError(403, 'You can only change your own courses');
  }
  return course;
}

// ---------------------------------------------------------------- professor

async function createCourse(professorId, { name, code, description }) {
  try {
    const { rows } = await query(
      `INSERT INTO courses (name, code, description, professor_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [name, code, description ?? null, professorId]
    );
    return await findCourseById(rows[0].id);
  } catch (err) {
    return rethrowDuplicateCode(err);
  }
}

async function listProfessorCourses(professorId) {
  const { rows } = await query(
    `${COURSE_SELECT} WHERE c.professor_id = $1 ORDER BY c.created_at DESC, c.id DESC`,
    [professorId]
  );
  return rows;
}

// changes holds only the fields the client sent; the rest keep their current value.
async function updateCourse(courseId, professorId, changes) {
  const course = await getOwnedCourse(courseId, professorId);
  const next = {
    name: changes.name ?? course.name,
    code: changes.code ?? course.code,
    description: changes.description !== undefined ? changes.description : course.description,
  };

  try {
    await query(
      `UPDATE courses SET name = $1, code = $2, description = $3
       WHERE id = $4 AND professor_id = $5`,
      [next.name, next.code, next.description, courseId, professorId]
    );
  } catch (err) {
    rethrowDuplicateCode(err);
  }
  return findCourseById(courseId);
}

// Enrollments of the course are removed with it (ON DELETE CASCADE).
async function deleteCourse(courseId, professorId) {
  await getOwnedCourse(courseId, professorId);
  await query('DELETE FROM courses WHERE id = $1 AND professor_id = $2', [courseId, professorId]);
}

// ------------------------------------------------------------------ student

async function listStudentCourses(studentId) {
  const { rows } = await query(
    `${COURSE_SELECT}
     JOIN course_enrollments e ON e.course_id = c.id
     WHERE e.student_id = $1
     ORDER BY e.enrolled_at DESC, c.id DESC`,
    [studentId]
  );
  return rows;
}

async function enrollStudent(courseId, studentId) {
  const course = await findCourseById(courseId);
  if (!course) throw new AppError(404, 'Course not found');

  const student = await userService.findById(studentId);
  if (!student) throw new AppError(404, 'Student not found');
  if (student.role !== 'student') throw new AppError(403, 'Only students can enroll in a course');

  try {
    const { rows } = await query(
      `INSERT INTO course_enrollments (course_id, student_id)
       VALUES ($1, $2)
       RETURNING course_id, student_id, enrolled_at`,
      [courseId, studentId]
    );
    return { enrollment: rows[0], course: await findCourseById(courseId) };
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION) {
      throw new AppError(409, 'You are already enrolled in this course');
    }
    if (err.code === FOREIGN_KEY_VIOLATION) {
      throw new AppError(404, 'Course not found'); // deleted between the check and the insert
    }
    throw err;
  }
}

// -------------------------------------------------------------- both roles

// A professor may view a course they own; a student only one they are enrolled in.
async function getCourseForUser(courseId, user) {
  const course = await findCourseById(courseId);
  if (!course) throw new AppError(404, 'Course not found');

  if (user.role === 'professor') {
    if (course.professor_id !== user.id) throw new AppError(403, 'You can only view your own courses');
  } else if (!(await isEnrolled(courseId, user.id))) {
    throw new AppError(403, 'You are not enrolled in this course');
  }
  return course;
}

module.exports = {
  getOwnedCourse,
  createCourse,
  listProfessorCourses,
  updateCourse,
  deleteCourse,
  listStudentCourses,
  enrollStudent,
  getCourseForUser,
};
