// Insertion-ordered Map that drops its oldest entries past `max`.
export function setBounded(map, key, value, max) {
  map.delete(key); map.set(key, value);
  while (map.size > max) map.delete(map.keys().next().value);
}
