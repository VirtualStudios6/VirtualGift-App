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

  async function showNativeBanner() {
    if (!shouldShowBanner()) return;
    try {
      await window.VGUnityAds.showBanner({ position: 'bottom' });
      document.body.classList.add('unity-banner-active');
    } catch (error) {
      console.warn('[UnityAds] banner unavailable', error);
      document.body.classList.remove('unity-banner-active');
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(showNativeBanner, 900);
  });

  window.addEventListener('pagehide', () => {
    window.VGUnityAds?.hideBanner?.().catch(() => {});
  });
})();
