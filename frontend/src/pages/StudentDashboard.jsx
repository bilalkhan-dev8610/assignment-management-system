import { useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/Button.jsx';
import CourseCard from '../components/CourseCard.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { SkeletonGrid } from '../components/SkeletonCard.jsx';
import useLoad from '../hooks/useLoad.js';
import { enrollCourse, getAvailableCourses, getStudentCourses } from '../services/courseService.js';
import { getUser } from '../utils/session.js';

export default function StudentDashboard() {
  const { data: courses, setData: setCourses, error, loading } = useLoad(getStudentCourses);
  const {
    data: availableCourses,
    setData: setAvailableCourses,
    error: availableError,
    loading: availableLoading,
  } = useLoad(getAvailableCourses);
  const [enrollingId, setEnrollingId] = useState(null);
  const [enrollError, setEnrollError] = useState('');
  const user = getUser();

  const handleEnroll = async (courseId) => {
    try {
      setEnrollError('');
      setEnrollingId(courseId);
      const course = await enrollCourse(courseId);
      setCourses((current) => [...(current || []), course]);
      setAvailableCourses((current) => (current || []).filter((item) => item.id !== courseId));
    } catch (err) {
      setEnrollError(err.message);
    } finally {
      setEnrollingId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title={`Welcome back${user?.name ? `, ${user.name.split(' ')[0]}` : ''}`}
        description={
          courses ? `You are enrolled in ${courses.length} ${courses.length === 1 ? 'course' : 'courses'}.` : undefined
        }
      />

      <h2 className="mt-8 text-lg font-semibold">Enrolled courses</h2>

      <div className="mt-4">
        {loading && <SkeletonGrid />}
        <ErrorMessage>{error}</ErrorMessage>

        {courses && courses.length === 0 && (
          <EmptyState title="No courses enrolled yet">
            Enroll in an available course to get started.
          </EmptyState>
        )}

        {courses && courses.length > 0 && (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {courses.map((course) => (
              <li key={course.id}>
                <CourseCard course={course} meta={`Taught by ${course.professor_name}`}>
                  <Button as={Link} to={`/student/courses/${course.id}`} variant="link">
                    View details
                  </Button>
                </CourseCard>
              </li>
            ))}
          </ul>
        )}
      </div>

      <h2 className="mt-8 text-lg font-semibold">Available courses</h2>

      <div className="mt-4">
        {availableLoading && <SkeletonGrid />}
        <ErrorMessage>{availableError || enrollError}</ErrorMessage>

        {availableCourses && availableCourses.length === 0 && (
          <EmptyState title="No available courses">
            You are already enrolled in all currently available courses.
          </EmptyState>
        )}

        {availableCourses && availableCourses.length > 0 && (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {availableCourses.map((course) => (
              <li key={course.id}>
                <CourseCard course={course} meta={`Taught by ${course.professor_name}`}>
                  <Button
                    type="button"
                    onClick={() => handleEnroll(course.id)}
                    disabled={enrollingId === course.id}
                  >
                    {enrollingId === course.id ? 'Enrolling…' : 'Enroll'}
                  </Button>
                </CourseCard>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
