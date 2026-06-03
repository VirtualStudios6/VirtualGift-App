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
    return Boolean(window.VGUnityAds?.isNative?.());
  }

  function debugEnabled() {
    return new URLSearchParams(location.search).get('adsdebug') === '1'
      || localStorage.getItem('vg_ads_debug') === '1'
      || window.VGUnityAds?.config?.testMode === true;
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
        debug('Unity Ads no esta listo para banner', diag || { hasVGUnityAds: Boolean(window.VGUnityAds) });
      }
      return false;
    }
    try {
      await window.VGUnityAds.showBanner({ position: 'bottom' });
      document.body.classList.add('unity-banner-active');
      if (debugEnabled()) debug('Unity Ads banner cargado');
      return true;
    } catch (error) {
      const diag = await window.VGUnityAds?.diagnostics?.();
      debug(String(error?.message || error || 'Unity Ads banner unavailable'), diag);
      document.body.classList.remove('unity-banner-active');
      return false;
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    let attempts = 0;
    const tick = async () => {
      attempts += 1;
      const loaded = await showNativeBanner();
      if (!loaded && attempts < 10) setTimeout(tick, 700);
    };
    setTimeout(tick, 700);
  });

  window.addEventListener('pagehide', () => {
    window.VGUnityAds?.hideBanner?.().catch(() => {});
  });
})();
