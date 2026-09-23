import { Outlet } from 'react-router-dom';

// Shared shell for /login and /register: a ruled side panel and the form beside it.
// On small screens the panel shrinks to a header strip.
export default function AuthLayout() {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[5fr_6fr]">
      <aside className="ruled relative bg-ink py-5 pl-14 pr-6 text-white lg:flex lg:flex-col lg:justify-between lg:py-14 lg:pl-24 lg:pr-16">
        <span aria-hidden="true" className="absolute inset-y-0 left-8 w-px bg-margin lg:left-16" />
        <p className="font-serif text-lg">Assignment Manager</p>
        <h2 className="hidden max-w-xs font-serif text-4xl font-semibold leading-tight lg:block">
          Assignments, from set to submitted.
        </h2>
        <p className="hidden text-sm text-white/60 lg:block">Student &amp; Professor Assignment Management System</p>
      </aside>

      <main className="flex items-center justify-center px-6 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
