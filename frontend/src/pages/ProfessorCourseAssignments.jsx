import { Link, useParams } from 'react-router-dom';
import Alert from '../components/Alert.jsx';
import BackLink from '../components/BackLink.jsx';
import Button from '../components/Button.jsx';
import Card from '../components/Card.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import Loader from '../components/Loader.jsx';
import PageHeader from '../components/PageHeader.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import TypeBadge from '../components/TypeBadge.jsx';
import useFlashNotice from '../hooks/useFlashNotice.js';
import useLoad from '../hooks/useLoad.js';
import { getCourseAssignments } from '../services/assignmentService.js';
import { getCourse } from '../services/courseService.js';
import { formatDateTime } from '../utils/format.js';

export default function ProfessorCourseAssignments() {
  const { courseId } = useParams();
  const [notice] = useFlashNotice();
  const { data: course, error: courseError } = useLoad(() => getCourse(courseId), [courseId]);
  const { data: assignments, error: listError, loading } = useLoad(() => getCourseAssignments(courseId), [courseId]);
  const error = courseError || listError;

  return (
    <div>
      <BackLink to="/professor">Back to my courses</BackLink>

      <div className="mt-6">
        <ErrorMessage>{error}</ErrorMessage>
      </div>

      {course && (
        <>
          <div className="mt-4">
            <PageHeader
              title={course.name}
              description={course.code}
              actions={
                <Button as={Link} to={`/professor/courses/${courseId}/assignments/new`}>
                  Create assignment
                </Button>
              }
            />
          </div>

          <h2 className="mt-8 text-lg font-semibold">Assignments</h2>

          <div className="mt-4 space-y-4">
            {notice && <Alert type="success">{notice}</Alert>}
            {loading && <Loader label="Loading assignments…" />}

            {assignments && assignments.length === 0 && (
              <EmptyState
                title="No assignments yet"
                action={
                  <Button as={Link} to={`/professor/courses/${courseId}/assignments/new`} size="sm">
                    Create the first assignment
                  </Button>
                }
              />
            )}

            {assignments && assignments.length > 0 && (
              <ul className="space-y-3">
                {assignments.map((assignment) => {
                  const isGroup = assignment.submission_type === 'group';
                  const total = isGroup ? assignment.group_count : assignment.student_count;
                  return (
                    <li key={assignment.id}>
                      <Card>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <Link
                            to={`/professor/assignments/${assignment.id}`}
                            className="rounded-sm font-serif text-lg font-semibold underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                          >
                            {assignment.title}
                          </Link>
                          <TypeBadge type={assignment.submission_type} />
                        </div>
                        <p className="mt-1 text-sm text-slate-600">Due {formatDateTime(assignment.deadline)}</p>
                        <div className="mt-3 max-w-xs">
                          <ProgressBar
                            value={assignment.submitted_count}
                            max={total}
                            label={`${assignment.submitted_count} of ${total} ${isGroup ? 'groups' : 'students'} submitted`}
                          />
                        </div>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
