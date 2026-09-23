import { useState } from 'react';
import { Link } from 'react-router-dom';
import Alert from '../components/Alert.jsx';
import Button from '../components/Button.jsx';
import CourseCard from '../components/CourseCard.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import Modal from '../components/Modal.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { SkeletonGrid } from '../components/SkeletonCard.jsx';
import StatCard from '../components/StatCard.jsx';
import useFlashNotice from '../hooks/useFlashNotice.js';
import useLoad from '../hooks/useLoad.js';
import { deleteCourse, getProfessorCourses } from '../services/courseService.js';
import { getUser } from '../utils/session.js';

export default function ProfessorDashboard() {
  const { data: courses, setData: setCourses, error, loading } = useLoad(getProfessorCourses);
  const [notice, setNotice] = useFlashNotice(); // e.g. "Course created"
  const [actionError, setActionError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null); // the course awaiting confirmation
  const [deletingId, setDeletingId] = useState(null);
  const user = getUser();

  const confirmDelete = async () => {
    const course = pendingDelete;
    setPendingDelete(null);
    setNotice('');
    setActionError('');
    setDeletingId(course.id);
    try {
      await deleteCourse(course.id);
      setCourses((current) => current.filter((item) => item.id !== course.id));
      setNotice('Course deleted');
    } catch (err) {
      setActionError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const totalStudents = courses?.reduce((sum, course) => sum + course.student_count, 0);

  return (
    <div>
      <PageHeader
        title={`Welcome back${user?.name ? `, ${user.name.split(' ')[0]}` : ''}`}
        actions={
          <Button as={Link} to="/professor/courses/new">
            Create course
          </Button>
        }
      />

      {courses && courses.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <StatCard value={courses.length} label={courses.length === 1 ? 'Course taught' : 'Courses taught'} />
          <StatCard value={totalStudents} label={totalStudents === 1 ? 'Student enrolled' : 'Students enrolled'} />
        </div>
      )}

      <h2 className="mt-8 text-lg font-semibold">My courses</h2>

      <div className="mt-4 space-y-4">
        {notice && <Alert type="success">{notice}</Alert>}
        {actionError && <Alert>{actionError}</Alert>}
        {loading && <SkeletonGrid />}
        <ErrorMessage>{error}</ErrorMessage>

        {courses && courses.length === 0 && (
          <EmptyState
            title="No courses yet"
            action={
              <Button as={Link} to="/professor/courses/new" size="sm">
                Create your first course
              </Button>
            }
          >
            Once you create a course, it will show up here.
          </EmptyState>
        )}

        {courses && courses.length > 0 && (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {courses.map((course) => (
              <li key={course.id}>
                <CourseCard
                  course={course}
                  meta={`${course.student_count} ${course.student_count === 1 ? 'student' : 'students'} enrolled`}
                >
                  <Button as={Link} to={`/professor/courses/${course.id}/assignments`} variant="link">
                    Assignments
                  </Button>
                  <Button as={Link} to={`/professor/courses/${course.id}/edit`} variant="link">
                    Edit
                  </Button>
                  <Button
                    variant="link-danger"
                    onClick={() => setPendingDelete(course)}
                    disabled={deletingId === course.id}
                  >
                    {deletingId === course.id ? 'Deleting…' : 'Delete'}
                  </Button>
                </CourseCard>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title={`Delete "${pendingDelete?.name}"?`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              Delete course
            </Button>
          </>
        }
      >
        Its assignments, submissions and enrollments are deleted too. This cannot be undone.
      </Modal>
    </div>
  );
}
