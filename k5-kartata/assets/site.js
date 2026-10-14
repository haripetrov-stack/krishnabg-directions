/* k5-kartata: small shared behaviour. Menu button below 900px, and links to pages that do not exist yet stay inert. */
(function () {
  'use strict';
  var d = document;
  d.documentElement.classList.add('js');

  d.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[aria-disabled="true"]');
    if (a) e.preventDefault();
  });

  var btn = d.querySelector('.nav__btn'), ul = d.getElementById('menu');
  if (!btn || !ul) return;
  var mq = matchMedia('(max-width: 899px)'), open = false;
  btn.parentNode.classList.add('is-js');
  function sync() {
    ul.hidden = mq.matches ? !open : false;
    btn.setAttribute('aria-expanded', mq.matches ? String(open) : 'false');
  }
  btn.addEventListener('click', function () { open = !open; sync(); });
  d.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && open) { open = false; sync(); btn.focus(); }
  });
  if (mq.addEventListener) mq.addEventListener('change', function () { open = false; sync(); });
  sync();
})();
