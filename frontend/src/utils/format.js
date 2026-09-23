const pad = (n) => String(n).padStart(2, '0');

export function formatDateTime(iso) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export const isPast = (iso) => new Date(iso).getTime() < Date.now();

export const typeLabel = (type) => (type === 'group' ? 'Group' : 'Individual');

// <input type="datetime-local"> holds local time without a timezone ("2030-05-01T17:00"),
// while the API wants a full timestamp. These two convert between them.
export function isoToLocalInput(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function localInputToIso(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toISOString(); // invalid or empty: let the API report it
}
