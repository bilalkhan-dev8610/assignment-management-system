const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const {
  SUBMISSION_STATUSES,
  validateAssignment,
  validateSubmission,
  parseId,
} = require('../utils/validators');
const assignmentService = require('../services/assignment.service');

const hasErrors = (errors) => Object.keys(errors).length > 0;

// Reads an id from the URL (/:id, /:assignmentId or /:courseId) or fails with 400.
function idFrom(req, param, label) {
  const id = parseId(req.params[param]);
  if (id === undefined) throw new AppError(400, `Invalid ${label} id`);
  return id;
}

const create = asyncHandler(async (req, res) => {
  const { errors, value } = validateAssignment(req.body);
  if (hasErrors(errors)) throw new AppError(400, 'Validation failed', errors);

  // created_by is always the professor in the token, never a value from the body.
  const assignment = await assignmentService.createAssignment(req.user.id, value);
  res.status(201).json({ success: true, message: 'Assignment created', data: { assignment } });
});

const listForCourse = asyncHandler(async (req, res) => {
  const assignments = await assignmentService.listCourseAssignments(idFrom(req, 'courseId', 'course'), req.user);
  res.json({ success: true, data: { assignments } });
});

const getOne = asyncHandler(async (req, res) => {
  const assignment = await assignmentService.getAssignmentForUser(idFrom(req, 'id', 'assignment'), req.user);
  res.json({ success: true, data: { assignment } });
});

const update = asyncHandler(async (req, res) => {
  const assignmentId = idFrom(req, 'id', 'assignment');
  const { errors, value } = validateAssignment(req.body, { partial: true });
  if (hasErrors(errors)) throw new AppError(400, 'Validation failed', errors);

  const assignment = await assignmentService.updateAssignment(assignmentId, req.user.id, value);
  res.json({ success: true, message: 'Assignment updated', data: { assignment } });
});

const submit = asyncHandler(async (req, res) => {
  const assignmentId = idFrom(req, 'assignmentId', 'assignment');
  const { errors, value } = validateSubmission(req.body);
  if (hasErrors(errors)) throw new AppError(400, 'Validation failed', errors);

  // The student is whoever the token belongs to; nobody can submit for someone else.
  const submission = await assignmentService.submitAssignment(assignmentId, req.user, value.content);
  res.status(201).json({ success: true, message: 'Assignment submitted', data: { submission } });
});

const getMySubmission = asyncHandler(async (req, res) => {
  const submission = await assignmentService.getMySubmission(idFrom(req, 'assignmentId', 'assignment'), req.user);
  res.json({ success: true, data: { submission } });
});

const listSubmissions = asyncHandler(async (req, res) => {
  const assignmentId = idFrom(req, 'assignmentId', 'assignment');
  const { status } = req.query;
  if (status !== undefined && !SUBMISSION_STATUSES.includes(status)) {
    throw new AppError(400, 'Validation failed', { status: 'Status must be submitted or not_submitted' });
  }

  const submissions = await assignmentService.listSubmissions(assignmentId, req.user.id, status);
  res.json({ success: true, data: { submissions } });
});

module.exports = { create, listForCourse, getOne, update, submit, getMySubmission, listSubmissions };
