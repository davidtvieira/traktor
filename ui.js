// HTML for the browser pages: shared styles and the static pages.
export const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Stroke icons for the buttons on the user list (the title and aria-label carry the meaning).
export const ICONS = {
  calendar: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  lists: '<svg viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
  unlink: '<svg viewBox="0 0 24 24"><path d="M18.84 12.25l1.72-1.71a5 5 0 0 0-7.07-7.07l-1.71 1.71M5.17 11.75l-1.71 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71M8 2v3M2 8h3M16 22v-3M22 16h-3"/></svg>',
};
const CSS = `
:root{--bg:#0d0d0d;--card:#1a1a1a;--card2:#232323;--line:#2e2e2e;--text:#f2f2f2;--mute:#9a9a9a;--red:#ed1c24;--red2:#ff3b42;--green:#3ddc84;--warn:#b79793;--warnline:#4d3b39}
*{box-sizing:border-box}
@view-transition{navigation:auto}
::view-transition-old(root){animation:fadeOut .18s ease both}
::view-transition-new(root){animation:fadeIn .28s ease both}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes fadeOut{to{opacity:0}}
@keyframes rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
main{animation:rise .35s ease both}
@media (prefers-reduced-motion:reduce){main{animation:none}::view-transition-group(*),::view-transition-old(*),::view-transition-new(*){animation:none!important}}
body{margin:0;min-height:100vh;color:var(--text);background:radial-gradient(1200px 500px at 50% -150px,#3a0f11 0%,var(--bg) 70%) no-repeat,var(--bg);
font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
header{border-bottom:1px solid var(--line);background:rgba(13,13,13,.85);backdrop-filter:blur(6px)}
header div{max-width:760px;margin:0 auto;padding:16px 20px;display:flex;align-items:center;gap:10px;font-weight:700;letter-spacing:.2px}
.logo{width:28px;height:28px;display:block}.hero{width:96px;height:96px;display:block;margin:0 auto 18px}
header small{color:var(--mute);font-weight:500;margin-left:auto}
.brand{color:inherit;text-decoration:none}.brand:hover{color:var(--red2)}
main{max-width:760px;margin:0 auto;padding:32px 20px 64px}
h1,h2{margin:0 0 6px;font-size:26px;letter-spacing:-.3px}
.sub{color:var(--mute);margin:0 0 24px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:6px;box-shadow:0 10px 30px rgba(0,0,0,.35)}
.user{display:flex;align-items:center;gap:14px;padding:14px;border-radius:10px}
.user+.user{border-top:1px solid var(--line)}
.user:hover{background:var(--card2)}
.av{width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,var(--red),#7a0c10);display:grid;place-items:center;font-weight:700;flex:none}
.who{flex:1;min-width:0}.who b,.who span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.who span{color:var(--mute);font-size:13px}
.info{all:unset;box-sizing:border-box;display:inline-grid;place-items:center;width:16px;height:16px;border:1px solid var(--mute);border-radius:50%;font:600 11px/1 system-ui,sans-serif;color:var(--mute);cursor:pointer;vertical-align:1px;margin-left:4px}
.hist{display:none}
dialog{width:min(420px,calc(100vw - 32px));border:1px solid var(--line,#8884);border-radius:14px;padding:20px;background:var(--card,var(--bg,#fff));color:inherit}dialog::backdrop{background:#0008}
dialog h2{margin:0 0 12px;font-size:18px}dialog ul{list-style:none;margin:0 0 16px;padding:0;font-size:15px}dialog li{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--line,#8883)}dialog li:last-child{border:0}dialog em{font-style:normal;color:var(--mute);white-space:nowrap}
.user .btn,.user button,.user form{flex:none;white-space:nowrap}h1,h2{overflow-wrap:anywhere}
.btn.ic,button.ic{width:38px;height:38px;padding:0;display:inline-grid;place-items:center}.ic svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.warn,button.ghost.warn{color:var(--warn);border-color:var(--warnline)}button.ghost.warn:hover{border-color:var(--warn);background:rgba(183,151,147,.1)}
html{scroll-behavior:smooth}#sync,#lists,#calendar{scroll-margin-top:16px}.jump{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 24px}.jump .btn{flex:1;text-align:center;white-space:nowrap}.jump .btn{background:rgba(237,28,36,.14);border:1px solid rgba(237,28,36,.45);color:var(--red2)}.jump .btn:hover{background:rgba(237,28,36,.26);border-color:var(--red2)}
.ic .lb{display:none}
@media(min-width:640px){.btn.ic,button.ic{width:auto;height:auto;padding:9px 20px;display:inline-block}.ic svg{display:none}.ic .lb{display:inline}}
.btn,button{display:inline-block;border:0;border-radius:999px;padding:9px 20px;background:var(--red);color:#fff;font-size:16px;font-family:inherit;line-height:1.5;text-decoration:none;cursor:pointer;transition:.15s}
.btn:hover,button:hover{background:var(--red2);transform:translateY(-1px)}
.btn.ghost{background:transparent;border:1px solid var(--line);color:var(--text)}.btn.ghost:hover{border-color:var(--mute);background:var(--card2)}
.steps{counter-reset:s;list-style:none;margin:0;padding:18px}
.steps li{counter-increment:s;position:relative;padding:0 0 22px 46px}
.steps li:before{content:counter(s);position:absolute;left:0;top:0;width:30px;height:30px;border-radius:50%;background:var(--card2);border:1px solid var(--line);display:grid;place-items:center;font-weight:700;color:var(--red2)}
.steps li:not(:last-child):after{content:"";position:absolute;left:14px;top:34px;bottom:4px;width:2px;background:var(--line)}
.steps p{margin:2px 0 10px;color:var(--mute)}
input{width:100%;padding:12px 14px;border-radius:10px;border:1px solid var(--line);background:#101010;color:var(--text);font:15px ui-monospace,Menlo,Consolas,monospace;margin:6px 0 12px}
input:focus{outline:0;border-color:var(--red);box-shadow:0 0 0 3px rgba(237,28,36,.2)}
code{background:var(--card2);padding:2px 7px;border-radius:6px;font-size:13px}
.msg{padding:22px}.msg.err{border-left:4px solid var(--red)}.msg.good{border-left:4px solid var(--green)}
button.ghost{background:transparent;border:1px solid var(--line);color:var(--text)}button.ghost:hover{border-color:var(--mute);background:var(--card2)}
a{color:var(--red2)}footer{margin-top:20px}
`;
export const page = (body) => `<!doctype html><html lang=en><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>Traktor</title><link rel=icon type=image/svg+xml href="/logo.svg"><style>${CSS}.toast{position:fixed;left:50%;bottom:24px;transform:translate(-50%,20px);background:var(--card2);border:1px solid var(--line);border-left:3px solid var(--green);color:var(--text);padding:12px 18px;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.5);opacity:0;pointer-events:none;transition:.25s;max-width:calc(100% - 32px)}.toast.show{opacity:1;transform:translate(-50%,0)}.toast.err{border-left-color:var(--red2)}
</style>
<header><div><a class=brand href="/">Traktor</a><small>for AIOStreams</small></div></header><main>${body}</main><div id=toast class=toast></div><script>function toast(t,err){var e=document.getElementById('toast');e.textContent=t;e.className='toast show'+(err?' err':'');clearTimeout(window.tt);window.tt=setTimeout(function(){e.className='toast'},3500)}</script></html>`;
export const msg = (kind, title, text) => page(`<div class="card msg ${kind}"><h2>${title}</h2><p class=sub>${text}</p><a class="btn ghost" href="?">Back to the list</a></div>`);

