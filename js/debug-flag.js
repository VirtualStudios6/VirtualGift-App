// ── Logging de desarrollo ───────────────────────────────────────────────────
// Activa logs con localStorage.setItem('VG_DEBUG','true') en la consola.
window.vgLog = (function () {
  const enabled =
    (typeof localStorage !== 'undefined' && localStorage.getItem('VG_DEBUG') === 'true') ||
    (typeof window !== 'undefined' && window.VG_DEBUG === true);
  return enabled ? console.log.bind(console) : function () {};
})();

// ── Detección de entorno ────────────────────────────────────────────────────
// VG_IS_DEV = true cuando NO estamos en el dominio de producción.
// Usado por admob.js para activar TEST_MODE automáticamente.
// NUNCA confiar en este flag para lógica de seguridad crítica.
window.VG_IS_DEV = (function () {
  if (typeof location === 'undefined') return false;
  const h = location.hostname;
  // Dominio de producción conocido
  if (h === 'virtualgift.pro') return false;
  // Hosts de desarrollo típicos
  return (
    !h ||
    h === 'localhost' ||
    h.startsWith('192.168.') ||
    h.startsWith('10.')    ||
    h.startsWith('172.')   ||
    h.endsWith('.local')   ||
    h.endsWith('.test')
  );
})();
