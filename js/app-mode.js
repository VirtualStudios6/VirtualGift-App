// ── Bloquear AdSense en modo nativo Capacitor ──────────────────────────────
(function () {
  if (!window.Capacitor?.isNativePlatform?.()) return;

  var _adNoop = { push: function () {} };
  try {
    Object.defineProperty(window, 'adsbygoogle', {
      get: function () { return _adNoop; },
      set: function () {},
      configurable: true
    });
  } catch (_) {
    window.adsbygoogle = _adNoop;
  }

  var _s = document.createElement('style');
  _s.textContent = '.adsbygoogle,.ads-container{display:none!important;height:0!important;min-height:0!important;overflow:hidden!important;padding:0!important;margin:0!important}';
  document.head.appendChild(_s);
})();

// ── Modo Android WebView legacy (?app=android) ─────────────────────────────
(function () {
  const isAndroidApp = new URLSearchParams(location.search).get("app") === "android";
  if (!isAndroidApp) return;

  // Marca el <html> inmediato
  document.documentElement.classList.add("android-app");

  // Marca el <body> cuando ya exista
  window.addEventListener("DOMContentLoaded", () => {
    document.body.classList.add("android-app");
  });
})();

// Utilidad global: agrega ?app=android a las URLs cuando la app está en modo Android WebView
window.withAppFlag = function withAppFlag(url) {
  const isAndroidApp =
    document.documentElement.classList.contains("android-app") ||
    (document.body && document.body.classList.contains("android-app"));
  if (!isAndroidApp) return url;
  if (url.includes("app=android")) return url;
  const parts = url.split('#');
  const base  = parts[0];
  const hash  = parts[1] ? ('#' + parts[1]) : '';
  const fixed = base.includes("?") ? (base + "&app=android") : (base + "?app=android");
  return fixed + hash;
};

// ==================== CAPACITOR PLATFORM ====================
// Devuelve true si corre dentro de la app nativa (Android o iOS con Capacitor)
window.isCapacitorNative = function isCapacitorNative() {
  return window.Capacitor?.isNativePlatform?.() === true;
};

// Al cargar en Capacitor nativo, añadir clase "cap-native" al <html>
// para poder aplicar estilos específicos desde CSS si hace falta.
(function () {
  if (!window.Capacitor?.isNativePlatform?.()) return;
  document.documentElement.classList.add('cap-native');
  window.addEventListener('DOMContentLoaded', () => {
    document.body?.classList.add('cap-native');
  });
})();
