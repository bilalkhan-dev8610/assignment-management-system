import { Outlet, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import { logout } from '../services/authService.js';
import { getUser } from '../utils/session.js';

// Shell for signed-in pages: a skip link, the responsive nav, and the page content.
export default function AppLayout() {
  const navigate = useNavigate();
  const user = getUser();

  const signOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      <Navbar user={user} onSignOut={signOut} />

      <main id="main-content" className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
