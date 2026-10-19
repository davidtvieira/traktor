// Restore: send the chosen backup file to the server, which checks it before replacing anything.
function restorePick() { document.getElementById('rf').click(); }
function restoreFile(input) {
  var f = input.files[0];
  input.value = '';
  if (!f) return;
  if (!confirm('Replace all Trakt logins, lists and addresses with the ones in ' + f.name + '? The current ones are kept beside them as .before-restore files.')) return;
  f.text()
    .then(function (t) { return fetch('/config/restore', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: t }); })
    .then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error(j.error || 'Restore failed');
        toast('Restored ' + j.users + (j.users === 1 ? ' user' : ' users'));
        setTimeout(function () { location.reload(); }, 1200);
      });
    })
    .catch(function (e) { toast(e.message || 'Restore failed', true); });
}
