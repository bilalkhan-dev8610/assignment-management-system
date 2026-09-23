import { Navigate, Outlet } from 'react-router-dom';
import { getToken, getUser } from '../utils/session.js';
import { homePathFor } from '../utils/roles.js';

// Wraps routes that need a signed-in user, optionally of one role.
//   no token           -> /login
//   wrong role         -> that user's own dashboard
// This only decides what to show. The API enforces access on every request.
export default function ProtectedRoute({ role }) {
  const user = getUser();
  if (!getToken() || !user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={homePathFor(user.role)} replace />;
  return <Outlet />;
}
