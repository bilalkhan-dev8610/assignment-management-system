const express = require('express');
const controller = require('../controllers/group.controller');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

const router = express.Router();

// Every group route needs a valid token.
router.use(authenticate);

// Members of the group and the course's professor; the service decides.
router.get('/:groupId', controller.getOne);

// Students only here, and the service then requires the leader.
router.post('/:groupId/acknowledge', requireRole('student'), controller.acknowledge);

module.exports = router;
