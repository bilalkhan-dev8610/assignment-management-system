import Badge from './Badge.jsx';
import { typeLabel } from '../utils/format.js';

// Individual vs group, shown next to assignment titles.
export default function TypeBadge({ type }) {
  return <Badge tone={type === 'group' ? 'info' : 'neutral'}>{typeLabel(type)}</Badge>;
}
