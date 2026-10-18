// Short-lived answers from Trakt, kept per user (the key always starts with the viewer) and never shared between users.
// Only the public charts are shared: their key starts with 'public', and they are the same for everyone.
const TTL = 5 * 60 * 1000;
const MAX = 300;
const cache = new Map();          // key -> { at, data }

export async function cached(key, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  const data = await fn();
  cache.delete(key); cache.set(key, { at: Date.now(), data });
  while (cache.size > MAX) cache.delete(cache.keys().next().value);
  return data;
}

export const forget = (key) => cache.delete(key);
