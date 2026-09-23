import { Link } from 'react-router-dom';

// The "Back to X" link at the top of every drill-down page.
export default function BackLink({ to, children }) {
  return (
    <Link to={to} className="text-sm font-medium text-ink underline underline-offset-2 hover:no-underline">
      {children}
    </Link>
  );
}
