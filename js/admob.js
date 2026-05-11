/* ═══════════════════════════════════════════════
   ADMOB.JS — VirtualGift
   Bridge JS → AdMobPlugin (Capacitor nativo).
   En web/dev todas las llamadas son no-ops seguros.
═══════════════════════════════════════════════ */
(function (w) {
  'use strict';

  const cap    = w.Capacitor;
  const native = cap?.isNativePlatform?.() === true;
  const plugin = native ? cap?.Plugins?.AdMob : null;

  // Para testing en emulador/dispositivo, cambia TEST_MODE a true.
  // Los test IDs de Google siempre devuelven anuncios de prueba.
  // IMPORTANTE: poner TEST_MODE = false antes de publicar en Play Store.
  const TEST_MODE = true; // ← cambiar a false antes de publicar en Play Store

  const AD_UNITS = TEST_MODE ? {
    BANNER:                'ca-app-pub-3940256099942544/6300978111',
    INTERSTITIAL:          'ca-app-pub-3940256099942544/1033173712',
    REWARDED_INTERSTITIAL: 'ca-app-pub-3940256099942544/5354046379',
    APP_OPEN:              'ca-app-pub-3940256099942544/9257395921',
    NATIVE:                'ca-app-pub-3940256099942544/2247696110',
  } : {
    BANNER:                'ca-app-pub-1930529129644930/7702567097',
    INTERSTITIAL:          'ca-app-pub-1930529129644930/5843074952',
    REWARDED_INTERSTITIAL: 'ca-app-pub-1930529129644930/3819546847',
    APP_OPEN:              'ca-app-pub-1930529129644930/3138459959',
    NATIVE:                'ca-app-pub-1930529129644930/3296802664',
  };

  w.AdMob = {
    isNative: native,
    AD_UNITS,

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
      if (!plugin) return Promise.resolve({ showed: false });
      return plugin.showInterstitial();
    },

    // ── Rewarded Interstitial ─────────────────────
    loadRewarded() {
      if (!plugin) return Promise.resolve();
      return plugin.loadRewarded({ unitId: AD_UNITS.REWARDED_INTERSTITIAL });
    },
    showRewarded() {
      if (!plugin) return new Promise(resolve =>
        setTimeout(() => resolve({ rewarded: true }), 1200)
      );
      return plugin.showRewarded({ unitId: AD_UNITS.REWARDED_INTERSTITIAL });
    },

    // ── Events ───────────────────────────────────
    addListener(event, cb) {
      if (!plugin) return { remove() {} };
      return plugin.addListener(event, cb);
    },
  };

})(window);
