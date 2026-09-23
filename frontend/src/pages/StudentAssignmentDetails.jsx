import { useState } from 'react';
import { useParams } from 'react-router-dom';
import Alert from '../components/Alert.jsx';
import BackLink from '../components/BackLink.jsx';
import CreateGroupForm from '../components/CreateGroupForm.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import FormField from '../components/FormField.jsx';
import GroupPanel from '../components/GroupPanel.jsx';
import Loader from '../components/Loader.jsx';
import PageHeader from '../components/PageHeader.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import SubmitButton from '../components/SubmitButton.jsx';
import TypeBadge from '../components/TypeBadge.jsx';
import useLoad from '../hooks/useLoad.js';
import { getAssignment, getMySubmission, submitAssignment } from '../services/assignmentService.js';
import { acknowledgeGroup, getMyGroup } from '../services/groupService.js';
import { formatDateTime, isPast } from '../utils/format.js';
import { getUser } from '../utils/session.js';

// Everything this page shows: the assignment, the student's submission status (their own
// for an individual assignment, their group's for a group assignment) and, for a
// group assignment, the student's group (null when they are not in one yet).
async function loadAll(id) {
  const assignment = await getAssignment(id);
  const isGroup = assignment.submission_type === 'group';
  const [submission, group] = await Promise.all([getMySubmission(id), isGroup ? getMyGroup(id) : null]);
  return { assignment, submission, group };
}

export default function StudentAssignmentDetails() {
  const { id } = useParams();
  const currentUserId = getUser()?.id;
  const { data, setData, error, loading } = useLoad(() => loadAll(id), [id]);

  const [content, setContent] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const [acknowledgeError, setAcknowledgeError] = useState('');

  const { assignment, submission, group } = data || {};
  const isGroup = assignment?.submission_type === 'group';

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFieldErrors({});
    setFormError('');
    setSaving(true);
    try {
      const created = await submitAssignment(id, content);
      // A group's submission also changes what the group panel shows, so reload the group.
      const updatedGroup = isGroup ? await getMyGroup(id) : null;
      setData((prev) => ({ ...prev, submission: created, group: updatedGroup }));
      setJustSubmitted(true);
    } catch (err) {
      setFieldErrors(err.errors || {});
      setFormError(err.errors ? '' : err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAcknowledge = async () => {
    setAcknowledgeError('');
    setAcknowledging(true);
    try {
      const updatedGroup = await acknowledgeGroup(group.id);
      setData((prev) => ({
        ...prev,
        group: updatedGroup,
        submission: { ...prev.submission, acknowledged: updatedGroup.submission.acknowledged },
      }));
    } catch (err) {
      setAcknowledgeError(err.message);
    } finally {
      setAcknowledging(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <BackLink to={assignment ? `/student/courses/${assignment.course_id}` : '/student'}>Back to course</BackLink>

      {loading && (
        <div className="mt-6">
          <Loader label="Loading assignment…" />
        </div>
      )}
      <div className="mt-6">
        <ErrorMessage>{error}</ErrorMessage>
      </div>

      {assignment && (
        <div className="mt-6">
          <p className="text-sm font-medium text-slate-600">
            {assignment.course_code} {assignment.course_name}
          </p>
          <PageHeader title={assignment.title} />
          <p className="mt-4 whitespace-pre-line">{assignment.description}</p>

          <dl className="mt-6 grid gap-4 rounded-lg border border-line bg-white p-5 sm:grid-cols-3">
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
            <div>
              <dt className="text-sm text-slate-600">{isGroup ? 'Group status' : 'Status'}</dt>
              <dd className="mt-0.5">
                <StatusBadge status={submission.status} />
              </dd>
            </div>
          </dl>

          {isGroup && (
            <section className="mt-8">
              <h2 className="text-lg font-semibold">Your group</h2>
              <div className="mt-4">
                {group ? (
                  <GroupPanel
                    group={group}
                    currentUserId={currentUserId}
                    onAcknowledge={handleAcknowledge}
                    acknowledging={acknowledging}
                    error={acknowledgeError}
                  />
                ) : (
                  <CreateGroupForm
                    assignmentId={id}
                    onCreated={(created) => setData((prev) => ({ ...prev, group: created }))}
                  />
                )}
              </div>
            </section>
          )}

          <section className="mt-8">
            <h2 className="text-lg font-semibold">{isGroup ? 'Group submission' : 'Your submission'}</h2>

            <div className="mt-4">
              {submission.status === 'submitted' ? (
                <div className="space-y-3">
                  {justSubmitted && <Alert type="success">Assignment submitted.</Alert>}
                  <p className="text-sm text-slate-600">
                    Submitted{submission.submitted_by_name ? ` by ${submission.submitted_by_name}` : ''} on{' '}
                    {formatDateTime(submission.submitted_at)}
                  </p>
                  <p className="whitespace-pre-line break-words rounded-lg border border-line bg-white p-4">{submission.content}</p>
                </div>
              ) : isGroup && !group ? (
                <Alert type="info">Create your group above before submitting.</Alert>
              ) : isPast(assignment.deadline) ? (
                <Alert>The deadline has passed, so this assignment can no longer be submitted.</Alert>
              ) : (
                <form onSubmit={handleSubmit} noValidate className="space-y-5">
                  {formError && <ErrorMessage>{formError}</ErrorMessage>}
                  <FormField
                    label={isGroup ? "Your group's work" : 'Your work'}
                    name="content"
                    multiline
                    rows={6}
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    error={fieldErrors.content}
                    hint={
                      isGroup
                        ? 'Type the answer or paste a link. Any member can submit, once, for the whole group.'
                        : 'Type your answer or paste a link to your work. You can submit once.'
                    }
                    required
                  />
                  <SubmitButton loading={saving} loadingText="Submitting…">
                    {isGroup ? 'Submit for group' : 'Submit assignment'}
                  </SubmitButton>
                </form>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
