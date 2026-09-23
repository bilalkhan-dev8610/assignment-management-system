import { forwardRef } from 'react';

// Two families: boxed actions (primary/secondary) and inline text actions
// (link/link-danger), sharing one focus style so keyboard use is consistent.
const BOX_BASE =
  'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';
const LINK_BASE =
  'inline-flex items-center gap-1.5 rounded-sm font-medium underline underline-offset-2 hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

const VARIANTS = {
  primary: `${BOX_BASE} bg-ink text-white hover:bg-ink/90`,
  secondary: `${BOX_BASE} border border-ink text-ink hover:bg-ink hover:text-white`,
  danger: `${BOX_BASE} bg-red-700 text-white hover:bg-red-800`,
  link: `${LINK_BASE} text-ink`,
  'link-danger': `${LINK_BASE} text-red-700`,
};

const SIZES = { md: 'px-4 py-2.5 text-sm', sm: 'px-3 py-1.5 text-sm' };
const BOX_VARIANTS = new Set(['primary', 'secondary', 'danger']);

// Polymorphic action element. Renders a <button> by default, or any component
// via `as` (e.g. React Router's Link) so navigation and actions look the same.
const Button = forwardRef(function Button(
  { as: Component = 'button', variant = 'primary', size = 'md', full = false, className = '', type, ...props },
  ref
) {
  const isBox = BOX_VARIANTS.has(variant);
  const isNativeButton = Component === 'button';
  const classes = [VARIANTS[variant], isBox ? SIZES[size] : '', full ? 'w-full' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <Component ref={ref} type={isNativeButton ? type || 'button' : undefined} className={classes} {...props} />
  );
});

export default Button;
