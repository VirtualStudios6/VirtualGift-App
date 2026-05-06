/* ═══════════════════════════════════════════════
   AD-MANAGER.JS — VirtualGift
   Orquestador de anuncios con fallback automático:
     Wortise (primario) → Unity Ads (respaldo)

   Uso:
     AdManager.showRewarded()      → Promise<{ rewarded, network }>
     AdManager.showInterstitial()  → Promise<void>
     AdManager.showBanner()        → Promise<void>
     AdManager.hideBanner()        → Promise<void>
     AdManager.preloadAll()        → Promise<void>
═══════════════════════════════════════════════ */
(function (w) {
  'use strict';

  function log(msg)  { console.log('[AdManager]',  msg); }
  function warn(msg) { console.warn('[AdManager]', msg); }

  w.AdManager = {

    // ── Rewarded ────────────────────────────────────────────────────────────
    //
    // Lógica de fallback:
    //   1. Intenta Wortise
    //      • rewarded:true              → concede recompensa, fin
    //      • rewarded:false sin error   → usuario cerró el anuncio a propósito,
    //                                     NO intentar Unity (fue una decisión del user)
    //      • rewarded:false CON error   → sin fill / fallo de red → fallback Unity
    //   2. Intenta Unity Ads
    //      • rewarded:true              → concede recompensa
    //      • cualquier otro caso        → no recompensa
    //   3. Si los dos fallan            → { rewarded:false, network:'none' }

    async showRewarded() {
      // ── 1. Wortise ──────────────────────────────────────────────────────
      try {
        log('Rewarded: probando Wortise…');
        const r = await w.WortiseAds.showRewarded(w.WortiseAds.AD_UNITS.REWARDED);

        if (r.rewarded) {
          log('Rewarded: Wortise otorgó recompensa ✓');
          return { rewarded: true, network: 'wortise' };
        }

        if (!r.error) {
          // El usuario cerró el anuncio deliberadamente → no hacer fallback
          log('Rewarded: Wortise omitido por el usuario');
          return { rewarded: false, network: 'wortise', skipped: true };
        }

        // Sin fill o error de red → intentar Unity
        warn('Rewarded: Wortise sin fill (' + r.error + ') → fallback Unity');
      } catch (e) {
        warn('Rewarded: Wortise excepción (' + (e?.message || e) + ') → fallback Unity');
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

      // ── 3. Ambas redes fallaron ─────────────────────────────────────────
      warn('Rewarded: ninguna red disponible');
      return { rewarded: false, network: 'none' };
    },

    // ── Interstitial ─────────────────────────────────────────────────────────
    //
    // Fire-and-forget: nunca bloquea la UX aunque ambas redes fallen.
    // Devuelve Promise<void>.

    async showInterstitial() {
      if (!w.WortiseAds?.isNative) return;

      // ── 1. Wortise ──────────────────────────────────────────────────────
      try {
        log('Interstitial: probando Wortise…');
        const r = await w.WortiseAds.showInterstitial();
        if (r?.showed) {
          log('Interstitial: Wortise mostró el anuncio ✓');
          return;
        }
        log('Interstitial: Wortise sin fill → fallback Unity');
      } catch (e) {
        warn('Interstitial: Wortise excepción (' + (e?.message || e) + ') → fallback Unity');
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
    // Solo Wortise (Unity Ads SDK 4.x no provee banner overlay estándar).

    async showBanner() {
      try {
        await w.WortiseAds.showBanner();
        log('Banner: Wortise cargado ✓');
      } catch (e) {
        warn('Banner: falló (' + (e?.message || e) + ')');
      }
    },

    hideBanner() {
      return w.WortiseAds.hideBanner?.() ?? Promise.resolve();
    },

    // ── Precarga ──────────────────────────────────────────────────────────────
    // Llama a esto una vez al iniciar la app para tener ambas redes listas.

    async preloadAll() {
      if (!w.WortiseAds?.isNative) return;
      log('Precargando todas las redes…');

      await Promise.allSettled([
        w.WortiseAds.loadInterstitial().catch(e => warn('Wortise preload: ' + e?.message)),
        w.UnityAds.loadInterstitial().catch(e  => warn('Unity preload: '   + e?.message)),
      ]);

      log('Precarga completa');
    },
  };

})(window);
