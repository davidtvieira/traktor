export const isoAt = (s) => new Date((s ?? Date.now() / 1000) * 1000).toISOString();
export const epochSeconds = (iso) => Math.floor(Date.parse(iso) / 1000);
export const pad2 = (n) => String(n).padStart(2, '0');
export function ago(at) {
  const m = Math.floor((Date.now() - at) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.floor(h / 24)} d ago`;
}
