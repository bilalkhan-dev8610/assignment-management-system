const express = require('express');
const controller = require('../controllers/course.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

const router = express.Router();

// Every course route needs a valid token.
router.use(authenticate);

router.post('/', requireRole('professor'), controller.create);
router.get('/professor', requireRole('professor'), controller.listForProfessor);
router.get('/student', requireRole('student'), controller.listForStudent);
router.get('/available', requireRole('student'), controller.listAvailableForStudent);

// Keep the fixed paths above: '/professor' and '/student' must not match '/:id'.
router.get('/:id', controller.getOne); // both roles; the service checks ownership/enrollment
router.put('/:id', requireRole('professor'), controller.update);
router.delete('/:id', requireRole('professor'), controller.remove);

router.post('/:courseId/enroll', requireRole('student'), controller.enroll);

module.exports = router;
