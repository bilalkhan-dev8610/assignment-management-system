import { useState } from 'react';
import { useParams } from 'react-router-dom';
import AcknowledgementBadge from '../components/AcknowledgementBadge.jsx';
import BackLink from '../components/BackLink.jsx';
import Card from '../components/Card.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import Loader from '../components/Loader.jsx';
import PageHeader from '../components/PageHeader.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import useLoad from '../hooks/useLoad.js';
import { getAssignment } from '../services/assignmentService.js';
import { getAssignmentGroups } from '../services/groupService.js';
import { formatDateTime } from '../utils/format.js';

const FILTERS = [
  { value: '', label: 'All groups' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'not_submitted', label: 'Not submitted' },
];

// Professor view of a group assignment: every group with leader, members,
// submission status and acknowledgement status.
export default function AssignmentGroups() {
  const { id } = useParams();
  const [status, setStatus] = useState('');
  const { data: assignment, error: assignmentError } = useLoad(() => getAssignment(id), [id]);
  const { data: groups, error: listError, loading } = useLoad(() => getAssignmentGroups(id, status), [id, status]);
  const error = assignmentError || listError;

  return (
    <div>
      <BackLink to={`/professor/assignments/${id}`}>Back to assignment</BackLink>
      <div className="mt-4">
        <PageHeader title="Groups" description={assignment?.title} />
      </div>

      {assignment && (
        <div className="mt-4 max-w-xs">
          <ProgressBar
            value={assignment.submitted_count}
            max={assignment.group_count}
            label={`${assignment.submitted_count} of ${assignment.group_count} groups submitted`}
          />
        </div>
      )}

      <div className="mt-6">
        <ErrorMessage>{error}</ErrorMessage>
      </div>

      {!error && (
        <div className="mt-6">
          <label htmlFor="status-filter" className="block text-sm font-medium">
            Show
          </label>
          <select
            id="status-filter"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="mt-1.5 rounded-md border border-line bg-white px-3 py-2.5 focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink"
          >
            {FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>

          <div className="mt-4">
            {loading && <Loader label="Loading groups…" />}

            {groups && groups.length === 0 && (
              <EmptyState title="No groups to show">
                {status ? 'No groups match this filter.' : 'Students have not formed any groups yet.'}
              </EmptyState>
            )}

            {groups && groups.length > 0 && (
              <ul className="grid gap-4 sm:grid-cols-2">
                {groups.map((group) => (
                  <li key={group.id}>
                    <Card>
                      <h2 className="font-serif text-lg font-semibold">Group {group.id}</h2>
                      <p className="mt-2 text-sm text-slate-600">Leader</p>
                      <p className="font-medium">{group.leader.name}</p>
                      <p className="mt-2 text-sm text-slate-600">Members</p>
                      <p className="font-medium">{group.members.map((member) => member.name).join(', ')}</p>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <StatusBadge status={group.submission.status} />
                        <AcknowledgementBadge acknowledged={group.submission.acknowledged} />
                      </div>
                      {group.submission.status === 'submitted' && (
                        <>
                          <p className="mt-2 text-sm text-slate-600">
                            Submitted by {group.submission.submitted_by_name} on {formatDateTime(group.submission.submitted_at)}
                          </p>
                          <p className="mt-2 whitespace-pre-line break-words text-sm">{group.submission.content}</p>
                        </>
                      )}
                      {group.submission.acknowledged && (
                        <p className="mt-2 text-sm text-slate-600">
                          Acknowledged on {formatDateTime(group.submission.acknowledged_at)}
                        </p>
                      )}
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
