/* =========================================================
   SPLASH.JS — VirtualGift
   Oculta el splash screen cuando la página termina de cargar.
   Tiempo mínimo: 700ms para que no flashee.
   Tiempo máximo: 4s de failsafe.
   ========================================================= */
(function () {
  var splash  = document.getElementById('vg-splash');
  if (!splash) return;

  var MIN_MS  = 700;
  var start   = Date.now();
  var done    = false;

  function hide() {
    if (done) return;
    done = true;

    var elapsed = Date.now() - start;
    var wait    = Math.max(0, MIN_MS - elapsed);

    setTimeout(function () {
      splash.classList.add('vg-splash--out');
      setTimeout(function () {
        if (splash.parentNode) splash.parentNode.removeChild(splash);
      }, 380);
    }, wait);
  }

  /* Ocultar cuando el navegador dice que todo cargó */
  if (document.readyState === 'complete') {
    hide();
  } else {
    window.addEventListener('load', hide);
  }

  /* Failsafe absoluto */
  setTimeout(hide, 4000);
})();
