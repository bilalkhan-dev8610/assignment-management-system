const express = require('express');
const authRoutes = require('./auth.routes');
const courseRoutes = require('./course.routes');
const assignmentRoutes = require('./assignment.routes');
const groupRoutes = require('./group.routes');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ success: true, message: 'API is running', timestamp: new Date().toISOString() });
});

router.use('/auth', authRoutes);
router.use('/courses', courseRoutes);
router.use('/assignments', assignmentRoutes);
router.use('/groups', groupRoutes);

module.exports = router;
