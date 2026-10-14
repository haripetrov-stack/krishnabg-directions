/* Menu sheet (native <dialog>) and inert links to pages that do not exist yet. */
(function () {
  'use strict';
  var dlg = document.getElementById('menu');
  var openB = document.getElementById('menu-open');
  var closeB = document.getElementById('menu-close');
  if (dlg && openB) {
    openB.addEventListener('click', function () {
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
      openB.setAttribute('aria-expanded', 'true');
      if (closeB) closeB.focus();
    });
    var shut = function () { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); };
    if (closeB) closeB.addEventListener('click', shut);
    // a click on the dimmed backdrop lands on the dialog element itself
    dlg.addEventListener('click', function (e) { if (e.target === dlg) shut(); });
    dlg.addEventListener('close', function () {
      openB.setAttribute('aria-expanded', 'false');
      openB.focus();
    });
  }
  Array.prototype.forEach.call(document.querySelectorAll('a[aria-disabled="true"]'), function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); });
  });
})();
