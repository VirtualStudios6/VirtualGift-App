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
