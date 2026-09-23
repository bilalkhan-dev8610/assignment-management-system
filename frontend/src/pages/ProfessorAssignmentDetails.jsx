import { Link, useParams } from 'react-router-dom';
import Alert from '../components/Alert.jsx';
import BackLink from '../components/BackLink.jsx';
import Button from '../components/Button.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import Loader from '../components/Loader.jsx';
import PageHeader from '../components/PageHeader.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import TypeBadge from '../components/TypeBadge.jsx';
import useFlashNotice from '../hooks/useFlashNotice.js';
import useLoad from '../hooks/useLoad.js';
import { getAssignment } from '../services/assignmentService.js';
import { formatDateTime } from '../utils/format.js';

export default function ProfessorAssignmentDetails() {
  const { id } = useParams();
  const [notice] = useFlashNotice();
  const { data: assignment, error, loading } = useLoad(() => getAssignment(id), [id]);
  const isGroup = assignment?.submission_type === 'group';
  const total = assignment && (isGroup ? assignment.group_count : assignment.student_count);

  return (
    <div className="max-w-2xl">
      <BackLink to={assignment ? `/professor/courses/${assignment.course_id}/assignments` : '/professor'}>
        Back to assignments
      </BackLink>

      <div className="mt-6 space-y-4">
        {notice && <Alert type="success">{notice}</Alert>}
        {loading && <Loader label="Loading assignment…" />}
        <ErrorMessage>{error}</ErrorMessage>
      </div>

      {assignment && (
        <div className="mt-2">
          <p className="text-sm font-medium text-slate-600">
            {assignment.course_code} {assignment.course_name}
          </p>
          <PageHeader title={assignment.title} />
          <p className="mt-4 whitespace-pre-line">{assignment.description}</p>

          <dl className="mt-6 grid gap-4 rounded-lg border border-line bg-white p-5 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-slate-600">Deadline</dt>
              <dd className="font-medium">{formatDateTime(assignment.deadline)}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-600">Submission type</dt>
              <dd className="mt-0.5">
                <TypeBadge type={assignment.submission_type} />
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm text-slate-600">{isGroup ? 'Groups submitted' : 'Students submitted'}</dt>
              <dd className="mt-1.5 max-w-xs">
                <ProgressBar value={assignment.submitted_count} max={total} />
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-600">Last updated</dt>
              <dd className="font-medium">{formatDateTime(assignment.updated_at)}</dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button as={Link} to={`/professor/assignments/${assignment.id}/${isGroup ? 'groups' : 'submissions'}`}>
              {isGroup ? 'View groups' : 'View submissions'}
            </Button>
            <Button as={Link} to={`/professor/assignments/${assignment.id}/edit`} variant="secondary">
              Edit assignment
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
