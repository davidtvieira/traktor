function toast(t, err) {
  var e = document.getElementById('toast');
  e.textContent = t;
  e.className = 'toast show' + (err ? ' err' : '');
  clearTimeout(window.tt);
  window.tt = setTimeout(function () { e.className = 'toast'; }, 3500);
}
// The clipboard API needs HTTPS, so copy through a temporary textarea with the older copy command, which works on plain http.
function cp(b) {
  var e = document.createElement('textarea'), ok = false;
  e.value = b.dataset.url;
  document.body.appendChild(e);
  e.select();
  try { ok = document.execCommand('copy'); } catch (x) { /* fall through to the clipboard API */ }
  document.body.removeChild(e);
  if (!ok && navigator.clipboard) { navigator.clipboard.writeText(b.dataset.url); ok = true; }
  toast(ok ? (b.dataset.msg || 'Copied') : 'Copy failed', !ok);
}
