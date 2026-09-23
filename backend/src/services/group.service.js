// Group logic for group assignments: creating a group, viewing it, and the
// leader's acknowledgement of the group's submission. Individual assignments never
// reach this code (every entry point checks the assignment type).
const { query, withTransaction } = require('../db/pool');
const config = require('../config/env');
const AppError = require('../utils/AppError');
const courseService = require('./course.service');

// One group with its leader, its members (names only) and the state of its
// submission. Never selects emails, passwords or anything else private.
const GROUP_SELECT = `
  SELECT g.id, g.assignment_id, g.leader_id, g.created_at,
         a.title AS assignment_title, a.deadline AS assignment_deadline,
         a.course_id, a.submission_type,
         leader.name AS leader_name,
         (SELECT COALESCE(json_agg(json_build_object('id', u.id, 'name', u.name) ORDER BY u.name, u.id), '[]'::json)
            FROM group_members gm
            JOIN users u ON u.id = gm.student_id
           WHERE gm.group_id = g.id) AS members,
         COALESCE(s.status, 'not_submitted') AS submission_status,
         s.submitted_at, s.content AS submission_content, s.acknowledged_at,
         submitter.name AS submitted_by_name
  FROM groups g
  JOIN assignments a ON a.id = g.assignment_id
  JOIN users leader ON leader.id = g.leader_id
  LEFT JOIN submissions s ON s.group_id = g.id
  LEFT JOIN users submitter ON submitter.id = s.student_id`;

function toGroupView(row) {
  return {
    id: row.id,
    assignment: {
      id: row.assignment_id,
      title: row.assignment_title,
      deadline: row.assignment_deadline,
      course_id: row.course_id,
      submission_type: row.submission_type,
    },
    leader: { id: row.leader_id, name: row.leader_name },
    members: row.members,
    created_at: row.created_at,
    submission: {
      status: row.submission_status,
      submitted_at: row.submitted_at,
      submitted_by_name: row.submitted_by_name,
      content: row.submission_content,
      acknowledged: row.acknowledged_at !== null && row.acknowledged_at !== undefined,
      acknowledged_at: row.acknowledged_at,
    },
  };
}

async function findGroupRow(groupId) {
  const { rows } = await query(`${GROUP_SELECT} WHERE g.id = $1`, [groupId]);
  return rows[0];
}

async function findAssignment(assignmentId) {
  const { rows } = await query('SELECT id, course_id, submission_type FROM assignments WHERE id = $1', [assignmentId]);
  if (!rows[0]) throw new AppError(404, 'Assignment not found');
  return rows[0];
}

// Group operations only make sense for group assignments.
function requireGroupAssignment(assignment) {
  if (assignment.submission_type !== 'group') {
    throw new AppError(409, 'This is not a group assignment');
  }
}

function requireStudent(user, action) {
  if (user.role !== 'student') throw new AppError(403, `Only students can ${action}`);
}

// The group this student belongs to for an assignment, if any.
// Also used by assignment.service so a group submission is filed under the right group.
async function findGroupForStudent(assignmentId, studentId) {
  const { rows } = await query(
    `SELECT g.id, g.leader_id
     FROM groups g
     JOIN group_members gm ON gm.group_id = g.id
     WHERE g.assignment_id = $1 AND gm.student_id = $2`,
    [assignmentId, studentId]
  );
  return rows[0];
}

const invalid = (field, message) => new AppError(400, 'Validation failed', { [field]: message });

// ------------------------------------------------------------------- create

// The student sending the request is always a member. member_ids are the others;
// leader_id defaults to the creator. Runs in one transaction that first locks the
// assignment row, so two groups for the same assignment are created one at a time
// and a student cannot slip into two of them.
async function createGroup(assignmentId, user, { member_ids: memberIds = [], leader_id: leaderId } = {}) {
  requireStudent(user, 'create a group');

  const groupId = await withTransaction(async (run) => {
    const found = await run('SELECT id, course_id, submission_type FROM assignments WHERE id = $1 FOR UPDATE', [assignmentId]);
    const assignment = found.rows[0];
    if (!assignment) throw new AppError(404, 'Assignment not found');
    requireGroupAssignment(assignment);

    // The creator must be enrolled in the assignment's course.
    await courseService.getCourseForUser(assignment.course_id, user);

    const members = [...new Set([user.id, ...memberIds])];
    const leader = leaderId ?? user.id;

    if (!members.includes(leader)) throw invalid('leader_id', 'The leader must be one of the group members');
    if (members.length > config.groupMaxMembers) {
      throw invalid('member_ids', `A group can have at most ${config.groupMaxMembers} members, including you`);
    }

    // Everyone must be a student enrolled in this course.
    const eligible = await run(
      `SELECT u.id
       FROM users u
       JOIN course_enrollments e ON e.student_id = u.id AND e.course_id = $2
       WHERE u.role = 'student' AND u.id = ANY($1::int[])`,
      [members, assignment.course_id]
    );
    if (eligible.rows.length !== members.length) {
      throw invalid('member_ids', 'Every member must be a student enrolled in this course');
    }

    // Nobody may already be in a group for this assignment.
    const taken = await run(
      `SELECT u.id, u.name
       FROM group_members gm
       JOIN groups g ON g.id = gm.group_id
       JOIN users u ON u.id = gm.student_id
       WHERE g.assignment_id = $1 AND gm.student_id = ANY($2::int[])
       ORDER BY u.name, u.id`,
      [assignmentId, members]
    );
    if (taken.rows.some((row) => row.id === user.id)) {
      throw new AppError(409, 'You are already in a group for this assignment');
    }
    if (taken.rows.length > 0) {
      const names = taken.rows.map((row) => row.name).join(', ');
      throw new AppError(409, `Already in a group for this assignment: ${names}`, {
        member_ids: `Already in a group: ${names}`,
      });
    }

    const created = await run('INSERT INTO groups (assignment_id, leader_id) VALUES ($1, $2) RETURNING id', [
      assignmentId,
      leader,
    ]);
    const newGroupId = created.rows[0].id;
    await run('INSERT INTO group_members (group_id, student_id) SELECT $1::int, UNNEST($2::int[])', [
      newGroupId,
      members,
    ]);
    return newGroupId;
  });

  return toGroupView(await findGroupRow(groupId));
}

