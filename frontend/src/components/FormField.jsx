export default function FormField({ label, name, error, hint, multiline = false, ...inputProps }) {
  const Control = multiline ? 'textarea' : 'input';
  const describedBy = error ? `${name}-error` : hint ? `${name}-hint` : undefined;

  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium">
        {label}
      </label>
      <Control
        id={name}
        name={name}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        className={`mt-1.5 block w-full rounded-md border bg-white px-3 py-2.5 placeholder:text-slate-400 focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink ${
          error ? 'border-red-600' : 'border-line'
        }`}
        {...inputProps}
      />
      {hint && !error && (
        <p id={`${name}-hint`} className="mt-1.5 text-sm text-slate-600">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${name}-error`} className="mt-1.5 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
