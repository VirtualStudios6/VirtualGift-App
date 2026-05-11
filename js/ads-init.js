/* ═══════════════════════════════════════════════
   ADS-INIT.JS — VirtualGift
   Inicializa anuncios en cada página de la app.
   • Banner inferior permanente (AdMob)
   • Interstitial + Rewarded precargados
   • Global window.showInterstitialIfReady()
   • Solo actúa en plataforma nativa (Capacitor)
═══════════════════════════════════════════════ */
(function () {
  'use strict';

  const BOTTOM_NAV_HEIGHT = 62; // px (altura visible del bottom-nav, sin safe-area)
  const BANNER_FALLBACK_DP = 50; // dp — usado si el plugin no devuelve offsetDp

  // Mueve el bottom-nav hacia arriba para que quede encima del banner.
  // bannerOffsetDp: valor devuelto por AdMobPlugin (banner + barra sistema en dp).
  function adjustLayout(bannerOffsetDp) {
    const nav = document.querySelector('.bottom-nav');
    if (nav) {
      nav.style.bottom = bannerOffsetDp + 'px';
    }
    // Padding al body para que el contenido nunca quede oculto detrás del nav+banner
    document.body.style.paddingBottom =
      (bannerOffsetDp + BOTTOM_NAV_HEIGHT + 8) + 'px';
  }

  function resetLayout() {
    const nav = document.querySelector('.bottom-nav');
    if (nav) nav.style.bottom = '';
    document.body.style.paddingBottom = '';
  }

  async function initAds() {
    if (!window.AdMob?.isNative) return;

    // Precarga interstitial + rewarded en paralelo
    window.AdManager.preloadAll();

    // Banner
    try {
      const result = await window.AdManager.showBanner();
      const offsetDp = result?.offsetDp ?? BANNER_FALLBACK_DP;
      adjustLayout(offsetDp);
    } catch (e) {
      console.warn('[ads-init] banner falló', e);
      resetLayout();
    }
  }

  // Helper global para mostrar interstitial desde cualquier página
  window.showInterstitialIfReady = async function () {
    try { await window.AdManager.showInterstitial(); } catch (_) {}
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAds);
  } else {
    initAds();
  }
})();
