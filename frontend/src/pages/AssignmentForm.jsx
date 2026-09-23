import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import BackLink from '../components/BackLink.jsx';
import Card from '../components/Card.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import FormField from '../components/FormField.jsx';
import Loader from '../components/Loader.jsx';
import PageHeader from '../components/PageHeader.jsx';
import RadioGroup from '../components/RadioGroup.jsx';
import SubmitButton from '../components/SubmitButton.jsx';
import useLoad from '../hooks/useLoad.js';
import { createAssignment, getAssignment, updateAssignment } from '../services/assignmentService.js';
import { getCourse } from '../services/courseService.js';
import { isoToLocalInput, localInputToIso } from '../utils/format.js';

const TYPE_OPTIONS = [
  { value: 'individual', label: 'Individual' },
  { value: 'group', label: 'Group' },
];

// One form for both routes:
//   /professor/courses/:courseId/assignments/new   (create)
//   /professor/assignments/:id/edit                (edit)
export default function AssignmentForm() {
  const { courseId, id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState({ title: '', description: '', deadline: '', submission_type: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Edit: load the assignment. Create: load the course, which checks it is yours and gives its name.
  const { data, error: loadError, loading } = useLoad(
    () => (isEdit ? getAssignment(id) : getCourse(courseId)),
    [id, courseId]
  );
  const courseName = data && (isEdit ? data.course_name : data.name);
  const backTo = isEdit ? `/professor/assignments/${id}` : `/professor/courses/${courseId}/assignments`;

  useEffect(() => {
    if (isEdit && data) {
      setForm({
        title: data.title,
        description: data.description,
        deadline: isoToLocalInput(data.deadline),
        submission_type: data.submission_type,
      });
    }
  }, [isEdit, data]);

  const handleChange = (event) => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFieldErrors({});
    setFormError('');
    setSaving(true);

    const details = {
      title: form.title,
      description: form.description,
      deadline: localInputToIso(form.deadline),
      submission_type: form.submission_type,
    };

    try {
      if (isEdit) {
        await updateAssignment(id, details);
        navigate(`/professor/assignments/${id}`, { state: { notice: 'Assignment updated' } });
      } else {
        await createAssignment({ ...details, course_id: Number(courseId) });
        navigate(`/professor/courses/${courseId}/assignments`, { state: { notice: 'Assignment created' } });
      }
    } catch (err) {
      setFieldErrors(err.errors || {});
      // Errors for fields that are not on the form (course_id, body) and non-field errors go in the alert.
      setFormError(err.errors ? err.errors.course_id || err.errors.body || '' : err.message);
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl">
      <BackLink to={backTo}>Back</BackLink>
      <div className="mt-4">
        <PageHeader title={isEdit ? 'Edit assignment' : 'Create assignment'} description={courseName ? `Course: ${courseName}` : undefined} />
      </div>

      {loading && (
        <div className="mt-6">
          <Loader />
        </div>
      )}
      <div className="mt-6">
        <ErrorMessage>{loadError}</ErrorMessage>
      </div>

      {!loading && !loadError && (
        <Card as="form" onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
          {formError && <ErrorMessage>{formError}</ErrorMessage>}

          <FormField label="Title" name="title" value={form.title} onChange={handleChange} error={fieldErrors.title} required />
          <FormField
            label="Description"
            name="description"
            multiline
            rows={5}
            value={form.description}
            onChange={handleChange}
            error={fieldErrors.description}
            required
          />
          <FormField
            label="Deadline"
            name="deadline"
            type="datetime-local"
            value={form.deadline}
            onChange={handleChange}
            error={fieldErrors.deadline}
            hint="Your local time. Students cannot submit after this moment."
            required
          />
          <RadioGroup
            legend="Submission type"
            name="submission_type"
            options={TYPE_OPTIONS}
            value={form.submission_type}
            onChange={handleChange}
            error={fieldErrors.submission_type}
            hint="For a group assignment, students form their own groups and each group submits once."
          />

          <SubmitButton loading={saving} loadingText="Saving…">
            {isEdit ? 'Save changes' : 'Create assignment'}
          </SubmitButton>
        </Card>
      )}
    </div>
  );
}