export const about = () => page(`<img class=hero src="/logo.svg" alt=""><h1 style="text-align:center">Traktor</h1><p class=sub style="text-align:center">Keeps AIOStreams and Trakt in sync.</p>
<div class=card><ol class=steps>
<li><b>Syncs what you watch</b><p>Plays in AIOStreams go to Trakt, and your Trakt progress fills Continue Watching and Next Up.</p></li>
<li><b>Shows your Trakt lists</b><p>Recommendations, favorites, your own lists and more appear as catalogs in AIOStreams.</p></li>
<li><b>Adds a calendar</b><p>Your upcoming episodes and movies, as a feed for your phone calendar.</p></li>
</ol></div>
<div class=card style="margin-top:16px;border-left:3px solid var(--red)"><div style="padding:14px"><b>Install once</b>
<p class=sub style="margin:6px 0 0">This is a one-time install. Never reinstall the addon in AIOStreams, and don't edit it afterwards: that breaks the link between the addon and your users. To change anything later, update each user's variant instead. See Help.</p></div></div>
<footer style="display:grid;gap:10px;margin-top:20px"><a class=btn href="/auth" style="display:block;text-align:center">Configure addon</a><a class="btn ghost" href="/help" style="display:block;text-align:center">Help</a></footer>`);


export const help = () => page(`<h1>Help</h1><p class=sub>Everything you need to install Traktor and keep your lists up to date.</p>
<nav class=jump><a class=btn href="#sync">Add sync watch</a><a class=btn href="#lists">Lists</a><a class=btn href="#calendar">Calendar</a></nav>
<h2 id=sync>Add sync watch</h2>
<div class=card><ol class=steps>
<li><b>Copy the manifest</b><p>Press Configure addon, then Copy manifest at the bottom of the users list.</p></li>
<li><b>Add it to AIOStreams</b><p>Go to Addons, Marketplace, Custom Addon, paste the link, then press Install and Save.</p></li>
<li><b>Check your users</b><p>Reload AIOStreams. Under Users, make sure each user has Traktor picked.</p></li>
<li><b>Connect Trakt</b><p>Press Configure addon, then Connect next to each user. Sign in to Trakt as that person and approve. Trakt then sends you to a page that may show an error. That is fine: copy the full address from the address bar, paste it back here and press Finish.</p></li>
</ol></div>
<div id=lists style="display:flex;align-items:center;justify-content:space-between;margin-top:28px"><h2 style="margin:0">Add Trakt lists</h2><button type=button class=ghost aria-label="Why is a variant needed?" onclick="var w=document.getElementById('why');w.hidden=!w.hidden" style="width:30px;height:30px;padding:0;border-radius:50%">?</button></div>
<div id=why hidden class=card style="margin-top:12px"><div style="padding:14px">
<b>Why does each user need a variant?</b>
<p class=sub style="margin:6px 0 0">The manifest you copy on the users page is the same for everyone. It only syncs watch state and has no lists in it, because AIOStreams tells Traktor which user is watching for syncing, but not when it asks for lists. Traktor cannot tell whose lists to show.</p>
<p class=sub style="margin:10px 0 0">So each user gets their own address, with their own Trakt lists and their own identity. A variant is how AIOStreams swaps the Traktor addon's address for that user's one. Without it, nobody would see their lists, or everyone would see the same ones.</p>
</div></div>
<p class=sub style="margin:12px 0">Optional. If you do not need lists, skip this step: watch sync works without it.</p>
<div class=card><ol class=steps>
<li><b>Choose the lists</b><p>Press Configure addon, then Lists next to a connected user. Tick the lists you want and press Save lists.</p></li>
<li><b>Copy the script</b><p>On the same page, press Copy script.</p></li>
<li><b>Create a variant</b><p>In AIOStreams open About, Advanced Mode, Miscellaneous, Variants. Create a variant named after the user, paste the script and save.</p></li>
<li><b>Pick it for the user</b><p>Under Users, choose that variant for the user. Repeat for each user, so everyone sees their own lists.</p></li>
</ol></div>
<h2 style="margin-top:28px">Changing or updating lists</h2>
<div class=card><div style="padding:14px">
<p style="margin-top:0"><b>Always update the variant, never the main addon.</b> Reinstalling or editing the main addon breaks the link between the addon and your users.</p>
<p>Whenever you change a user's lists, whether you tick or untick one, add new ones or change the order:</p>
<ol style="margin:0;padding-left:20px;line-height:1.6">
<li>Press <b>Save lists</b>.</li>
<li>Press <b>Copy script</b>.</li>
<li>In AIOStreams open that user's variant, paste the script over the old one and save.</li>
</ol>
<p style="margin:12px 0 0">Each save adds 1 to the number at the end of the address (<code>?r=1</code>, <code>?r=2</code> and so on). That tells AIOStreams to reload the addon, so the new lists and the new order show up. The script also keeps the catalogs in the order you set. Do this for each user whose lists you changed.</p>
<p style="margin:12px 0 0"><b>Still not changing?</b> Restart the AIOStreams container, for example with <code>docker compose down</code> and then <code>docker compose up -d</code> in its folder. This clears its cache. Do not reinstall the addon.</p>
<p class=sub style="margin:12px 0 0">Anyone with a user's address can see that user's chosen lists, so do not share it.</p>
</div></div>
<h2 id=calendar style="margin-top:28px">Add a calendar</h2>
<p class=sub style="margin:12px 0">Optional. Shows each user's upcoming episodes and movies in a phone calendar. Needs no variant.</p>
<div class=card><ol class=steps>
<li><b>Copy the link</b><p>Press Configure addon, then the calendar icon next to a connected user. Each user has their own link.</p></li>
<li><b>Subscribe to it</b><p>Android: add it in ICSx⁵, then tick the new calendar in your calendar app. Google Calendar on the web: Other calendars, From URL. iPhone: Settings, Calendar, Accounts, Add Subscribed Calendar.</p></li>
</ol></div>
<footer><a class="btn ghost" href="/" style="display:block;text-align:center">Back</a></footer>`);
