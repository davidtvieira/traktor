// What is wrong with the setup, for the top of /config: each item says what to fix. Empty when all is well.
import fs from 'node:fs';
import { traktorInstanceId } from '../aiostreams/users.js';
import { config } from '../config.js';
import { getActivity } from '../features/activity/store.js';
import { publicBase } from '../http/request.js';
import { viewerStates } from '../storage/token-store.js';
import { apiPublic } from '../trakt/client.js';
import { TraktError } from '../trakt/errors.js';
import { ago } from '../util/time.js';

const TRAKT_CHECK_TTL = 60_000;
let traktCheck = { at: 0, item: null };

// One cheap public call tells whether Trakt accepts the client ID. Cached so reloading the page does not hit Trakt every time.
async function traktClientProblem() {
  if (Date.now() - traktCheck.at < TRAKT_CHECK_TTL) return traktCheck.item;
  let item = null;
  try {
    await Promise.race([apiPublic('/movies/trending?limit=1'), new Promise((_, no) => setTimeout(() => no(new Error('timeout')), 6000).unref())]);
  } catch (e) {
    item = e instanceof TraktError && (e.status === 401 || e.status === 403)
      ? { level: 'err', title: 'Trakt rejected the Client ID', text: 'Check TRAKT_CLIENT_ID against your app at trakt.tv/oauth/applications.' }
      : { level: 'warn', title: 'Cannot check Trakt', text: `Trakt did not answer (${e.message}). Connecting users needs it to be reachable.` };
  }
  traktCheck = { at: Date.now(), item };
  return item;
}

function dataFolderProblem() {
  try { fs.accessSync(config.dataDir, fs.constants.W_OK); return null; }
  catch { return { level: 'err', title: 'Data folder is not writable', text: `Traktor cannot save logins in ${config.dataDir}. On the host run: chown 1000:1000 data` }; }
}

// users: the AIOStreams users (or [] when they could not be fetched, with usersError set).
export async function setupProblems(req, users, usersError) {
  const items = [];
  const add = (i) => i && items.push(i);

  if (usersError) add({ level: 'err', title: 'Cannot read your AIOStreams users', text: usersError.message });
  else if (!traktorInstanceId()) add({ level: 'warn', title: 'Traktor is not added to AIOStreams yet', text: 'Copy the manifest below and add it as a custom addon.', href: '/help#sync', label: 'How' });

  add(await traktClientProblem());
  if (!/^https:\/\//.test(config.trakt.redirectUri)) add({ level: 'warn', title: 'Redirect URI is not https', text: 'Trakt only accepted https:// addresses. TRAKT_REDIRECT_URI must also match the Trakt app exactly.' });
  if (!config.publicUrl && /^https?:\/\/(localhost|127\.|\[::1\])/.test(publicBase(req))) {
    add({ level: 'warn', title: 'You opened this page as localhost', text: 'The addresses it copies will not work from AIOStreams. Open it by its network address, or set PUBLIC_URL.' });
  }
  add(dataFolderProblem());

  const states = viewerStates();
  for (const u of users) {
    const href = `/config/${u.owner ? 'owner' : encodeURIComponent(u.id)}/connect`;
    if (states[u.id] === 'reauth') add({ level: 'err', title: `${u.name}: Trakt login expired`, text: 'Connect again to resume syncing.', href, label: 'Reconnect' });
    else if (states[u.id] === 'ok' && getActivity(u.id)?.error) {
      const { at, text } = getActivity(u.id).error;
      add({ level: 'warn', title: `${u.name}: last sync failed ${ago(at)}`, text });
    }
  }
  return items.sort((a, b) => (a.level === b.level ? 0 : a.level === 'err' ? -1 : 1));
}
