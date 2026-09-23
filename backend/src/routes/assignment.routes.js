const express = require('express');
const controller = require('../controllers/assignment.controller');
const groupController = require('../controllers/group.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

const router = express.Router();

// Every assignment route needs a valid token.
router.use(authenticate);

router.post('/', requireRole('professor'), controller.create);

// Both roles: the service checks the professor owns the course / the student is enrolled.
router.get('/course/:courseId', controller.listForCourse);
router.get('/:id', controller.getOne);

router.put('/:id', requireRole('professor'), controller.update);

router.post('/:assignmentId/submit', requireRole('student'), controller.submit);
router.get('/:assignmentId/submission', requireRole('student'), controller.getMySubmission);
router.get('/:assignmentId/submissions', requireRole('professor'), controller.listSubmissions);

// Group assignments (see group.service): students create and view their group, professors view all groups.
router.post('/:assignmentId/groups', requireRole('student'), groupController.create);
router.get('/:assignmentId/groups', groupController.listForAssignment);
router.get('/:assignmentId/group-candidates', requireRole('student'), groupController.candidates);

module.exports = router;
