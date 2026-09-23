import Badge from './Badge.jsx';

// Whether the group leader has acknowledged the group's submission.
export default function AcknowledgementBadge({ acknowledged }) {
  return <Badge tone={acknowledged ? 'info' : 'neutral'}>{acknowledged ? 'Acknowledged' : 'Not acknowledged'}</Badge>;
}
