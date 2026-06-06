'use strict';

(function () {
  const CONFIG = {
    androidGameId: '6127955',
    iosGameId: '6127954',
    testMode: false,
    placements: {
      android: {
        interstitial: 'Interstitial_Android',
        rewarded:     'Rewarded_Android',
        banner:       'Banner_Android',
      },
      ios: {
        interstitial: 'Interstitial_iOS',
        rewarded:     'Rewarded_iOS',
        banner:       'Banner_iOS',
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
      // Leer consentimiento GDPR — si no hay decisión aún, usar false (no personalizado)
      const gdprConsent = window.VGConsent ? window.VGConsent.isPersonalized() : false;

      initPromise = unityAds.initialize({
        gameId:      gameId(),
        testMode:    CONFIG.testMode,
        gdprConsent: gdprConsent,
      }).catch(err => {
        // Reset para que el próximo intento vuelva a intentar inicializar
        initPromise = null;
        throw err;
      });
    }
    return initPromise;
  }

  // Si el usuario cambia su consentimiento mientras la app está abierta,
  // reinicializar Unity Ads con la nueva preferencia
  window.addEventListener('vg:consent', () => {
    initPromise = null; // forzar re-init en el próximo uso
  });

  async function showRewarded(options = {}) {
    await ensureReady();
    try {
      const res = await plugin().showRewarded({
        placementId: options.placementId || placement('rewarded'),
        serverId:    options.serverId || '',
      });
      if (!res?.completed && !res?.rewarded) throw new Error('Anuncio no completado');
      return res;
    } catch (error) {
      throw new Error(userMessage(error));
    }
  }

  async function showInterstitial(options = {}) {
    await ensureReady();
    try {
      return await plugin().showInterstitial({
        placementId: options.placementId || placement('interstitial'),
      });
    } catch (error) {
      throw new Error(userMessage(error));
    }
  }

  async function showBanner(options = {}) {
    await ensureReady();
    return plugin().showBanner({
      placementId: options.placementId || placement('banner'),
      position:    options.position || 'bottom',
    });
  }

  async function hideBanner() {
    if (!isNative() || !plugin()) return;
    return plugin().hideBanner();
  }

  async function diagnostics() {
    const unityAds = plugin();
    const base = {
      platform:     getPlatform(),
      isNative:     isNative(),
      hasCapacitor: Boolean(getCapacitor()),
      hasPlugin:    Boolean(unityAds),
      gameId:       gameId(),
      testMode:     CONFIG.testMode,
      placements:   CONFIG.placements[getPlatform() === 'ios' ? 'ios' : 'android'],
    };
    if (!unityAds?.getStatus) return base;
    try {
      return { ...base, native: await unityAds.getStatus() };
    } catch (error) {
      return { ...base, nativeStatusError: String(error?.message || error) };
    }
  }

  function userMessage(error) {
    const raw = String(error?.message || error || '');

    if (/NETWORK_ERROR|Network error|NO_FILL|NO_FILL_ERROR|No fill/i.test(raw)) {
      return 'Anuncio no disponible ahora. Revisa tu internet e intenta de nuevo.';
    }
    if (/TIMEOUT|timed out|REQUIRE_TIMED|TIME_?OUT/i.test(raw)) {
      initPromise = null;
      return 'Tiempo de conexion agotado. Verifica tu internet e intenta de nuevo.';
    }
    if (/not initialized|no esta inicializado|init failed|INVALID_ARGUMENT|INTERNAL_ERROR/i.test(raw)) {
      initPromise = null;
      return 'Unity Ads aun no esta listo. Intenta de nuevo en unos segundos.';
    }
    if (/not completed|no completado/i.test(raw)) {
      return 'Debes completar el anuncio para recibir la recompensa.';
    }
    if (/show failed|load failed/i.test(raw)) {
      return 'No se pudo mostrar el anuncio. Intenta de nuevo.';
    }
    return raw || 'No se pudo completar el anuncio.';
  }

  // Pre-inicializar en segundo plano al cargar la página
  // (así el ad ya estará listo cuando el usuario lo solicite)
  window.addEventListener('DOMContentLoaded', () => {
    if (!isNative()) return;
    setTimeout(() => {
      ensureReady().catch(() => {
        // Silencioso — se reintentará cuando el usuario solicite un anuncio
      });
    }, 1000);
  });

  window.VGUnityAds = {
    config: CONFIG,
    ensureReady,
    showRewarded,
    showInterstitial,
    showBanner,
    hideBanner,
    diagnostics,
    isNative,
    getPlatform,
  };
})();
