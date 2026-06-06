'use strict';

(function () {
  const CONFIG = {
    appKey: '26a0d0ced',
    placements: {
      rewarded:     'DefaultRewardedVideo',
      interstitial: 'DefaultInterstitial',
      banner:       'DefaultBanner',
    },
  };

  let initPromise = null;

  function getCapacitor() { return window.Capacitor || null; }

  function isNative() {
    const cap = getCapacitor();
    if (!cap) return false;
    if (typeof cap.isNativePlatform === 'function') return cap.isNativePlatform();
    const p = cap.getPlatform?.() || cap.platform || 'web';
    return p === 'android' || p === 'ios';
  }

  function plugin() {
    return getCapacitor()?.Plugins?.IronSource || null;
  }

  async function ensureReady() {
    if (!isNative()) throw new Error('IronSource solo disponible en Android/iOS');
    const p = plugin();
    if (!p) throw new Error('Plugin IronSource no disponible');

    if (!initPromise) {
      const gdprConsent = window.VGConsent ? window.VGConsent.isPersonalized() : false;
      initPromise = p.initialize({ gdprConsent }).catch(err => {
        initPromise = null;
        throw err;
      });
    }
    return initPromise;
  }

  window.addEventListener('vg:consent', () => { initPromise = null; });

  async function showRewarded(options = {}) {
    await ensureReady();
    try {
      const res = await plugin().showRewarded({
        placementId: options.placementId || CONFIG.placements.rewarded,
      });
      if (!res?.rewarded) throw new Error('Anuncio no completado');
      return res;
    } catch (error) {
      throw new Error(userMessage(error));
    }
  }

  async function showInterstitial(options = {}) {
    await ensureReady();
    try {
      return await plugin().showInterstitial({
        placementId: options.placementId || CONFIG.placements.interstitial,
      });
    } catch (error) {
      throw new Error(userMessage(error));
    }
  }

  async function showBanner(options = {}) {
    await ensureReady();
    return plugin().showBanner({ position: options.position || 'bottom' });
  }

  async function hideBanner() {
    if (!isNative() || !plugin()) return;
    return plugin().hideBanner();
  }

  async function showOfferwall() {
    await ensureReady();
    try {
      return await plugin().showOfferwall();
    } catch (error) {
      throw new Error(userMessage(error));
    }
  }

  async function isRewardedAvailable() {
    if (!isNative() || !plugin()) return false;
    try {
      const status = await plugin().getStatus();
      return status?.rewardedAvailable === true;
    } catch { return false; }
  }

  async function diagnostics() {
    const p = plugin();
    const base = {
      isNative:  isNative(),
      hasPlugin: Boolean(p),
      appKey:    CONFIG.appKey,
    };
    if (!p?.getStatus) return base;
    try { return { ...base, native: await p.getStatus() }; }
    catch (e) { return { ...base, nativeStatusError: String(e?.message || e) }; }
  }

  function userMessage(error) {
    const raw = String(error?.message || error || '');
    if (/no disponible|not available|NO_FILL/i.test(raw))
      return 'Anuncio no disponible ahora. Intenta de nuevo en unos momentos.';
    if (/no inicializado|not initialized/i.test(raw))
      return 'IronSource aún no está listo. Intenta de nuevo en unos segundos.';
    if (/cerrado sin completar|closed without/i.test(raw))
      return 'Debes completar el anuncio para recibir la recompensa.';
    return raw || 'No se pudo completar el anuncio.';
  }

  window.addEventListener('DOMContentLoaded', () => {
    if (!isNative()) return;
    setTimeout(() => {
      ensureReady().catch(() => {});
    }, 1500);
  });

  window.VGIronSource = {
    config: CONFIG,
    ensureReady,
    showRewarded,
    showInterstitial,
    showBanner,
    hideBanner,
    showOfferwall,
    isRewardedAvailable,
    diagnostics,
    isNative,
  };
})();
