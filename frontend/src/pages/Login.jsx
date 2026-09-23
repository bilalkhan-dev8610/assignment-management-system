import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Alert from '../components/Alert.jsx';
import FormField from '../components/FormField.jsx';
import SubmitButton from '../components/SubmitButton.jsx';
import { login } from '../services/authService.js';
import { homePathFor } from '../utils/roles.js';

export default function Login() {
  const navigate = useNavigate();
  const { state } = useLocation(); // set by the register page after a successful sign-up
  const [searchParams] = useSearchParams(); // ?session=expired is set when the API rejects the token
  const [form, setForm] = useState({ email: state?.email || '', password: '' });
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
      const user = await login(form);
      navigate(homePathFor(user.role), { replace: true });
    } catch (err) {
      setFieldErrors(err.errors || {});
      setFormError(err.errors ? '' : err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="font-serif text-3xl font-semibold">Sign in</h1>
      <p className="mt-2 text-slate-600">Use the email and password you registered with.</p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
        {state?.registered && <Alert type="success">Account created. Sign in to continue.</Alert>}
        {searchParams.get('session') === 'expired' && <Alert>Your session has ended. Sign in again to continue.</Alert>}
        {formError && <Alert>{formError}</Alert>}

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
          autoComplete="current-password"
          value={form.password}
          onChange={handleChange}
          error={fieldErrors.password}
          required
        />

        <SubmitButton loading={loading} loadingText="Signing in…">
          Sign in
        </SubmitButton>
      </form>

      <p className="mt-6 text-sm text-slate-600">
        New here?{' '}
        <Link to="/register" className="font-medium text-ink underline underline-offset-2">
          Create an account
        </Link>
      </p>
    </div>
  );
}
