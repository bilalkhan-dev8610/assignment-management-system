import { Navigate } from 'react-router-dom';
import { getToken, getUser } from '../utils/session.js';
import { homePathFor } from '../utils/roles.js';

// Used for "/" and unknown URLs: signed-in users go to their dashboard, others to /login.
export default function RedirectHome() {
  const user = getUser();
  return <Navigate to={getToken() && user ? homePathFor(user.role) : '/login'} replace />;
}
