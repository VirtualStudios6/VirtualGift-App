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
