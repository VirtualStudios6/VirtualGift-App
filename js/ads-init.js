/* ═══════════════════════════════════════════════
   ADS-INIT.JS — VirtualGift
   Inicializa anuncios en cada página de la app.
   • Banner inferior permanente (Wortise)
   • Interstitial precargado en ambas redes
   • Global window.showInterstitialIfReady()
   • Solo actúa en plataforma nativa (Capacitor)
═══════════════════════════════════════════════ */
(function () {
  'use strict';

  const BOTTOM_NAV_BANNER_OFFSET = 56; // px: 50dp banner + 6dp margen visual

  function adjustBottomNav(visible) {
    const nav = document.querySelector('.bottom-nav');
    if (!nav) return;
    nav.style.bottom = visible ? BOTTOM_NAV_BANNER_OFFSET + 'px' : '';
  }

  async function initAds() {
    if (!window.WortiseAds?.isNative) return;

    // Precarga interstitial en Wortise + Unity simultáneamente
    window.AdManager.preloadAll();

    // Banner (solo Wortise)
    try {
      await window.AdManager.showBanner();
      adjustBottomNav(true);
    } catch (e) {
      console.warn('[ads-init] banner falló', e);
      adjustBottomNav(false);
    }
  }

  // Global helper: llámalo en cualquier punto de la app
  window.showInterstitialIfReady = async function () {
    try { await window.AdManager.showInterstitial(); } catch (_) {}
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAds);
  } else {
    initAds();
  }
})();
