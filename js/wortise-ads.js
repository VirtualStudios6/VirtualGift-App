/* ═══════════════════════════════════════════════
   WORTISE-ADS.JS — VirtualGift
   Bridge between JS and the native WortiseAdsPlugin.
   Falls back to instant-reward on web (dev/testing).
═══════════════════════════════════════════════ */
(function (w) {
  'use strict';

  const cap    = w.Capacitor;
  const native = cap?.isNativePlatform?.() === true;
  const plugin = native ? cap?.Plugins?.WortiseAds : null;

  w.WortiseAds = {
    isNative: native,

    /**
     * Show a rewarded ad.
     * Returns Promise<{ rewarded: boolean }>.
     * On web (dev), resolves immediately with rewarded:true.
     */
    showRewarded(unitId) {
      if (!plugin) {
        // Web / dev fallback — simulate a short delay then grant reward
        return new Promise(resolve =>
          setTimeout(() => resolve({ rewarded: true }), 1200)
        );
      }
      return plugin.showRewarded({ unitId });
    },

    addListener(event, cb) {
      if (!plugin) return { remove() {} };
      return plugin.addListener(event, cb);
    },
  };

})(window);
