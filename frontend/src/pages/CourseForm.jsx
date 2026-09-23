import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import BackLink from '../components/BackLink.jsx';
import Card from '../components/Card.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import FormField from '../components/FormField.jsx';
import Loader from '../components/Loader.jsx';
import PageHeader from '../components/PageHeader.jsx';
import SubmitButton from '../components/SubmitButton.jsx';
import useLoad from '../hooks/useLoad.js';
import { createCourse, getCourse, updateCourse } from '../services/courseService.js';

// One form for both routes: /professor/courses/new and /professor/courses/:id/edit
export default function CourseForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', code: '', description: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // When editing, load the course and fill the form. When creating there is nothing to load.
  const { data: existing, error: loadError, loading } = useLoad(
    () => (isEdit ? getCourse(id) : Promise.resolve(null)),
    [id]
  );
  useEffect(() => {
    if (existing) {
      setForm({ name: existing.name, code: existing.code, description: existing.description || '' });
    }
  }, [existing]);

  const handleChange = (event) => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFieldErrors({});
    setFormError('');
    setSaving(true);
    try {
      if (isEdit) {
        await updateCourse(id, form);
      } else {
        await createCourse(form);
      }
      navigate('/professor', { state: { notice: isEdit ? 'Course updated' : 'Course created' } });
    } catch (err) {
      setFieldErrors(err.errors || {});
      setFormError(err.errors ? '' : err.message);
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl">
      <BackLink to="/professor">Back to my courses</BackLink>
      <div className="mt-4">
        <PageHeader title={isEdit ? 'Edit course' : 'Create course'} level={1} />
      </div>

      {isEdit && loading && (
        <div className="mt-6">
          <Loader label="Loading course…" />
        </div>
      )}
      <div className="mt-6">
        <ErrorMessage>{loadError}</ErrorMessage>
      </div>

      {!(isEdit && loading) && !loadError && (
        <Card as="form" onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
          {formError && <ErrorMessage>{formError}</ErrorMessage>}

          <FormField
            label="Course name"
            name="name"
            value={form.name}
            onChange={handleChange}
            error={fieldErrors.name}
            required
          />
          <FormField
            label="Course code"
            name="code"
            value={form.code}
            onChange={handleChange}
            error={fieldErrors.code}
            hint="Must be unique. Saved in capitals, for example CS101."
            required
          />
          <FormField
            label="Description (optional)"
            name="description"
            multiline
            rows={4}
            value={form.description}
            onChange={handleChange}
            error={fieldErrors.description}
          />

          <SubmitButton loading={saving} loadingText="Saving…">
            {isEdit ? 'Save changes' : 'Create course'}
          </SubmitButton>
        </Card>
      )}
    </div>
  );
}
