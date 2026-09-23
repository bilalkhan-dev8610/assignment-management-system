// A single real number with its label, used in dashboard summary rows.
export default function StatCard({ value, label }) {
  return (
    <div className="rounded-lg border border-line bg-white px-5 py-4">
      <p className="font-serif text-2xl font-semibold">{value}</p>
      <p className="text-sm text-slate-600">{label}</p>
    </div>
  );
}
