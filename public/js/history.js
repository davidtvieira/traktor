// The "last actions" dialog on the users page.
var hd = document.getElementById('hd');
function hist(b) {
  var w = b.closest('.who');
  document.getElementById('ht').textContent = w.querySelector('b').textContent;
  document.getElementById('hl').innerHTML = w.querySelector('.hist').innerHTML;
  document.getElementById('hs').textContent = 'Showing the last ' + hd.dataset.max + ' actions';
  hd.showModal();
}
hd.addEventListener('click', function (e) { if (e.target === hd) hd.close(); });
