export default function RadioGroup({ legend, name, options, value, onChange, error, hint }) {
  const describedBy = error ? `${name}-error` : hint ? `${name}-hint` : undefined;

  return (
    <fieldset aria-describedby={describedBy}>
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="mt-1.5 grid grid-cols-2 gap-3">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-2 rounded-md border border-line bg-white px-3 py-2.5 has-[:checked]:border-ink has-[:checked]:bg-ink/5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={onChange}
              className="accent-ink focus:outline-none"
            />
            {option.label}
          </label>
        ))}
      </div>
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
    </fieldset>
  );
}
