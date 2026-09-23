import Card from './Card.jsx';

// One course. `meta` is a short line under the name; children are the actions.
export default function CourseCard({ course, meta, children }) {
  return (
    <Card as="article" className="flex h-full flex-col">
      <p className="text-sm font-medium text-slate-600">{course.code}</p>
      <h3 className="mt-1 font-serif text-xl font-semibold leading-snug">{course.name}</h3>
      {meta && <p className="mt-2 text-sm text-slate-600">{meta}</p>}
      {course.description && <p className="mt-3 line-clamp-3 text-slate-700">{course.description}</p>}
      {children && <div className="mt-auto flex flex-wrap items-center gap-4 pt-5">{children}</div>}
    </Card>
  );
}
