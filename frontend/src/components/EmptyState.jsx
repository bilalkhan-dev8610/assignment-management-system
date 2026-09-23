export default function EmptyState({ title, action, children }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-white px-6 py-10 text-center">
      <p className="font-serif text-lg font-semibold">{title}</p>
      {children && <div className="mt-2 text-slate-600">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
