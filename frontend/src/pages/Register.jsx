import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Alert from '../components/Alert.jsx';
import FormField from '../components/FormField.jsx';
import SubmitButton from '../components/SubmitButton.jsx';
import { register } from '../services/authService.js';

const ROLE_OPTIONS = [
  { value: 'student', label: 'Student' },
  { value: 'professor', label: 'Professor' },
];

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFieldErrors({});
    setFormError('');
    setLoading(true);
    try {
      const user = await register(form);
      navigate('/login', { replace: true, state: { registered: true, email: user.email } });
    } catch (err) {
      setFieldErrors(err.errors || {});
      setFormError(err.errors ? '' : err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="font-serif text-3xl font-semibold">Create your account</h1>
      <p className="mt-2 text-slate-600">Choose the role that matches how you will use the app.</p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
        {formError && <Alert>{formError}</Alert>}

        <FormField
          label="Full name"
          name="name"
          autoComplete="name"
          value={form.name}
          onChange={handleChange}
          error={fieldErrors.name}
          required
        />
        <FormField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={handleChange}
          error={fieldErrors.email}
          required
        />
        <FormField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={handleChange}
          error={fieldErrors.password}
          hint="At least 8 characters, with a letter and a number."
          required
        />

        <fieldset aria-describedby={fieldErrors.role ? 'role-error' : undefined}>
          <legend className="text-sm font-medium">I am a</legend>
          <div className="mt-1.5 grid grid-cols-2 gap-3">
            {ROLE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-line bg-white px-3 py-2.5 has-[:checked]:border-ink has-[:checked]:bg-ink/5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink"
              >
                <input
                  type="radio"
                  name="role"
                  value={option.value}
                  checked={form.role === option.value}
                  onChange={handleChange}
                  className="accent-ink focus:outline-none"
                />
                {option.label}
              </label>
            ))}
          </div>
          {fieldErrors.role && (
            <p id="role-error" className="mt-1.5 text-sm text-red-700">
              {fieldErrors.role}
            </p>
          )}
        </fieldset>

        <SubmitButton loading={loading} loadingText="Creating account…">
          Create account
        </SubmitButton>
      </form>

      <p className="mt-6 text-sm text-slate-600">
        Already registered?{' '}
        <Link to="/login" className="font-medium text-ink underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </div>
  );
}
