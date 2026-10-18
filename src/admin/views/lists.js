// The lists page: tick which of a user's Trakt lists show as catalogs, put them in order, and copy the AIOStreams variant script.
import { esc } from '../../util/html.js';
import { page } from './layout.js';

const ARROW = {
  up: '<svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
};

// avail: every list the user can tick; chosen: the ticked ones, in order.
export function listsPage({ user, viewer, avail, chosen, script }) {
  const chosenIds = new Set(chosen.map((l) => l.id));
  const row = (l) => `<div class=lr data-i="${avail.indexOf(l)}" data-g="${esc(l.group)}"><label style="flex:1;display:flex;align-items:center;min-width:0"><input type=checkbox name=pick value="${esc(l.id)}" onchange="tg(this)" style="width:auto;margin:0 12px 0 0"${chosenIds.has(l.id) ? ' checked' : ''}>${esc(l.name)}</label><span class=mvs><button type=button class="mvb up" onclick="mv(this,-1)" title="Move up" aria-label="Move up">${ARROW.up}</button><button type=button class="mvb dn" onclick="mv(this,1)" title="Move down" aria-label="Move down">${ARROW.down}</button></span></div>`;
  const head = (t) => `<b style="display:block;margin:14px 0 4px;color:var(--mute);font-size:13px">${esc(t)}</b>`;
  const groups = [...new Set(avail.map((l) => l.group))];
  const boxes = `<div class=g>${head('Shown, in this order')}<div id=shown>${chosen.map(row).join('')}</div></div>`
    + groups.map((g) => `<div class=g>${head(g)}<div class=gl data-g="${esc(g)}">${avail.filter((l) => l.group === g && !chosenIds.has(l.id)).map(row).join('')}</div></div>`).join('');

  return page(`<h1>Lists for ${esc(user.name)}</h1><p class=sub>Choose which of this user's Trakt lists to show as catalogs, and use the arrows to put them in order. After saving, copy the script below again and paste it over this user's variant in AIOStreams, see <a href="/help">Help</a>.</p>
<form method=post class=card autocomplete=off onsubmit="return saveLists(this)"><div style="padding:14px"><input type=hidden name=listsfor value="${esc(viewer)}"><div>${boxes}</div><div style="margin-top:12px"><button id=sv disabled style="width:100%">Save lists</button></div></div></form>
<div class=card style="margin-top:16px"><div style="padding:14px"><b>Variant for AIOStreams</b>
<p class=sub style="margin-top:10px">In AIOStreams create a variant named <code>${esc(user.name.toLowerCase())}</code>, paste this as its script, and pick it for this user under Users. It points the <code>Traktor</code> addon at this user's own address, for their watch state and their lists. Anyone with the address can see the chosen lists.</p>
<button type=button id=cs data-url="${esc(script)}" data-msg="Script copied" onclick="cp(this)" style="width:100%;margin-top:6px">Copy script</button></div></div>
<footer><a class="btn ghost" href="?" style="display:block;text-align:center">Back</a></footer>`, ['lists-editor']);
}
