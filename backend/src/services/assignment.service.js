const { query } = require('../db/pool');
const AppError = require('../utils/AppError');
const courseService = require('./course.service');
const groupService = require('./group.service');

const UNIQUE_VIOLATION = '23505'; // PostgreSQL error code

// The assignment plus the name and code of its course. Nothing about students.
const ASSIGNMENT_COLUMNS = `
  a.id, a.course_id, c.name AS course_name, c.code AS course_code,
  a.title, a.description, a.deadline, a.submission_type,
  a.created_by, a.created_at, a.updated_at`;
const FROM_ASSIGNMENTS = `FROM assignments a JOIN courses c ON c.id = a.course_id`;

async function findAssignmentById(assignmentId) {
  const { rows } = await query(
    `SELECT ${ASSIGNMENT_COLUMNS} ${FROM_ASSIGNMENTS} WHERE a.id = $1`,
    [assignmentId]
  );
  return rows[0];
}

// Loads an assignment, or fails with 404.
async function getAssignmentOrFail(assignmentId) {
  const assignment = await findAssignmentById(assignmentId);
  if (!assignment) throw new AppError(404, 'Assignment not found');
  return assignment;
}

// ---------------------------------------------------------------- professor

// The professor must own the course the assignment is being added to.
async function createAssignment(professorId, input) {
  await courseService.getOwnedCourse(input.course_id, professorId);

  const { rows } = await query(
    `INSERT INTO assignments (course_id, title, description, deadline, submission_type, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [input.course_id, input.title, input.description, input.deadline, input.submission_type, professorId]
  );
  return findAssignmentById(rows[0].id);
}

// changes holds only the fields the client sent; the rest keep their current value.
async function updateAssignment(assignmentId, professorId, changes) {
  const assignment = await getAssignmentOrFail(assignmentId);
  await courseService.getOwnedCourse(assignment.course_id, professorId);

  // Switching individual <-> group once work or groups exist would make them meaningless.
  if (changes.submission_type && changes.submission_type !== assignment.submission_type) {
    const submitted = await query('SELECT 1 FROM submissions WHERE assignment_id = $1 LIMIT 1', [assignmentId]);
    const grouped = await query('SELECT 1 FROM groups WHERE assignment_id = $1 LIMIT 1', [assignmentId]);
    if (submitted.rows.length > 0 || grouped.rows.length > 0) {
      throw new AppError(409, 'The submission type cannot be changed after students have submitted or formed groups');
    }
  }

  const next = {
    title: changes.title ?? assignment.title,
    description: changes.description ?? assignment.description,
    deadline: changes.deadline ?? assignment.deadline,
    submission_type: changes.submission_type ?? assignment.submission_type,
  };
  await query(
    `UPDATE assignments
     SET title = $1, description = $2, deadline = $3, submission_type = $4, updated_at = NOW()
     WHERE id = $5`,
    [next.title, next.description, next.deadline, next.submission_type, assignmentId]
  );
  return findAssignmentById(assignmentId);
}

// Who has submitted and who has not, for every student enrolled in the course.
// Students with no submission row count as 'not_submitted'. Optional status filter.
async function listSubmissions(assignmentId, professorId, status) {
  const assignment = await getAssignmentOrFail(assignmentId);
  await courseService.getOwnedCourse(assignment.course_id, professorId);
  if (assignment.submission_type === 'group') {
    throw new AppError(409, 'This is a group assignment. View its groups instead');
  }

  const params = [assignmentId, assignment.course_id];
  let statusFilter = '';
  if (status) {
    params.push(status);
    statusFilter = `AND COALESCE(s.status, 'not_submitted') = $3`;
  }

  const { rows } = await query(
    `SELECT u.id AS student_id, u.name, u.email,
            COALESCE(s.status, 'not_submitted') AS status,
            s.submitted_at, s.content
     FROM course_enrollments e
     JOIN users u ON u.id = e.student_id
     LEFT JOIN submissions s ON s.assignment_id = $1 AND s.student_id = e.student_id
     WHERE e.course_id = $2 ${statusFilter}
     ORDER BY u.name, u.id`,
    params
  );
  return rows;
}

// --------------------------------------------------------------- both roles

// getCourseForUser is the single access check: a professor must own the course,
// a student must be enrolled in it (404 if the course does not exist).
async function listCourseAssignments(courseId, user) {
  await courseService.getCourseForUser(courseId, user);

  if (user.role === 'professor') {
    const { rows } = await query(
      `SELECT ${ASSIGNMENT_COLUMNS},
              (SELECT COUNT(*)::int FROM submissions s
                WHERE s.assignment_id = a.id AND s.status = 'submitted') AS submitted_count,
              (SELECT COUNT(*)::int FROM course_enrollments e
                WHERE e.course_id = a.course_id) AS student_count,
              (SELECT COUNT(*)::int FROM groups g WHERE g.assignment_id = a.id) AS group_count
       ${FROM_ASSIGNMENTS}
       WHERE a.course_id = $1
       ORDER BY a.deadline ASC, a.id ASC`,
      [courseId]
    );
    return rows;
  }

  // A student sees only their own status: their own submission for an individual
  // assignment, their group's submission for a group assignment.
  const { rows } = await query(
    `SELECT ${ASSIGNMENT_COLUMNS},
            COALESCE(s.status, 'not_submitted') AS submission_status,
            s.submitted_at
     ${FROM_ASSIGNMENTS}
     LEFT JOIN submissions s ON s.assignment_id = a.id AND (
            (a.submission_type = 'individual' AND s.student_id = $2)
         OR (a.submission_type = 'group'
             AND s.group_id IN (SELECT gm.group_id FROM group_members gm WHERE gm.student_id = $2)))
     WHERE a.course_id = $1
     ORDER BY a.deadline ASC, a.id ASC`,
    [courseId, user.id]
  );
  return rows;
}

// A professor also gets progress counts; a student gets the assignment only.
async function getAssignmentForUser(assignmentId, user) {
  const assignment = await getAssignmentOrFail(assignmentId);
  await courseService.getCourseForUser(assignment.course_id, user);

  if (user.role !== 'professor') return assignment;

  const { rows } = await query(
    `SELECT (SELECT COUNT(*)::int FROM submissions
              WHERE assignment_id = $1 AND status = 'submitted') AS submitted_count,
            (SELECT COUNT(*)::int FROM course_enrollments WHERE course_id = $2) AS student_count,
            (SELECT COUNT(*)::int FROM groups WHERE assignment_id = $1) AS group_count`,
    [assignmentId, assignment.course_id]
  );
  return { ...assignment, ...rows[0] };
}

// ------------------------------------------------------------------ student

// Rules, in order: enrolled in the course -> (group assignment: in a group) -> deadline not passed.
// Individual assignment: the submission belongs to the student (UNIQUE assignment + student).
// Group assignment: any member submits once for the whole group, so the row is filed under
// the group (UNIQUE group) and the other members do not get a submission of their own.
// `now` is a parameter only so tests can control the clock.
async function submitAssignment(assignmentId, user, content, now = new Date()) {
  const assignment = await getAssignmentOrFail(assignmentId);
  if (user.role !== 'student') throw new AppError(403, 'Only students can submit assignments');
  await courseService.getCourseForUser(assignment.course_id, user);

  const isGroup = assignment.submission_type === 'group';
  let group = null;
  if (isGroup) {
    group = await groupService.findGroupForStudent(assignmentId, user.id);
    if (!group) throw new AppError(409, 'Create or join a group before submitting this group assignment');
  }

  if (now > new Date(assignment.deadline)) {
    throw new AppError(409, 'The deadline for this assignment has passed');
  }

  try {
    const { rows } = await query(
      `INSERT INTO submissions (assignment_id, student_id, group_id, content, status)
       VALUES ($1, $2, $3, $4, 'submitted')
       RETURNING assignment_id, student_id, group_id, content, status, submitted_at`,
      [assignmentId, user.id, group ? group.id : null, content]
    );
    return isGroup ? { ...rows[0], acknowledged: false, acknowledged_at: null } : rows[0];
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION) {
      throw new AppError(
        409,
        isGroup ? 'Your group has already submitted this assignment' : 'You have already submitted this assignment'
      );
    }
    throw err;
  }
}

// The student's own status: their submission (individual) or their group's submission
// (group), or a not_submitted placeholder.
async function getMySubmission(assignmentId, user) {
  const assignment = await getAssignmentOrFail(assignmentId);
  await courseService.getCourseForUser(assignment.course_id, user);

  if (assignment.submission_type === 'group') {
    const group = await groupService.findGroupForStudent(assignmentId, user.id);
    if (group) {
      const { rows } = await query(
        `SELECT s.assignment_id, s.student_id, s.group_id, s.content, s.status, s.submitted_at,
                s.acknowledged_at, u.name AS submitted_by_name
         FROM submissions s
         JOIN users u ON u.id = s.student_id
         WHERE s.group_id = $1`,
        [group.id]
      );
      if (rows[0]) return { ...rows[0], acknowledged: rows[0].acknowledged_at !== null };
    }
    return {
      assignment_id: assignmentId,
      student_id: user.id,
      group_id: group ? group.id : null,
      content: null,
      status: 'not_submitted',
      submitted_at: null,
      submitted_by_name: null,
      acknowledged: false,
      acknowledged_at: null,
    };
  }

  const { rows } = await query(
    `SELECT assignment_id, student_id, content, status, submitted_at
     FROM submissions
     WHERE assignment_id = $1 AND student_id = $2`,
    [assignmentId, user.id]
  );
  return (
    rows[0] || {
      assignment_id: assignmentId,
      student_id: user.id,
      content: null,
      status: 'not_submitted',
      submitted_at: null,
    }
  );
}

module.exports = {
  createAssignment,
  updateAssignment,
  listSubmissions,
  listCourseAssignments,
  getAssignmentForUser,
  submitAssignment,
  getMySubmission,
};
