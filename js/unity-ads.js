'use strict';

(function () {
  const CONFIG = {
    androidGameId: '6127955',
    iosGameId: '6127954',
    testMode: false,
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
    const res = await plugin().showRewarded({
      placementId: options.placementId || placement('rewarded'),
      serverId: options.serverId || '',
    });
    if (!res?.completed && !res?.rewarded) throw new Error('Anuncio no completado');
    return res;
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
