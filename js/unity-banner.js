'use strict';

(function () {
  const HIDDEN_PAGES = new Set([
    '',
    'index.html',
    'landing.html',
    'login.html',
    'splash.html',
    'welcome.html',
    'verify-pending.html',
    'action.html',
  ]);

  function pageName() {
    return (location.pathname.split('/').pop() || '').toLowerCase();
  }

  function shouldShowBanner() {
    if (HIDDEN_PAGES.has(pageName())) return false;
    return Boolean(window.VGUnityAds?.isNative?.() || window.VGIronSource?.isNative?.());
  }

  function debugEnabled() {
    return new URLSearchParams(location.search).get('adsdebug') === '1'
      || localStorage.getItem('vg_ads_debug') === '1';
  }

  function debug(message, data) {
    console.warn('[UnityAds]', message, data || '');
    if (!debugEnabled()) return;
    let el = document.getElementById('unityAdsDebug');
    if (!el) {
      el = document.createElement('div');
      el.id = 'unityAdsDebug';
      el.style.cssText = 'position:fixed;left:8px;right:8px;bottom:112px;z-index:99999;padding:10px 12px;border-radius:8px;background:rgba(10,3,25,.94);border:1px solid rgba(192,132,252,.45);color:#fff;font:12px/1.35 monospace;white-space:pre-wrap;box-shadow:0 10px 30px rgba(0,0,0,.4)';
      document.body.appendChild(el);
    }
    const text = typeof data === 'undefined' ? message : `${message}\n${JSON.stringify(data, null, 2)}`;
    el.textContent = text.slice(0, 1400);
  }

  async function showNativeBanner() {
    if (!shouldShowBanner()) {
      if (debugEnabled()) {
        const diag = await window.VGUnityAds?.diagnostics?.();
        debug('No hay red de anuncios lista para banner', diag || {});
      }
      return false;
    }

    // ── Intento 1: Unity Ads ───────────────────────────────────────────────
    if (window.VGUnityAds?.isNative?.()) {
      try {
        await window.VGUnityAds.showBanner({ position: 'bottom' });
        document.body.classList.add('unity-banner-active');
        if (debugEnabled()) debug('Banner: Unity Ads OK');
        return true;
      } catch (unityErr) {
        debug('Unity banner falló, probando IronSource...', String(unityErr?.message || unityErr));
      }
    }

    // ── Intento 2: IronSource (fallback) ───────────────────────────────────
    if (window.VGIronSource?.isNative?.()) {
      try {
        await window.VGIronSource.ensureReady();
        await window.VGIronSource.showBanner({ position: 'bottom' });
        document.body.classList.add('unity-banner-active');
        if (debugEnabled()) debug('Banner: IronSource OK (fallback)');
        return true;
      } catch (isErr) {
        debug('IronSource banner también falló', String(isErr?.message || isErr));
      }
    }

    document.body.classList.remove('unity-banner-active');
    return false;
  }

  window.addEventListener('DOMContentLoaded', () => {
    let attempts = 0;
    const tick = async () => {
      attempts += 1;
      const loaded = await showNativeBanner();
      if (!loaded) {
        if (attempts < 10) {
          // Reintentos rápidos los primeros 7 segundos
          setTimeout(tick, 700);
        } else {
          // Si no hay fill, reintentar cada 2 minutos de fondo
          setTimeout(tick, 2 * 60 * 1000);
          attempts = 0;
        }
      }
    };
    setTimeout(tick, 700);
  });

  window.addEventListener('pagehide', () => {
    window.VGUnityAds?.hideBanner?.().catch(() => {});
    window.VGIronSource?.hideBanner?.().catch(() => {});
  });
})();

// ── Intersticial entre pantallas ──────────────────────────────────────────────
// Cooldown: 8 minutos entre intersticiales.
// Delay inicial: 8 segundos (para no golpear al usuario al abrir la app).
(function () {
  const COOLDOWN_KEY  = 'vg_last_interstitial';
  const COOLDOWN_MS   = 8 * 60 * 1000;  // 8 minutos
  const STARTUP_DELAY = 8000;           // 8 segundos al abrir cada página

  const SKIP_PAGES = new Set([
    '', 'index.html', 'landing.html', 'login.html', 'splash.html',
    'welcome.html', 'verify-pending.html', 'action.html',
    'admin.html', 'admin-news.html', 'admin-notificaciones.html',
  ]);

  function pageName() {
    return (location.pathname.split('/').pop() || '').toLowerCase();
  }

  function cooldownExpired() {
    const last = Number(localStorage.getItem(COOLDOWN_KEY) || 0);
    return Date.now() - last >= COOLDOWN_MS;
  }

  async function maybeShowInterstitial() {
    if (SKIP_PAGES.has(pageName())) return;
    if (!window.VGUnityAds?.isNative?.() && !window.VGIronSource?.isNative?.()) return;
    if (!cooldownExpired()) return;

    // Marcar cooldown al inicio para que ninguna red dispare dos veces
    localStorage.setItem(COOLDOWN_KEY, String(Date.now()));

    // ── Intento 1: Unity Ads ─────────────────────────────────────────────
    if (window.VGUnityAds?.isNative?.()) {
      try {
        await window.VGUnityAds.showInterstitial();
        return;
      } catch (_) {
        // Unity falló, probar IronSource
      }
    }

    // ── Intento 2: IronSource (fallback) ────────────────────────────────
    if (window.VGIronSource?.isNative?.()) {
      try {
        await window.VGIronSource.showInterstitial();
      } catch (_) {
        // Silencioso
      }
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(maybeShowInterstitial, STARTUP_DELAY);
  });
})();
