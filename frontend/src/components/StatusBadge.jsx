import Badge from './Badge.jsx';

// Submission status as a word and a colour.
export default function StatusBadge({ status }) {
  const submitted = status === 'submitted';
  return <Badge tone={submitted ? 'success' : 'warning'}>{submitted ? 'Submitted' : 'Not submitted'}</Badge>;
}
