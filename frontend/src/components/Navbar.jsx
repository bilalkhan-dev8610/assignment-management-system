import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Badge from './Badge.jsx';
import Button from './Button.jsx';
import { homePathFor } from '../utils/roles.js';

// Responsive top navigation. Name, role and sign-out sit inline on wider
// screens; on narrow ones they collapse behind a toggle so nothing crowds or wraps.
export default function Navbar({ user, onSignOut }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // Close the mobile panel whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const roleLabel = user?.role === 'professor' ? 'Professor' : 'Student';

  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link to={homePathFor(user?.role)} className="font-serif text-lg font-semibold">
          Assignment Manager
        </Link>

        <div className="hidden items-center gap-4 text-sm sm:flex">
          <span className="text-slate-700">{user?.name}</span>
          {user?.role && <Badge tone="neutral">{roleLabel}</Badge>}
          <Button variant="secondary" size="sm" onClick={onSignOut}>
            Sign out
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          className="rounded-md p-2 text-ink hover:bg-ink/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink sm:hidden"
        >
          <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
          <MenuIcon open={open} />
        </button>
      </div>

      {open && (
        <div id="mobile-menu" className="border-t border-line px-4 py-4 sm:hidden">
          <p className="font-medium">{user?.name}</p>
          {user?.role && (
            <div className="mt-1">
              <Badge tone="neutral">{roleLabel}</Badge>
            </div>
          )}
          <Button variant="secondary" size="sm" full onClick={onSignOut} className="mt-4">
            Sign out
          </Button>
        </div>
      )}
    </header>
  );
}

function MenuIcon({ open }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
      {open ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
      )}
    </svg>
  );
}
