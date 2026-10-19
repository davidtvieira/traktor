// The shell every browser page shares: header, stylesheet, toast, and the page's own scripts.
// The start time goes on every asset address, so a browser or proxy that kept an older copy fetches the new one after an update.
const V = Date.now().toString(36);
export const page = (body, scripts = []) => `<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>Traktor</title><link rel=icon type=image/svg+xml href="/logo.svg"><link rel=stylesheet href="/css/app.css?v=${V}"></head>
<body><header><div><a class=brand href="/">Traktor</a><small>for AIOStreams</small></div></header><main>${body}</main><div id=toast class=toast></div>
${['common', ...scripts].map((s) => `<script src="/js/${s}.js?v=${V}"></script>`).join('')}</body></html>`;

export const msg = (kind, title, text, back = { href: '/config', label: 'Back to the list' }) => page(`<div class="card msg ${kind}"><h2>${title}</h2><p class=sub>${text}</p><a class="btn ghost" href="${back.href}">${back.label}</a></div>`);
