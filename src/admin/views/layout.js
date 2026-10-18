// The shell every browser page shares: header, stylesheet, toast, and the page's own scripts.
export const page = (body, scripts = []) => `<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>Traktor</title><link rel=icon type=image/svg+xml href="/logo.svg"><link rel=stylesheet href="/css/app.css"></head>
<body><header><div><a class=brand href="/">Traktor</a><small>for AIOStreams</small></div></header><main>${body}</main><div id=toast class=toast></div>
${['common', ...scripts].map((s) => `<script src="/js/${s}.js"></script>`).join('')}</body></html>`;

export const msg = (kind, title, text) => page(`<div class="card msg ${kind}"><h2>${title}</h2><p class=sub>${text}</p><a class="btn ghost" href="?">Back to the list</a></div>`);
