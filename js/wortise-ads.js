/* ═══════════════════════════════════════════════
   WORTISE-ADS.JS — VirtualGift
   Bridge between JS and the native WortiseAdsPlugin.
   Falls back to no-ops on web (dev/testing).
═══════════════════════════════════════════════ */
(function (w) {
  'use strict';

  const cap    = w.Capacitor;
  const native = cap?.isNativePlatform?.() === true;
  const plugin = native ? cap?.Plugins?.WortiseAds : null;

  const AD_UNITS = {
    BANNER:       '757ec584-1a92-495e-b834-d592ae7f24b7',
    INTERSTITIAL: '3a9cd333-06e1-4b36-8b30-fc8241def4d5',
    REWARDED:     '7d073f1e-bb56-4a59-90d0-ea9dd0285f13',
  };

  w.WortiseAds = {
    isNative: native,
    AD_UNITS,

    // ── Rewarded ────────────────────────────────
    showRewarded(unitId) {
      if (!plugin) return new Promise(resolve => setTimeout(() => resolve({ rewarded: true }), 1200));
      return plugin.showRewarded({ unitId });
    },

    // ── Banner ───────────────────────────────────
    showBanner() {
      if (!plugin) return Promise.resolve();
      return plugin.showBanner({ unitId: AD_UNITS.BANNER });
    },

    hideBanner() {
      if (!plugin) return Promise.resolve();
      return plugin.hideBanner();
    },

    // ── Interstitial ─────────────────────────────
    loadInterstitial() {
      if (!plugin) return Promise.resolve();
      return plugin.loadInterstitial({ unitId: AD_UNITS.INTERSTITIAL });
    },

    showInterstitial() {
      if (!plugin) return Promise.resolve();
      return plugin.showInterstitial();
    },

    // ── Events ───────────────────────────────────
    addListener(event, cb) {
      if (!plugin) return { remove() {} };
      return plugin.addListener(event, cb);
    },
  };

})(window);
