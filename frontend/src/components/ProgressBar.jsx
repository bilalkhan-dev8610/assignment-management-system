// A determinate progress bar with its own "N of M" caption. Built only from
// counts the caller already has from the API, never an invented percentage.
export default function ProgressBar({ value, max, label }) {
  const safeMax = max > 0 ? max : 0;
  const percent = safeMax > 0 ? Math.round((value / safeMax) * 100) : 0;

  return (
    <div>
      {label && <p className="text-sm text-slate-600">{label}</p>}
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || 'Progress'}
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-line"
      >
        <div
          className="h-full rounded-full bg-ink transition-[width] motion-safe:duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
