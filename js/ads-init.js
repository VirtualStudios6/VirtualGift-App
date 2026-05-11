/* ═══════════════════════════════════════════════
   ADS-INIT.JS — VirtualGift
   Inicializa anuncios en cada página de la app.
   • Banner encima del bottom-nav (AdMob nativo)
   • Interstitial + Rewarded precargados
   • Global window.showInterstitialIfReady()
   • Solo actúa en plataforma nativa (Capacitor)
═══════════════════════════════════════════════ */
(function () {
  'use strict';

  // Fallback si el plugin no devuelve offsetDp: banner(50) + nav(62) = 112dp
  const BANNER_FALLBACK_DP = 112;

  // El banner nativo ya se posiciona encima del bottom-nav en Java.
  // Aquí solo añadimos paddingBottom al body para que el contenido
  // no quede oculto detrás del nav + banner.
  function adjustLayout(totalOffsetDp) {
    document.body.style.paddingBottom = (totalOffsetDp + 8) + 'px';
  }

  function resetLayout() {
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
