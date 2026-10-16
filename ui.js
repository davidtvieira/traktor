// HTML for the browser pages: shared styles and the static pages.
export const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CSS = `
:root{--bg:#0d0d0d;--card:#1a1a1a;--card2:#232323;--line:#2e2e2e;--text:#f2f2f2;--mute:#9a9a9a;--red:#ed1c24;--red2:#ff3b42;--green:#3ddc84}
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
.user .btn,.user button,.user form{flex:none;white-space:nowrap}h1,h2{overflow-wrap:anywhere}
.btn,button{display:inline-block;border:0;border-radius:999px;padding:9px 20px;background:var(--red);color:#fff;font:600 14px inherit;font-family:inherit;text-decoration:none;cursor:pointer;transition:.15s}
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
<title>Traktor</title><link rel=icon type=image/svg+xml href="/logo.svg"><style>${CSS}</style>
<header><div><img class=logo src="/logo.svg" alt="">Traktor<small>for AIOStreams</small></div></header><main>${body}</main></html>`;
export const msg = (kind, title, text) => page(`<div class="card msg ${kind}"><h2>${title}</h2><p class=sub>${text}</p><a class="btn ghost" href="?">Back to the list</a></div>`);

export const about = () => page(`<img class=hero src="/logo.svg" alt=""><h1 style="text-align:center">Traktor</h1><p class=sub style="text-align:center">Keeps AIOStreams and Trakt in sync.</p>
<div class=card><ol class=steps>
<li><b>Plays go to Trakt</b><p>What you watch in the AIOStreams app or a Jellyfin client is sent to Trakt as scrobbles and history.</p></li>
<li><b>Trakt comes back to AIOStreams</b><p>Your in-progress items, watched history, watchlist, ratings and dropped shows fill Continue Watching and Next Up.</p></li>
<li><b>One Trakt account per user</b><p>Each AIOStreams user can link their own Trakt account.</p></li>
</ol></div>
<div class=card style="margin-top:16px"><b>Install</b><p class=sub>In AIOStreams, go to Addons, Marketplace, Custom Addon, paste this addon's manifest URL, then Install and Save.</p><p class=sub>Stremio playback does not report to addons, so only AIOStreams app and Jellyfin plays are written to Trakt.</p></div>
<footer style="text-align:center"><a class=btn href="/auth">Manage AIOStreams users</a></footer>`);

