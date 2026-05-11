/* ═══════════════════════════════════════════════
   AD-MANAGER.JS — VirtualGift
   Orquestador de anuncios:
     AdMob (primario) → Unity Ads (respaldo)

   AdManager.showRewarded()     → Promise<{ rewarded, network }>
   AdManager.showInterstitial() → Promise<void>
   AdManager.showBanner()       → Promise<void>
   AdManager.hideBanner()       → Promise<void>
   AdManager.preloadAll()       → Promise<void>
═══════════════════════════════════════════════ */
(function (w) {
  'use strict';

  function log(msg)  { console.log('[AdManager]', msg); }
  function warn(msg) { console.warn('[AdManager]', msg); }

  w.AdManager = {

    // ── Rewarded ────────────────────────────────────────────────────────────
    //
    // Lógica de fallback:
    //   1. AdMob rewarded:true              → recompensa, fin
    //      rewarded:false sin error         → usuario cerró, NO hacer fallback
    //      rewarded:false CON error         → sin fill → fallback Unity
    //   2. Unity Ads como respaldo
    //   3. Ambas fallan                     → { rewarded:false, network:'none' }

    async showRewarded() {
      // ── 1. AdMob ────────────────────────────────────────────────────────
      try {
        log('Rewarded: probando AdMob…');
        const r = await w.AdMob.showRewarded();

        if (r.rewarded) {
          log('Rewarded: AdMob otorgó recompensa ✓');
          return { rewarded: true, network: 'admob' };
        }

        if (!r.error) {
          log('Rewarded: AdMob omitido por el usuario');
          return { rewarded: false, network: 'admob', skipped: true };
        }

        warn('Rewarded: AdMob sin fill (' + r.error + ') → fallback Unity');
      } catch (e) {
        warn('Rewarded: AdMob excepción (' + (e?.message || e) + ') → fallback Unity');
      }

      // ── 2. Unity Ads (fallback) ─────────────────────────────────────────
      try {
        log('Rewarded: probando Unity Ads…');
        const r = await w.UnityAds.showRewarded();

        if (r.rewarded) {
          log('Rewarded: Unity Ads otorgó recompensa ✓');
          return { rewarded: true, network: 'unity' };
        }

        log('Rewarded: Unity Ads omitido por el usuario');
        return { rewarded: false, network: 'unity', skipped: true };
      } catch (e) {
        warn('Rewarded: Unity Ads excepción (' + (e?.message || e) + ')');
      }

      warn('Rewarded: ninguna red disponible');
      return { rewarded: false, network: 'none' };
    },

    // ── Interstitial ─────────────────────────────────────────────────────────
    //
    // Fire-and-forget: nunca bloquea la UX aunque ambas redes fallen.

    async showInterstitial() {
      if (!w.AdMob?.isNative) return;

      // ── 1. AdMob ────────────────────────────────────────────────────────
      try {
        log('Interstitial: probando AdMob…');
        const r = await w.AdMob.showInterstitial();
        if (r?.showed) {
          log('Interstitial: AdMob mostró el anuncio ✓');
          return;
        }
        log('Interstitial: AdMob sin fill → fallback Unity');
      } catch (e) {
        warn('Interstitial: AdMob excepción (' + (e?.message || e) + ') → fallback Unity');
      }

      // ── 2. Unity Ads (fallback) ─────────────────────────────────────────
      try {
        log('Interstitial: probando Unity Ads…');
        const r = await w.UnityAds.showInterstitial();
        if (r?.showed) {
          log('Interstitial: Unity Ads mostró el anuncio ✓');
        } else {
          log('Interstitial: Unity Ads sin fill');
        }
      } catch (e) {
        warn('Interstitial: Unity Ads excepción (' + (e?.message || e) + ')');
      }
    },

    // ── Banner ────────────────────────────────────────────────────────────────
    // Solo AdMob (Unity Ads SDK 4.x no provee banner overlay estándar).

    async showBanner() {
      try {
        const result = await w.AdMob.showBanner();
        log('Banner: AdMob cargado ✓');
        return result; // { offsetDp } para que ads-init ajuste el nav
      } catch (e) {
        warn('Banner: falló (' + (e?.message || e) + ')');
        throw e;
      }
    },

    hideBanner() {
      return w.AdMob.hideBanner?.() ?? Promise.resolve();
    },

    // ── Precarga ──────────────────────────────────────────────────────────────
    // Llama una vez al iniciar la app para tener las redes listas.

    async preloadAll() {
      if (!w.AdMob?.isNative) return;
      log('Precargando todas las redes…');

      await Promise.allSettled([
        w.AdMob.loadInterstitial().catch(e   => warn('AdMob interstitial preload: '  + e?.message)),
        w.AdMob.loadRewarded().catch(e        => warn('AdMob rewarded preload: '       + e?.message)),
        w.UnityAds.loadInterstitial().catch(e => warn('Unity interstitial preload: '  + e?.message)),
      ]);

      log('Precarga completa');
    },
  };

})(window);
