import { Link } from 'react-router-dom';
import Button from '../components/Button.jsx';
import CourseCard from '../components/CourseCard.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { SkeletonGrid } from '../components/SkeletonCard.jsx';
import useLoad from '../hooks/useLoad.js';
import { getStudentCourses } from '../services/courseService.js';
import { getUser } from '../utils/session.js';

export default function StudentDashboard() {
  const { data: courses, error, loading } = useLoad(getStudentCourses);
  const user = getUser();

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
            Your professor enrolls you in a course; once that happens, it will show up here.
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
    </div>
  );
}
