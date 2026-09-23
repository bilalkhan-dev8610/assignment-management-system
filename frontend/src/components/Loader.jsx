// Small spinning icon, reused wherever something is in progress (buttons, page loads).
export function Spinner({ className = 'h-4 w-4' }) {
  return (
    <svg className={`motion-safe:animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

// A full loading row: spinner + label. Announced to screen readers as it appears,
// so a page never just goes silently blank while data loads.
export default function Loader({ label = 'Loading…' }) {
  return (
    <p role="status" aria-live="polite" className="flex items-center gap-2 text-slate-600">
      <Spinner />
      {label}
    </p>
  );
}
