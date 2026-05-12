/* ═══════════════════════════════════════════════════════════════════════════
   ADS-INIT.JS — VirtualGift
   Inicializa anuncios en cada página de la app.
   • Banner encima del bottom-nav (AdMob nativo)
   • Interstitial + Rewarded precargados
   • Global window.showInterstitialIfReady() con frequency capping
   • Solo actúa en plataforma nativa (Capacitor)

   ── POLÍTICA DE FRECUENCIA (Google AdMob) ──────────────────────────────────
   Google recomienda un mínimo de 30s entre interstitials y no más de
   2-3 por sesión. Mostramos uno cada MIN_INTERSTITIAL_INTERVAL_MS como
   mínimo para evitar una experiencia agresiva que puede ser reportada
   como "intrusive ads" y derivar en restricciones de la cuenta.
═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // Mínimo tiempo entre interstitials (política interna conservadora)
  const MIN_INTERSTITIAL_INTERVAL_MS = 90 * 1000; // 90 segundos

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

  // ── Frequency capping para interstitials ──────────────────────────────────
  // Previene mostrar interstitials demasiado seguidos, lo que viola las
  // políticas de UX de Google y puede derivar en suspensión de cuenta.
  let _lastInterstitialMs = 0;

  window.showInterstitialIfReady = async function () {
    const now = Date.now();
    if (now - _lastInterstitialMs < MIN_INTERSTITIAL_INTERVAL_MS) {
      console.info('[ads-init] Interstitial bloqueado por frequency cap');
      return;
    }
    _lastInterstitialMs = now;
    try { await window.AdManager.showInterstitial(); } catch (_) {}
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAds);
  } else {
    initAds();
  }
})();
