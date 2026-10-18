// The POST side of /auth: save lists, disconnect a user, or finish a Trakt login. Each returns the page to show.
import { knownViewers, deleteTokens } from '../storage/token-store.js';
import { setPicks } from '../storage/user-store.js';
import { cleanViewer } from '../util/ids.js';
import { log } from '../util/log.js';
import { finishLogin } from './login.js';
import { msg } from './views/layout.js';

function saveLists(f) {
  const viewer = cleanViewer(f.get('listsfor'));
  if (!knownViewers().includes(viewer)) return msg('err', 'Not connected', 'Connect this user to Trakt first.');
  const picks = f.getAll('pick').filter((x) => /^[a-z0-9-]{1,40}$/.test(x));
  setPicks(viewer, picks);
  log(`lists saved: ${picks.length} selected`, viewer);
  return msg('good', 'Lists saved', 'AIOStreams may take a few minutes to show the change. Save the addon there again if it does not.');
}

function disconnect(f) {
  const viewer = cleanViewer(f.get('disconnect'));
  if (!knownViewers().includes(viewer)) return msg('err', 'Not connected', 'That user has no Trakt account linked.');
  deleteTokens(viewer);
  log('disconnected from Trakt', viewer);
  return msg('good', 'Disconnected', 'The Trakt account was unlinked. You can connect it again from the list.');
}

async function connect(f) {
  const viewer = await finishLogin((f.get('url') || '').trim(), f.get('state'));
  if (viewer === null) return msg('err', 'Expired or invalid', 'Start again from the list.');
  log('connected to Trakt', viewer);
  return msg('good', 'Connected', 'Trakt is linked. Syncing starts automatically.');
}

export async function adminSubmit(raw) {
  const f = new URLSearchParams(raw);
  if (f.has('listsfor')) return saveLists(f);
  if (f.has('disconnect')) return disconnect(f);
  return connect(f);
}
