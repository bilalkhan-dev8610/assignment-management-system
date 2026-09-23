const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { SUBMISSION_STATUSES, validateGroup, parseId } = require('../utils/validators');
const groupService = require('../services/group.service');

const hasErrors = (errors) => Object.keys(errors).length > 0;

function idFrom(req, param, label) {
  const id = parseId(req.params[param]);
  if (id === undefined) throw new AppError(400, `Invalid ${label} id`);
  return id;
}

// POST /api/assignments/:assignmentId/groups
const create = asyncHandler(async (req, res) => {
  const assignmentId = idFrom(req, 'assignmentId', 'assignment');
  const { errors, value } = validateGroup(req.body);
  if (hasErrors(errors)) throw new AppError(400, 'Validation failed', errors);

  const group = await groupService.createGroup(assignmentId, req.user, value);
  res.status(201).json({ success: true, message: 'Group created', data: { group } });
});

// GET /api/assignments/:assignmentId/groups[?status=]
const listForAssignment = asyncHandler(async (req, res) => {
  const assignmentId = idFrom(req, 'assignmentId', 'assignment');
  const { status } = req.query;
  if (status !== undefined && !SUBMISSION_STATUSES.includes(status)) {
    throw new AppError(400, 'Validation failed', { status: 'Status must be submitted or not_submitted' });
  }

  const groups = await groupService.listAssignmentGroups(assignmentId, req.user, status);
  res.json({ success: true, data: { groups } });
});

// GET /api/assignments/:assignmentId/group-candidates
const candidates = asyncHandler(async (req, res) => {
  const data = await groupService.listCandidates(idFrom(req, 'assignmentId', 'assignment'), req.user);
  res.json({ success: true, data });
});

// GET /api/groups/:groupId
const getOne = asyncHandler(async (req, res) => {
  const group = await groupService.getGroupForUser(idFrom(req, 'groupId', 'group'), req.user);
  res.json({ success: true, data: { group } });
});

// POST /api/groups/:groupId/acknowledge
const acknowledge = asyncHandler(async (req, res) => {
  const group = await groupService.acknowledgeGroup(idFrom(req, 'groupId', 'group'), req.user);
  res.json({ success: true, message: 'Submission acknowledged', data: { group } });
});

module.exports = { create, listForAssignment, candidates, getOne, acknowledge };
