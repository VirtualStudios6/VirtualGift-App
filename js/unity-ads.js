/* ═══════════════════════════════════════════════
   UNITY-ADS.JS — VirtualGift
   Bridge JS → UnityAdsPlugin (Capacitor nativo).
   En web/dev todas las llamadas son no-ops.
═══════════════════════════════════════════════ */
(function (w) {
  'use strict';

  const cap    = w.Capacitor;
  const native = cap?.isNativePlatform?.() === true;
  const plugin = native ? cap?.Plugins?.UnityAds : null;

  // Placement IDs — Unity Ads dashboard → Ubicaciones
  const PLACEMENTS = {
    INTERSTITIAL: 'virtual2',
    REWARDED:     'virtual3',
    BANNER:       'virtual1', // referencia; banner Unity no se usa como overlay nativo
  };

  w.UnityAds = {
    isNative: native,
    PLACEMENTS,

    // ── Interstitial ─────────────────────────────
    loadInterstitial() {
      if (!plugin) return Promise.resolve();
      return plugin.loadInterstitial({ placementId: PLACEMENTS.INTERSTITIAL });
    },

    /** Resuelve con { showed: boolean } */
    showInterstitial() {
      if (!plugin) return Promise.resolve({ showed: false });
      return plugin.showInterstitial();
    },

    // ── Rewarded ──────────────────────────────────
    /** Resuelve con { rewarded: boolean, error?: string } */
    showRewarded() {
      if (!plugin) return Promise.resolve({ rewarded: false });
      return plugin.showRewarded({ placementId: PLACEMENTS.REWARDED });
    },

    // ── Events ────────────────────────────────────
    addListener(event, cb) {
      if (!plugin) return { remove() {} };
      return plugin.addListener(event, cb);
    },
  };

})(window);
