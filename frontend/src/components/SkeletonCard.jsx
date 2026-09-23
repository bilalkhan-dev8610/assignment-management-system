// Placeholder shaped like a course/assignment card, shown instead of a blank
// area while a list loads, so the layout does not jump once data arrives.
export default function SkeletonCard() {
  return (
    <div className="h-full rounded-lg border border-line bg-white p-5 motion-safe:animate-pulse" aria-hidden="true">
      <div className="h-3 w-16 rounded bg-line" />
      <div className="mt-3 h-5 w-3/4 rounded bg-line" />
      <div className="mt-4 h-3 w-full rounded bg-line" />
      <div className="mt-2 h-3 w-5/6 rounded bg-line" />
    </div>
  );
}

// A grid of skeleton cards with one accessible "loading" announcement for the whole group.
export function SkeletonGrid({ count = 3 }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading"
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
}
