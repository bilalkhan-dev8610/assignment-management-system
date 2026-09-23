import { useState } from 'react';
import { useParams } from 'react-router-dom';
import BackLink from '../components/BackLink.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import Loader from '../components/Loader.jsx';
import PageHeader from '../components/PageHeader.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import useLoad from '../hooks/useLoad.js';
import { getAssignment, getSubmissions } from '../services/assignmentService.js';
import { formatDateTime } from '../utils/format.js';

const FILTERS = [
  { value: '', label: 'All students' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'not_submitted', label: 'Not submitted' },
];

export default function AssignmentSubmissions() {
  const { id } = useParams();
  const [status, setStatus] = useState('');
  const { data: assignment, error: assignmentError } = useLoad(() => getAssignment(id), [id]);
  const { data: rows, error: listError, loading } = useLoad(() => getSubmissions(id, status), [id, status]);
  const error = assignmentError || listError;

  return (
    <div>
      <BackLink to={`/professor/assignments/${id}`}>Back to assignment</BackLink>
      <div className="mt-4">
        <PageHeader title="Submissions" description={assignment?.title} />
      </div>

      {assignment && (
        <div className="mt-4 max-w-xs">
          <ProgressBar
            value={assignment.submitted_count}
            max={assignment.student_count}
            label={`${assignment.submitted_count} of ${assignment.student_count} students submitted`}
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
            {loading && <Loader label="Loading submissions…" />}

            {rows && rows.length === 0 && (
              <EmptyState title="No students to show">
                {status ? 'No students match this filter.' : 'No students are enrolled in this course yet.'}
              </EmptyState>
            )}

            {rows && rows.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-line bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line bg-paper text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-medium">Student</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Submitted</th>
                      <th className="px-4 py-3 font-medium">Submission</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rows.map((row) => (
                      <tr key={row.student_id}>
                        <td className="px-4 py-3 align-top">
                          <div className="font-medium">{row.name}</div>
                          <div className="text-slate-600">{row.email}</div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="px-4 py-3 align-top">{row.submitted_at ? formatDateTime(row.submitted_at) : 'Not yet'}</td>
                        <td className="max-w-xs whitespace-pre-line break-words px-4 py-3 align-top">{row.content || 'None'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