// --------------------------------------------------------------------- read

// Professor (owner of the course): every group, optionally filtered by submission status.
// Student: only their own group (a list of zero or one).
async function listAssignmentGroups(assignmentId, user, status) {
  const assignment = await findAssignment(assignmentId);
  await courseService.getCourseForUser(assignment.course_id, user);
  requireGroupAssignment(assignment);

  if (user.role === 'professor') {
    const params = [assignmentId];
    let statusFilter = '';
    if (status) {
      params.push(status);
      statusFilter = `AND COALESCE(s.status, 'not_submitted') = $2`;
    }
    const { rows } = await query(`${GROUP_SELECT} WHERE g.assignment_id = $1 ${statusFilter} ORDER BY g.id`, params);
    return rows.map(toGroupView);
  }

  const { rows } = await query(
    `${GROUP_SELECT}
     WHERE g.assignment_id = $1
       AND EXISTS (SELECT 1 FROM group_members m WHERE m.group_id = g.id AND m.student_id = $2)`,
    [assignmentId, user.id]
  );
  return rows.map(toGroupView);
}

// Members of the group and the professor who owns the course; nobody else.
async function getGroupForUser(groupId, user) {
  const row = await findGroupRow(groupId);
  if (!row) throw new AppError(404, 'Group not found');

  if (user.role === 'professor') {
    await courseService.getCourseForUser(row.course_id, user);
  } else if (!row.members.some((member) => member.id === user.id)) {
    throw new AppError(403, 'You are not a member of this group');
  }
  return toGroupView(row);
}

// Classmates a student can still add: enrolled students (names only) who are
// not yet in a group for this assignment. Also returns the size limit for the form.
async function listCandidates(assignmentId, user) {
  requireStudent(user, 'create a group');
  const assignment = await findAssignment(assignmentId);
  await courseService.getCourseForUser(assignment.course_id, user);
  requireGroupAssignment(assignment);

  const { rows } = await query(
    `SELECT u.id, u.name
     FROM course_enrollments e
     JOIN users u ON u.id = e.student_id
     WHERE e.course_id = $1 AND u.role = 'student' AND u.id <> $2
       AND NOT EXISTS (
         SELECT 1 FROM group_members gm
         JOIN groups g ON g.id = gm.group_id
         WHERE g.assignment_id = $3 AND gm.student_id = u.id)
     ORDER BY u.name, u.id`,
    [assignment.course_id, user.id, assignmentId]
  );
  return { students: rows, max_members: config.groupMaxMembers };
}

// -------------------------------------------------------------- acknowledge

// Only the group's leader may acknowledge, and only once the group has submitted.
// The acknowledgement is stored on the group's submission row, so every member
// (and the professor) reads the same value from the database.
async function acknowledgeGroup(groupId, user) {
  requireStudent(user, 'acknowledge a submission');

  const group = await findGroupRow(groupId);
  if (!group) throw new AppError(404, 'Group not found');
  requireGroupAssignment({ submission_type: group.submission_type });

  if (!group.members.some((member) => member.id === user.id)) {
    throw new AppError(403, 'You are not a member of this group');
  }
  if (group.leader_id !== user.id) {
    throw new AppError(403, 'Only the group leader can acknowledge the submission');
  }
  if (group.submission_status !== 'submitted') {
    throw new AppError(409, 'The group has not submitted this assignment yet');
  }

  // Atomic: succeeds only while the submission is still unacknowledged.
  const { rows } = await query(
    `UPDATE submissions
     SET acknowledged_at = NOW(), acknowledged_by = $2, updated_at = NOW()
     WHERE group_id = $1 AND acknowledged_at IS NULL
     RETURNING id`,
    [groupId, user.id]
  );
  if (rows.length === 0) throw new AppError(409, 'The submission has already been acknowledged');

  return toGroupView(await findGroupRow(groupId));
}

module.exports = {
  createGroup,
  listAssignmentGroups,
  getGroupForUser,
  listCandidates,
  acknowledgeGroup,
  findGroupForStudent,
};
