// The users page: one row per AIOStreams user, with connect / lists / calendar / disconnect buttons.
import { esc } from '../../util/html.js';
import { ago } from '../../util/time.js';
import { HISTORY_MAX } from '../../features/activity/store.js';
import { ICONS } from './icons.js';
import { page } from './layout.js';

// The "Last sync" line, with an (i) button that opens the recent actions.
function activityLine(a) {
  if (!a?.seen) return 'No updates yet';
  const failed = a.error ? `</span><span class=warn>Last sync failed ${ago(a.error.at)}: ${esc(a.error.text)}</span><span>` : '';
  if (!a.recent?.length) return `Last sync ${ago(a.seen)}${failed}`;
  const info = `<button type=button class=info title="Last ${HISTORY_MAX} actions" aria-label="Last ${HISTORY_MAX} actions" onclick="hist(this)">i</button>`;
  const rows = a.recent.map((r) => `<li>${esc(r.text)} <em>${ago(r.at)}</em></li>`).join('');
  return `Last sync ${ago(a.seen)} ${info}${failed}</span><ul class=hist>${rows}</ul><span hidden>`;
}

const userHref = (u, page) => `/config/${u.owner ? 'owner' : encodeURIComponent(u.id)}/${page}`;

function row({ user: u, state, activity, calendarUrl }) {
  const connected = state === 'ok';
  const sub = u.owner ? 'Primary user' : u.shared ? "Shares the primary user's history" : 'Household user';
  return `<div class=user><div class=av>${esc((u.name || '?').slice(0, 1).toUpperCase())}</div>
<div class=who><b title="${esc(u.name)}">${esc(u.name)}</b><span>${sub}</span>${connected ? `<span>${activityLine(activity)}</span>` : ''}</div>
${connected ? `<button type=button class="ghost ic" title="Copy calendar link" aria-label="Copy calendar link" data-url="${esc(calendarUrl)}" data-msg="Calendar link copied" onclick="cp(this)">${ICONS.calendar}<span class=lb>iCal</span></button>` : ''}
${connected ? `<a class="btn ghost ic" title="Lists" aria-label="Lists" href="${userHref(u, 'lists')}">${ICONS.lists}<span class=lb>Lists</span></a>` : ''}
${connected
  ? `<form method=post style="margin:0" onsubmit="return confirm('Disconnect ${esc(u.name).replace(/'/g, '')} from Trakt?')"><input type=hidden name=disconnect value="${esc(u.id)}"><button class="ghost warn ic" title="Disconnect" aria-label="Disconnect">${ICONS.unlink}<span class=lb>Disconnect</span></button></form>`
  : `<a class=btn href="${userHref(u, 'connect')}">${state === 'reauth' ? 'Reconnect' : 'Connect'}</a>`}</div>`;
}

// The first row: the lists every user sees, and the way for a user with no Trakt account to get them.
const everyoneRow = `<div class=user><div class=av>*</div>
<div class=who><b>Everyone</b><span>Charts shown to every user, no Trakt account needed</span></div>
<a class="btn ghost ic" title="Lists for everyone" aria-label="Lists for everyone" href="/config/all/lists">${ICONS.lists}<span class=lb>Lists</span></a></div>`;

const backupCard = `<div class=card style="margin-top:16px"><div class=user><div class=av>↓</div><div class=who><b>Backup</b><span>Logins, lists and addresses. Keep the file private: it holds Trakt logins.</span></div>
<a class="btn ghost" href="/config/backup" download>Download</a><button type=button class=ghost onclick="restorePick()">Restore</button><input type=file id=rf accept=".json,application/json" hidden onchange="restoreFile(this)"></div></div>`;

const alertsCard = (items) => !items.length ? '' : `<div class="card alerts">${items.map((i) => `<div class=alert data-l="${i.level}"><div><b>${esc(i.title)}</b><span>${esc(i.text)}</span></div>${i.href ? `<a class="btn ghost" href="${i.href}">${esc(i.label)}</a>` : ''}</div>`).join('')}</div>`;

// rows: [{ user, state, activity, calendarUrl }]; alerts: what setupProblems found
export const usersPage = (rows, manifestUrl, alerts = []) => page(`<h1>AIOStreams users</h1><p class=sub>Connect each AIOStreams user to their Trakt account and manage their Trakt lists.</p>${alertsCard(alerts)}<div class=card>${everyoneRow}${rows.map(row).join('')}</div>${backupCard}<footer style="display:grid;gap:10px"><button type=button data-url="${esc(manifestUrl)}" data-msg="Manifest copied" onclick="cp(this)" style="width:100%">Copy manifest</button><a class="btn ghost" href="/" style="display:block;text-align:center">Back</a></footer><dialog id=hd data-max="${HISTORY_MAX}"><h2 id=ht></h2><p id=hs class=sub style="margin:-6px 0 12px"></p><ul id=hl></ul><button type=button class=ghost onclick="hd.close()" style="width:100%">Close</button></dialog>`, ['history', 'backup']);
