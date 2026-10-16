(function () {
  var d = document.getElementById('menu'), m = window.matchMedia('(min-width:900px)');
  function s() {
    if (!d) return;
    if (m.matches) d.setAttribute('open', ''); else d.removeAttribute('open');
  }
  s();
  if (m.addEventListener) m.addEventListener('change', s); else m.addListener(s);
})();
