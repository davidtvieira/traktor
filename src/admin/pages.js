// The GET side of /auth: gathers the data for each page and hands it to a view.
import { aioUsers, traktorInstanceId } from '../aiostreams/users.js';
import { config } from '../config.js';
import { runAs } from '../context.js';
import { availableLists, chosenLists } from '../features/lists/index.js';
import { getActivity } from '../features/activity/store.js';
import { publicBase } from '../http/request.js';
import { catalogKey, getPicks, getRev } from '../storage/user-store.js';
import { viewerStates } from '../storage/token-store.js';
import { cleanViewer } from '../util/ids.js';
import { esc } from '../util/html.js';
import { beginLogin, isOob } from './login.js';
import { connectPage } from './views/connect.js';
import { msg } from './views/layout.js';
import { listsPage } from './views/lists.js';
import { usersPage } from './views/users.js';

async function usersIndex(req) {
  const users = await aioUsers();
  const states = viewerStates();
  const rows = users.map((u) => ({
    user: u,
    state: states[u.id],
    activity: getActivity(u.id),
    calendarUrl: states[u.id] === 'ok' ? `${publicBase(req)}/u/${catalogKey(u.id)}/calendar.ics` : '',
  }));
  return usersPage(rows, `${publicBase(req)}/manifest.json`);
}

// The AIOStreams script that points the Traktor addon at this user's own address and keeps the catalogs in Traktor's order.
async function variantScript(req, viewer, key) {
  const rev = getRev(viewer);
  const addr = `${publicBase(req)}/u/${key}/manifest.json${rev ? `?r=${rev}` : ''}`;
  await aioUsers().catch(() => {});
  const orderLine = traktorInstanceId() ? `\nadd upstreamCatalogOrder "${traktorInstanceId()}"` : '';
  return `enable presets[options.name="Traktor"]\nset presets[options.name="Traktor"].options.manifestUrl = "${addr}"${orderLine}`;
}

async function listsIndex(req, viewer, user) {
  const key = catalogKey(viewer);
  if (!key) return msg('err', 'Not connected', 'Connect this user to Trakt first.');
  let avail;
  try { avail = await runAs(viewer, () => availableLists(viewer, true)); }
  catch (e) { return msg('err', 'Could not load lists', esc(e.message).slice(0, 300)); }
  const chosen = chosenLists(avail, getPicks(viewer));
  return listsPage({ user, viewer, avail, chosen, script: await variantScript(req, viewer, key) });
}

function connectIndex(user, viewer) {
  const { state, link } = beginLogin(viewer);
  return connectPage({ user, link, state, redirectUri: config.trakt.redirectUri, oob: isOob });
}

export async function adminPage(url, req) {
  if (!url.searchParams.has('viewer') && !url.searchParams.has('owner')) return usersIndex(req);
  const viewer = url.searchParams.has('owner') ? '' : cleanViewer(url.searchParams.get('viewer'));
  const user = (await aioUsers()).find((u) => u.id === viewer);
  if (!user) return msg('err', 'Unknown user', 'That user does not exist in AIOStreams.');
  if (url.searchParams.has('lists')) return listsIndex(req, viewer, user);
  return connectIndex(user, viewer);
}
