import AcknowledgementBadge from './AcknowledgementBadge.jsx';
import Button from './Button.jsx';
import Card from './Card.jsx';
import ErrorMessage from './ErrorMessage.jsx';
import { Spinner } from './Loader.jsx';
import StatusBadge from './StatusBadge.jsx';
import { formatDateTime } from '../utils/format.js';

// The student's own group: leader, members, submission and acknowledgement.
// Only the leader gets the Acknowledge button. Everyone else just sees the status.
// (Hiding the button is a convenience; the API refuses non-leaders on its own.)
export default function GroupPanel({ group, currentUserId, onAcknowledge, acknowledging, error }) {
  const { leader, members, submission } = group;
  const isLeader = leader.id === currentUserId;
  const submitted = submission.status === 'submitted';
  const canAcknowledge = isLeader && submitted && !submission.acknowledged;

  return (
    <Card className="space-y-5">
      <div>
        <h3 className="text-sm text-slate-600">Group leader</h3>
        <p className="font-medium">
          {leader.name}
          {isLeader && ' (you)'}
        </p>
      </div>

      <div>
        <h3 className="text-sm text-slate-600">Members</h3>
        <ul className="mt-1 space-y-0.5">
          {members.map((member) => (
            <li key={member.id} className="font-medium">
              {member.name}
              {member.id === leader.id && <span className="font-normal text-slate-600"> (leader)</span>}
              {member.id === currentUserId && <span className="font-normal text-slate-600"> (you)</span>}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="text-sm text-slate-600">Group submission</h3>
          <div className="mt-1">
            <StatusBadge status={submission.status} />
          </div>
          {submitted && (
            <p className="mt-1 text-sm text-slate-600">
              Submitted by {submission.submitted_by_name} on {formatDateTime(submission.submitted_at)}
            </p>
          )}
        </div>
        <div>
          <h3 className="text-sm text-slate-600">Acknowledgement</h3>
          <div className="mt-1">
            <AcknowledgementBadge acknowledged={submission.acknowledged} />
          </div>
          {submission.acknowledged && (
            <p className="mt-1 text-sm text-slate-600">On {formatDateTime(submission.acknowledged_at)}</p>
          )}
        </div>
      </div>

      <ErrorMessage>{error}</ErrorMessage>

      {canAcknowledge && (
        <Button onClick={onAcknowledge} disabled={acknowledging} aria-busy={acknowledging || undefined}>
          {acknowledging && <Spinner />}
          {acknowledging ? 'Acknowledging…' : 'Acknowledge submission'}
        </Button>
      )}
      {!canAcknowledge && !submission.acknowledged && (
        <p className="text-sm text-slate-600">
          {isLeader
            ? 'Once your group has submitted, you can acknowledge the submission here.'
            : 'Only the group leader can acknowledge the submission.'}
        </p>
      )}
    </Card>
  );
}
