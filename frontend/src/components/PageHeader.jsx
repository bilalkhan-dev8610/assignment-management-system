// Consistent page/section heading: a title, an optional description line, and
// optional right-aligned actions (buttons/links) that wrap under the title on narrow screens.
export default function PageHeader({ title, description, actions, level = 1 }) {
  const Heading = `h${level}`;
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <Heading className="font-serif text-3xl font-semibold">{title}</Heading>
        {description && <p className="mt-1 text-slate-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}
