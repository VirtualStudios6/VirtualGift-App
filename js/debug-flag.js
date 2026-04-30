// Set VG_DEBUG=true in the browser console (or via localStorage) to enable vgLog output.
// In production builds debug logging is silenced without touching any call sites.
window.vgLog = (function () {
  const enabled =
    (typeof localStorage !== 'undefined' && localStorage.getItem('VG_DEBUG') === 'true') ||
    (typeof window !== 'undefined' && window.VG_DEBUG === true);
  return enabled ? console.log.bind(console) : function () {};
})();
