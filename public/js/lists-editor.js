// The lists page: tick, reorder, and save a user's lists.
function mv(b, d) {
  var r = b.closest('.lr'), s = d < 0 ? r.previousElementSibling : r.nextElementSibling;
  if (s && s.classList.contains('lr')) r.parentNode.insertBefore(d < 0 ? r : s, d < 0 ? s : r);
  chk();
}
function tg(c) {
  var r = c.closest('.lr');
  if (c.checked) { document.getElementById('shown').appendChild(r); chk(); return; }
  var gl = [].filter.call(document.querySelectorAll('.gl'), function (x) { return x.dataset.g === r.dataset.g; })[0];
  if (!gl) return;
  var after = [].filter.call(gl.children, function (x) { return +x.dataset.i > +r.dataset.i; })[0];
  gl.insertBefore(r, after || null);
  chk();
}
function state() {
  return [].map.call(document.querySelectorAll('input[name=pick]:checked'), function (x) { return x.value; }).join(',');
}
var base = state();
function chk() { document.getElementById('sv').disabled = state() === base; }
function saveLists(f) {
  var b = document.getElementById('sv');
  b.disabled = true;
  fetch('', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(new FormData(f)) })
    .then(function (r) {
      return r.text().then(function (t) {
        var ok = r.ok && t.indexOf('msg good') > -1;
        if (!ok) return toast('Could not save lists', true);
        base = state();
        toast('Lists saved. Copy the script again and update the variant.');
        // The saved revision changes the script's address: pick up the fresh script.
        return fetch(location.href).then(function (g) { return g.text(); }).then(function (h) {
          var n = new DOMParser().parseFromString(h, 'text/html').getElementById('cs'), c = document.getElementById('cs');
          if (n && c) c.dataset.url = n.dataset.url;
        });
      });
    })
    .catch(function () { toast('Could not save lists', true); })
    .then(chk);
  return false;
}
