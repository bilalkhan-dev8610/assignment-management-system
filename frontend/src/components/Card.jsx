// Shared surface for content blocks: white background, hairline border, consistent
// radius/padding. `as` lets the same look serve a static block, a link, a form or
// a list item. `interactive` adds hover/focus feedback for clickable cards.
export default function Card({
  as: Component = 'div',
  interactive = false,
  padding = 'p-5',
  className = '',
  children,
  ...props
}) {
  const base = `rounded-lg border border-line bg-white ${padding}`;
  const hover = interactive
    ? 'transition-shadow motion-safe:duration-150 hover:border-ink/40 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ink'
    : '';
  return (
    <Component className={[base, hover, className].filter(Boolean).join(' ')} {...props}>
      {children}
    </Component>
  );
}
