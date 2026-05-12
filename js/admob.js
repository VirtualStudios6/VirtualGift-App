/* ═══════════════════════════════════════════════════════════════════════════
   ADMOB.JS — VirtualGift
   Bridge JS → AdMobPlugin (Capacitor nativo).
   En web/dev todas las llamadas son no-ops seguros.

   ── SEPARACIÓN DE ENTORNOS ──────────────────────────────────────────────────
   TEST_MODE se activa AUTOMÁTICAMENTE en cualquier entorno que no sea
   producción (dominio virtualgift.pro ó build nativo sin FORCE_PROD_NATIVE).

   Para publicar en Play Store:
     1. Cambia FORCE_PROD_NATIVE = true  ← única línea que debes tocar
     2. Ejecuta: cap sync android && Rebuild en Android Studio
     3. Firma el APK/AAB con la keystore de producción
     4. Verifica con logcat que los IDs reales aparecen en los logs
     5. Ver RELEASE_CHECKLIST.md para la lista completa

   NUNCA hardcodees TEST_MODE = false directamente.
   NUNCA subas al Play Store con FORCE_PROD_NATIVE = false.
═══════════════════════════════════════════════════════════════════════════ */
(function (w) {
  'use strict';

  const cap    = w.Capacitor;
  const native = cap?.isNativePlatform?.() === true;
  const plugin = native ? cap?.Plugins?.AdMob : null;

  // ── Separación Dev / Prod ────────────────────────────────────────────────
  //
  // FORCE_PROD_NATIVE: activa IDs reales en la app nativa.
  //   false → TEST_MODE activo (desarrollo, testing, emulador)
  //   true  → IDs reales activos (solo en release build para Play Store)
  //
  // Para web: TEST_MODE se desactiva automáticamente en virtualgift.pro.
  const FORCE_PROD_NATIVE = false; // ← cambiar a true SOLO en release build

  const _PROD_DOMAIN  = 'virtualgift.pro';
  const _isWebProd    = typeof location !== 'undefined' &&
                        location.hostname === _PROD_DOMAIN;
  const TEST_MODE     = !(_isWebProd || FORCE_PROD_NATIVE);

  // Aviso en consola para no confundirse durante el desarrollo
  if (TEST_MODE) {
    console.info(
      '[AdMob] TEST_MODE activo — usando IDs de prueba de Google. ' +
      'Para producción nativa pon FORCE_PROD_NATIVE = true en admob.js'
    );
  }

  // ── Unidades de anuncio ──────────────────────────────────────────────────
  //
  // IDs de PRUEBA de Google — siempre devuelven anuncios de test.
  // Fuente oficial: https://developers.google.com/admob/android/test-ads
  //
  // IDs de PRODUCCIÓN — solo sirven en la app publicada.
  // Usar IDs reales en desarrollo = RIESGO de suspensión de cuenta.
  const AD_UNITS = TEST_MODE ? {
    BANNER:                'ca-app-pub-3940256099942544/6300978111',
    MREC:                  'ca-app-pub-3940256099942544/6300978111',
    INTERSTITIAL:          'ca-app-pub-3940256099942544/1033173712',
    REWARDED_INTERSTITIAL: 'ca-app-pub-3940256099942544/5354046379',
    APP_OPEN:              'ca-app-pub-3940256099942544/9257395921',
    NATIVE:                'ca-app-pub-3940256099942544/2247696110',
  } : {
    BANNER:                'ca-app-pub-1930529129644930/7702567097',
    MREC:                  'ca-app-pub-1930529129644930/7702567097',
    INTERSTITIAL:          'ca-app-pub-1930529129644930/5843074952',
    REWARDED_INTERSTITIAL: 'ca-app-pub-1930529129644930/3819546847',
    APP_OPEN:              'ca-app-pub-1930529129644930/3138459959',
    NATIVE:                'ca-app-pub-1930529129644930/3296802664',
  };

  w.AdMob = {
    isNative: native,
    AD_UNITS,
    TEST_MODE, // expuesto para que otras partes del código puedan consultarlo

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
    // En desarrollo (web) no se simula recompensa automática para evitar
    // exploits en la economía de la app — se resuelve como no-recompensado.
    showRewarded() {
      if (!plugin) return Promise.resolve({ rewarded: false, skipped: true });
      return plugin.showRewarded({ unitId: AD_UNITS.REWARDED_INTERSTITIAL });
    },

    // ── MREC inline 300×250 ──────────────────────
    showMrecAt(params) {
      if (!plugin) return Promise.resolve();
      return plugin.showMrecAt({ unitId: AD_UNITS.MREC, ...params });
    },
    hideMrec() {
      if (!plugin) return Promise.resolve();
      return plugin.hideMrec();
    },

    // ── Events ───────────────────────────────────
    addListener(event, cb) {
      if (!plugin) return { remove() {} };
      return plugin.addListener(event, cb);
    },
  };

})(window);
