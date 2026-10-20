// Catalog entries as another Stremio addon (META_ADDON_URL, e.g. AIOMetadata) describes them, so a tile's title and poster match the addon that serves the page it opens.
import { config } from '../../config.js';
import { setBounded } from '../../util/bounded-map.js';
import { mapLimit } from '../../util/concurrency.js';

const TTL = 6 * 3600 * 1000;
const RETRY = 60 * 1000;          // a failed lookup is not asked again for a minute
const MAX = 3000;
const memo = new Map();           // type:id -> { at, ok, fields }
const FIELDS = ['name', 'releaseInfo', 'poster'];

async function lookup(type, id) {
  const key = `${type}:${id}`;
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < (hit.ok ? TTL : RETRY)) return hit.fields;
  let fields = null;
  try {
    const res = await fetch(`${config.metaAddon.url}/meta/${type}/${id}.json`, { signal: AbortSignal.timeout(8000) });
    const meta = res.ok ? (await res.json()).meta : null;
    if (meta?.name) fields = Object.fromEntries(FIELDS.map((k) => [k, meta[k]]));
  } catch { /* keep the original entry */ }
  setBounded(memo, key, { at: Date.now(), ok: !!fields, fields }, MAX);
  return fields;
}

// Each entry takes the addon's title and poster where it has them; the rest stays as it was. A no-op when META_ADDON_URL is not set.
export async function enrich(metas, type) {
  if (!config.metaAddon.url) return metas;
  return mapLimit(metas, 8, async (m) => {
    const f = await lookup(type, m.id);
    if (!f) return m;
    return { ...m, ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)) };
  });
}
