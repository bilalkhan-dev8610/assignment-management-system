import { Link, useParams } from 'react-router-dom';
import BackLink from '../components/BackLink.jsx';
import Card from '../components/Card.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import Loader from '../components/Loader.jsx';
import PageHeader from '../components/PageHeader.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import TypeBadge from '../components/TypeBadge.jsx';
import useLoad from '../hooks/useLoad.js';
import { getCourseAssignments } from '../services/assignmentService.js';
import { getCourse } from '../services/courseService.js';
import { formatDateTime } from '../utils/format.js';

export default function StudentCourseDetails() {
  const { id } = useParams();
  const { data: course, error, loading } = useLoad(() => getCourse(id), [id]);

  return (
    <div className="w-full max-w-2xl">
      <BackLink to="/student">Back to my courses</BackLink>

      {loading && (
        <div className="mt-6">
          <Loader label="Loading course…" />
        </div>
      )}
      <div className="mt-6">
        <ErrorMessage>{error}</ErrorMessage>
      </div>

      {course && (
        <div className="mt-6">
          <PageHeader title={course.name} description={`${course.code} · Taught by ${course.professor_name}`} />
          <p className="mt-6 whitespace-pre-line">{course.description || 'No description has been added for this course.'}</p>

          <CourseAssignments courseId={id} />
        </div>
      )}
    </div>
  );
}

// Only rendered once the course itself loaded, i.e. once the API confirmed the student is enrolled.
function CourseAssignments({ courseId }) {
  const { data: assignments, error, loading } = useLoad(() => getCourseAssignments(courseId), [courseId]);
  const submittedCount = assignments?.filter((assignment) => assignment.submission_status === 'submitted').length;

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">Assignments</h2>

      {assignments && assignments.length > 0 && (
        <div className="mt-3 max-w-xs">
          <ProgressBar
            value={submittedCount}
            max={assignments.length}
            label={`${submittedCount} of ${assignments.length} assignments submitted`}
          />
        </div>
      )}

      <div className="mt-4 w-full space-y-3">
        {loading && <Loader label="Loading assignments…" />}
        <ErrorMessage>{error}</ErrorMessage>

        {assignments && assignments.length === 0 && (
          <EmptyState title="No assignments yet">Your professor has not posted any assignments for this course.</EmptyState>
        )}

        {assignments && assignments.length > 0 && (
          <ul className="w-full space-y-3">
            {assignments.map((assignment) => (
              <li key={assignment.id} className="w-full min-w-0">
                <Card
                  as={Link}
                  to={`/student/assignments/${assignment.id}`}
                  interactive
                  padding="p-4"
                  className="block w-full min-w-0"
                >
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <span className="block break-words font-serif text-lg font-semibold">{assignment.title}</span>
                      <p className="mt-1 break-words text-sm text-slate-600">
                        Due {formatDateTime(assignment.deadline)}
                      </p>
                    </div>
                    <div className="shrink-0 self-start">
                      <StatusBadge status={assignment.submission_status} />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <TypeBadge type={assignment.submission_type} />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}