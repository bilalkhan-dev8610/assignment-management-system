import { useState } from 'react';
import Card from './Card.jsx';
import ErrorMessage from './ErrorMessage.jsx';
import Loader from './Loader.jsx';
import SubmitButton from './SubmitButton.jsx';
import useLoad from '../hooks/useLoad.js';
import { createGroup, getGroupCandidates } from '../services/groupService.js';

// Form for a student without a group: pick classmates and a leader. The student
// filling it in is always a member and leads unless someone else is chosen.
export default function CreateGroupForm({ assignmentId, onCreated }) {
  const { data, error: loadError, loading } = useLoad(() => getGroupCandidates(assignmentId), [assignmentId]);
  const [selected, setSelected] = useState([]); // ids of the classmates to add
  const [leaderId, setLeaderId] = useState(null); // null means "me"
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  if (loading) return <Loader label="Loading classmates…" />;
  if (loadError) return <ErrorMessage>{loadError}</ErrorMessage>;

  const { students, max_members: maxMembers } = data;
  const isFull = selected.length + 1 >= maxMembers; // +1 for me
  const chosenLeader = leaderId !== null && selected.includes(leaderId) ? leaderId : null;

  const toggle = (id) => {
    setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFieldErrors({});
    setFormError('');
    setSaving(true);
    try {
      const group = await createGroup(assignmentId, {
        member_ids: selected,
        ...(chosenLeader !== null && { leader_id: chosenLeader }),
      });
      onCreated(group);
    } catch (err) {
      setFieldErrors(err.errors || {});
      setFormError(err.errors ? err.errors.leader_id || '' : err.message);
      setSaving(false);
    }
  };

  return (
    <Card as="form" onSubmit={handleSubmit} noValidate className="space-y-5">
      <p className="text-slate-700">
        You are not in a group for this assignment yet. A group has up to {maxMembers} members, including you.
      </p>

      {formError && <ErrorMessage>{formError}</ErrorMessage>}

      <fieldset aria-describedby={fieldErrors.member_ids ? 'member_ids-error' : undefined}>
        <legend className="text-sm font-medium">Add classmates</legend>
        {students.length === 0 ? (
          <p className="mt-1.5 text-sm text-slate-600">No classmates are available. You can still create a group of one.</p>
        ) : (
          <ul className="mt-1.5 grid gap-2 sm:grid-cols-2">
            {students.map((student) => {
              const checked = selected.includes(student.id);
              return (
                <li key={student.id}>
                  <label
                    className={`flex items-center gap-2 rounded-md border border-line px-3 py-2 has-[:checked]:border-ink has-[:checked]:bg-ink/5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink ${
                      !checked && isFull ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!checked && isFull}
                      onChange={() => toggle(student.id)}
                      className="accent-ink focus:outline-none"
                    />
                    {student.name}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        {fieldErrors.member_ids && (
          <p id="member_ids-error" className="mt-1.5 text-sm text-red-700">
            {fieldErrors.member_ids}
          </p>
        )}
      </fieldset>

      <div>
        <label htmlFor="leader" className="block text-sm font-medium">
          Group leader
        </label>
        <select
          id="leader"
          value={chosenLeader === null ? '' : String(chosenLeader)}
          onChange={(event) => setLeaderId(event.target.value === '' ? null : Number(event.target.value))}
          className="mt-1.5 rounded-md border border-line bg-white px-3 py-2.5 focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink"
        >
          <option value="">Me</option>
          {students
            .filter((student) => selected.includes(student.id))
            .map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
              </option>
            ))}
        </select>
        <p className="mt-1.5 text-sm text-slate-600">The leader is the only one who can acknowledge the submission.</p>
      </div>

      <SubmitButton loading={saving} loadingText="Creating group…">
        Create group
      </SubmitButton>
    </Card>
  );
}
