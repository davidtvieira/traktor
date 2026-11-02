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
  return [].map.call(document.querySelectorAll('input[name=pick]:checked, input[name=shared]:checked, #shown select.srt, input.hmc:not(:checked)'), function (x) { return (x.classList.contains('hmc') ? '-' : '') + x.value; }).join(',');
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

// Drag a shown list by its handle to put it in order: the row follows the pointer, the others slide out of its way, and it settles into its place.
// Nothing moves in the page until the drop. The arrows stay for the keyboard.
(function () {
  var D = null;
  var MS = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180;

  // How far the dragged row sits from its start when it is at index j.
  function offsetFor(d, j) {
    var y = 0, k;
    if (j > d.i) for (k = d.i + 1; k <= j; k++) y += d.hs[k] + d.gap;
    else for (k = j; k < d.i; k++) y -= d.hs[k] + d.gap;
    return y;
  }

  // Put the dragged row under the pointer and slide the rows it has passed.
  function layout() {
    var y = Math.max(D.min, Math.min(D.max, D.dy)), center = D.tops[D.i] + D.hs[D.i] / 2 + y, j = 0, k;
    for (k = 0; k < D.rows.length; k++) if (k !== D.i && D.tops[k] + D.hs[k] / 2 < center) j++;
    D.j = j;
    D.rows.forEach(function (r, n) {
      if (n === D.i) { r.style.transform = 'translateY(' + y + 'px) scale(1.01)'; return; }
      var s = 0;
      if (n > D.i && n <= j) s = -(D.hs[D.i] + D.gap);
      else if (n < D.i && n >= j) s = D.hs[D.i] + D.gap;
      r.style.transform = s ? 'translateY(' + s + 'px)' : '';
    });
  }

  function follow(clientY) {
    D.clientY = clientY;
    D.dy = clientY - D.startY + (window.scrollY - D.startScroll);
    layout();
  }

  // Scroll the page while the row is held near its top or bottom edge.
  function tick() {
    if (!D) return;
    var y = D.clientY, v = 0;
    if (y < 70) v = -Math.ceil((70 - y) / 5); else if (window.innerHeight - y < 70) v = Math.ceil((70 - (window.innerHeight - y)) / 5);
    if (v) { window.scrollBy(0, v); follow(y); }
    D.raf = requestAnimationFrame(tick);
  }

  function end(e, cancelled) {
    if (!D || e.pointerId !== D.id) return;
    var d = D;
    D = null;
    cancelAnimationFrame(d.raf);
    if (cancelled) d.j = d.i;
    // Let the row glide into its slot, then make the move real and clear the helper styles in the same frame.
    d.rows.forEach(function (r) { r.style.transition = 'transform ' + MS + 'ms ease'; });
    d.r.style.transform = 'translateY(' + offsetFor(d, d.j) + 'px)';
    d.rows.forEach(function (r, n) {
      if (n === d.i) return;
      var s = 0;
      if (n > d.i && n <= d.j) s = -(d.hs[d.i] + d.gap);
      else if (n < d.i && n >= d.j) s = d.hs[d.i] + d.gap;
      r.style.transform = s ? 'translateY(' + s + 'px)' : '';
    });
    setTimeout(function () {
      d.rows.forEach(function (r) { r.style.transition = 'none'; r.style.transform = ''; });
      if (d.j !== d.i) d.box.insertBefore(d.r, d.rows.filter(function (r) { return r !== d.r; })[d.j] || null);
      d.r.classList.remove('drag');
      document.body.classList.remove('dragging');
      requestAnimationFrame(function () { d.rows.forEach(function (r) { r.style.transition = ''; }); });
      chk();
    }, MS + 20);
  }

  document.addEventListener('pointerdown', function (e) {
    var g = e.target.closest && e.target.closest('.grip');
    if (D || !g || e.button > 0 || !g.closest('#shown')) return;
    e.preventDefault();
    var r = g.closest('.lr'), box = r.parentNode;
    var rows = [].filter.call(box.children, function (c) { return c.classList.contains('lr'); });
    var rects = rows.map(function (x) { return x.getBoundingClientRect(); });
    D = {
      r: r, box: box, rows: rows, i: rows.indexOf(r), j: rows.indexOf(r), id: e.pointerId,
      startY: e.clientY, startScroll: window.scrollY, clientY: e.clientY, dy: 0,
      tops: rects.map(function (b) { return b.top + window.scrollY; }), hs: rects.map(function (b) { return b.height; }),
    };
    D.gap = rows.length > 1 ? D.tops[1] - D.tops[0] - D.hs[0] : 0;
    D.min = D.tops[0] - D.tops[D.i];
    D.max = D.tops[rows.length - 1] + D.hs[rows.length - 1] - D.tops[D.i] - D.hs[D.i];
    rows.forEach(function (x) { x.style.transition = x === r ? 'none' : 'transform ' + MS + 'ms ease'; });
    r.classList.add('drag');
    document.body.classList.add('dragging');
    try { g.setPointerCapture(e.pointerId); } catch (x) { /* the document still gets the moves */ }
    D.raf = requestAnimationFrame(tick);
  });
  document.addEventListener('pointermove', function (e) { if (D && e.pointerId === D.id) follow(e.clientY); });
  document.addEventListener('pointerup', function (e) { end(e, false); });
  document.addEventListener('pointercancel', function (e) { end(e, true); });
})();
