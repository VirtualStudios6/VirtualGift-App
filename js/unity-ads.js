'use strict';

(function () {
  const CONFIG = {
    androidGameId: '6127955',
    iosGameId: '6127954',
    testMode: true,
    placements: {
      android: {
        interstitial: 'Interstitial_Android',
        rewarded: 'Rewarded_Android',
        banner: 'Banner_Android',
      },
      ios: {
        interstitial: 'Interstitial_iOS',
        rewarded: 'Rewarded_iOS',
        banner: 'Banner_iOS',
      },
    },
  };

  let initPromise = null;

  function getCapacitor() {
    return window.Capacitor || null;
  }

  function getPlatform() {
    const cap = getCapacitor();
    if (!cap) return 'web';
    if (typeof cap.getPlatform === 'function') return cap.getPlatform();
    return cap.platform || 'web';
  }

  function isNative() {
    const cap = getCapacitor();
    if (!cap) return false;
    if (typeof cap.isNativePlatform === 'function') return cap.isNativePlatform();
    return getPlatform() === 'android' || getPlatform() === 'ios';
  }

  function plugin() {
    return getCapacitor()?.Plugins?.UnityAds || null;
  }

  function placement(kind) {
    const platform = getPlatform() === 'ios' ? 'ios' : 'android';
    return CONFIG.placements[platform][kind];
  }

  function gameId() {
    return getPlatform() === 'ios' ? CONFIG.iosGameId : CONFIG.androidGameId;
  }

  async function ensureReady() {
    if (!isNative()) throw new Error('Unity Ads solo esta disponible en Android/iOS');
    const unityAds = plugin();
    if (!unityAds) throw new Error('Plugin UnityAds no disponible');

    if (!initPromise) {
      initPromise = unityAds.initialize({
        gameId: gameId(),
        testMode: CONFIG.testMode,
      });
    }
    return initPromise;
  }

  async function showRewarded(options = {}) {
    await ensureReady();
    try {
      const res = await plugin().showRewarded({
        placementId: options.placementId || placement('rewarded'),
        serverId: options.serverId || '',
      });
      if (!res?.completed && !res?.rewarded) throw new Error('Anuncio no completado');
      return res;
    } catch (error) {
      throw new Error(userMessage(error));
    }
  }

  async function showInterstitial(options = {}) {
    await ensureReady();
    return plugin().showInterstitial({
      placementId: options.placementId || placement('interstitial'),
    });
  }

  async function showBanner(options = {}) {
    await ensureReady();
    return plugin().showBanner({
      placementId: options.placementId || placement('banner'),
      position: options.position || 'bottom',
    });
  }

  async function hideBanner() {
    if (!isNative() || !plugin()) return;
    return plugin().hideBanner();
  }

  function userMessage(error) {
    const raw = String(error?.message || error || '');
    if (/NETWORK_ERROR|Network error|NO_FILL|NO_FILL_ERROR|No fill/i.test(raw)) {
      return 'Anuncio no disponible ahora. Revisa internet e intenta de nuevo.';
    }
    if (/not initialized|no esta inicializado|init failed/i.test(raw)) {
      initPromise = null;
      return 'Unity Ads aun no esta listo. Intenta de nuevo en unos segundos.';
    }
    if (/not completed|no completado/i.test(raw)) {
      return 'Debes completar el anuncio para recibir la recompensa.';
    }
    return raw || 'No se pudo completar el anuncio.';
  }

  window.VGUnityAds = {
    config: CONFIG,
    ensureReady,
    showRewarded,
    showInterstitial,
    showBanner,
    hideBanner,
    isNative,
    getPlatform,
  };
})();
