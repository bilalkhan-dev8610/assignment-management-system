const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { validateCourse, parseId } = require('../utils/validators');
const courseService = require('../services/course.service');

const hasErrors = (errors) => Object.keys(errors).length > 0;

// Reads a course id from the URL (/:id or /:courseId) or fails with 400.
function courseIdFrom(req, param = 'id') {
  const id = parseId(req.params[param]);
  if (id === undefined) throw new AppError(400, 'Invalid course id');
  return id;
}

const create = asyncHandler(async (req, res) => {
  const { errors, value } = validateCourse(req.body);
  if (hasErrors(errors)) throw new AppError(400, 'Validation failed', errors);

  // The owner always comes from the token, never from the request body.
  const course = await courseService.createCourse(req.user.id, value);
  res.status(201).json({ success: true, message: 'Course created', data: { course } });
});

const listForProfessor = asyncHandler(async (req, res) => {
  const courses = await courseService.listProfessorCourses(req.user.id);
  res.json({ success: true, data: { courses } });
});

const listForStudent = asyncHandler(async (req, res) => {
  const courses = await courseService.listStudentCourses(req.user.id);
  res.json({ success: true, data: { courses } });
});

const listAvailableForStudent = asyncHandler(async (req, res) => {
  const courses = await courseService.listAvailableCoursesForStudent(req.user.id);
  res.json({ success: true, data: { courses } });
});

const getOne = asyncHandler(async (req, res) => {
  const course = await courseService.getCourseForUser(courseIdFrom(req), req.user);
  res.json({ success: true, data: { course } });
});

const update = asyncHandler(async (req, res) => {
  const courseId = courseIdFrom(req);
  const { errors, value } = validateCourse(req.body, { partial: true });
  if (hasErrors(errors)) throw new AppError(400, 'Validation failed', errors);

  const course = await courseService.updateCourse(courseId, req.user.id, value);
  res.json({ success: true, message: 'Course updated', data: { course } });
});

const remove = asyncHandler(async (req, res) => {
  await courseService.deleteCourse(courseIdFrom(req), req.user.id);
  res.json({ success: true, message: 'Course deleted' });
});

const enroll = asyncHandler(async (req, res) => {
  // The student is whoever the token belongs to: nobody can enroll someone else.
  const data = await courseService.enrollStudent(courseIdFrom(req, 'courseId'), req.user.id);
  res.status(201).json({ success: true, message: 'Enrolled in course', data });
});

module.exports = { create, listForProfessor, listForStudent, listAvailableForStudent, getOne, update, remove, enroll };
