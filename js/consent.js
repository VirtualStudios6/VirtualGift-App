'use strict';

/* ============================================================
   VirtualGift — Gestión de Consentimiento GDPR/Privacidad

   EN MÓVIL (Capacitor nativo): usa ConsentPlugin.java →
     bottom sheet 100% nativo Android, encima del WebView.

   EN WEB (navegador): muestra banner HTML/CSS desde abajo.

   La decisión se almacena en:
     · SharedPreferences (nativo Android)
     · localStorage vg_consent_v1 (web + sincronización cross-módulo)
   ============================================================ */
(function () {

  const CONSENT_KEY = 'vg_consent_v1';

  // Páginas donde NO se muestra el banner
  const SKIP_PAGES = new Set([
    '', 'index.html', 'landing.html', 'login.html', 'splash.html',
    'welcome.html', 'verify-pending.html', 'action.html',
    'admin.html', 'admin-news.html', 'admin-notificaciones.html',
  ]);

  function pageName() {
    return (location.pathname.split('/').pop() || '').toLowerCase();
  }

  // ── LocalStorage helpers ──────────────────────────────────
  function getStored() {
    try { return JSON.parse(localStorage.getItem(CONSENT_KEY)); }
    catch { return null; }
  }

  function storeLocal(personalized) {
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify({
        personalized: !!personalized, ts: Date.now(),
      }));
    } catch {}
    window.dispatchEvent(new CustomEvent('vg:consent', {
      detail: { personalized: !!personalized },
    }));
  }

  // ── API pública ───────────────────────────────────────────
  window.VGConsent = {
    hasConsent:     () => getStored() !== null,
    isPersonalized: () => (getStored() || {}).personalized === true,
    accept:         () => { storeLocal(true);  hideBanner(); },
    decline:        () => { storeLocal(false); hideBanner(); },
    showBanner,  // para abrir desde Ajustes del perfil
  };

  // ── Flujo nativo (Capacitor Android/iOS) ─────────────────
  async function initNative() {
    const plugin = window.Capacitor?.Plugins?.Consent;
    if (!plugin) { initWeb(); return; }

    try {
      const { exists, personalized } = await plugin.checkConsent();

      if (exists) {
        // Sincronizar SharedPreferences → localStorage
        storeLocal(personalized);
      } else {
        // Mostrar bottom sheet nativo (100% Android, encima del WebView)
        const result = await plugin.showConsentSheet();
        storeLocal(result.personalized);
      }
    } catch {
      // Si el plugin falla por cualquier razón, fallback al banner web
      initWeb();
    }
  }

  // ── Flujo web (navegador) ─────────────────────────────────
  function initWeb() {
    if (!getStored()) setTimeout(showBanner, 800);
  }

  // ── Banner CSS (solo web) ─────────────────────────────────
  function injectStyles() {
    if (document.getElementById('vgc-style')) return;
    const s = document.createElement('style');
    s.id = 'vgc-style';
    s.textContent = `
      #vg-consent {
        position: fixed; bottom: 0; left: 0; right: 0; z-index: 999999;
        padding: 20px 20px calc(20px + env(safe-area-inset-bottom));
        background: rgba(7, 3, 22, 0.97);
        border-top: 1px solid rgba(139,92,246,.35);
        -webkit-backdrop-filter: blur(24px); backdrop-filter: blur(24px);
        box-shadow: 0 -12px 48px rgba(0,0,0,.55);
        transform: translateY(110%);
        transition: transform .38s cubic-bezier(.32,.72,0,1);
        font-family: 'Inter', system-ui, sans-serif;
      }
      #vg-consent.vgc-in { transform: translateY(0); }
      .vgc-inner { max-width: 520px; margin: 0 auto; }
      .vgc-handle {
        width: 40px; height: 4px; border-radius: 4px;
        background: rgba(139,92,246,.5); margin: 0 auto 18px;
      }
      .vgc-title-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
      .vgc-title-icon { font-size: 1.3rem; }
      .vgc-title { font-size: .98rem; font-weight: 800; color: #fff; }
      .vgc-body {
        font-size: .77rem; color: rgba(255,255,255,.52);
        line-height: 1.7; margin-bottom: 16px;
      }
      .vgc-body a { color: #a78bfa; text-decoration: none; font-weight: 600; }
      .vgc-btns { display: flex; gap: 10px; }
      .vgc-btn {
        flex: 1; padding: 12px; border-radius: 14px; border: none;
        font-size: .86rem; font-weight: 800; cursor: pointer;
        font-family: inherit; transition: opacity .18s, transform .15s;
        -webkit-tap-highlight-color: transparent;
      }
      .vgc-btn:active { opacity: .8; transform: scale(.97); }
      .vgc-btn-accept {
        background: linear-gradient(135deg, #7c3aed, #a855f7);
        color: #fff; box-shadow: 0 4px 20px rgba(139,92,246,.35);
      }
      .vgc-btn-decline {
        background: rgba(255,255,255,.07); color: rgba(255,255,255,.65);
        border: 1px solid rgba(255,255,255,.12);
      }
      .vgc-note {
        font-size: .68rem; color: rgba(255,255,255,.2);
        text-align: center; margin-top: 12px;
      }
    `;
    document.head.appendChild(s);
  }

  function showBanner() {
    if (document.getElementById('vg-consent')) return;
    injectStyles();
    const el = document.createElement('div');
    el.id = 'vg-consent';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Consentimiento de privacidad');

    const privUrl  = typeof withAppFlag === 'function'
      ? withAppFlag('legal/Politicas.html') : 'legal/Politicas.html';
    const termUrl  = typeof withAppFlag === 'function'
      ? withAppFlag('legal/terminos.html') : 'legal/terminos.html';

    el.innerHTML = `
      <div class="vgc-inner">
        <div class="vgc-handle"></div>
        <div class="vgc-title-row">
          <span class="vgc-title-icon">🔒</span>
          <span class="vgc-title">Tu privacidad importa</span>
        </div>
        <p class="vgc-body">
          VirtualGift usa tecnologías de seguimiento para personalizar anuncios
          (Unity Ads, IronSource), encuestas y ofertas (CPX Research, Offermaru, Tapjoy, IronSource)
          y análisis de uso (Firebase). Consulta nuestra
          <a href="${privUrl}">Política de Privacidad</a> y
          <a href="${termUrl}">Términos de Uso</a>.
        </p>
        <div class="vgc-btns">
          <button type="button" class="vgc-btn vgc-btn-decline" onclick="VGConsent.decline()">
            Solo esenciales
          </button>
          <button type="button" class="vgc-btn vgc-btn-accept" onclick="VGConsent.accept()">
            Aceptar todo
          </button>
        </div>
        <p class="vgc-note">Puedes cambiar esto en cualquier momento desde tu perfil.</p>
      </div>`;

    document.body.appendChild(el);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => el.classList.add('vgc-in'))
    );
  }

  function hideBanner() {
    const el = document.getElementById('vg-consent');
    if (!el) return;
    el.classList.remove('vgc-in');
    setTimeout(() => el.parentNode?.removeChild(el), 420);
  }

  // ── Init ──────────────────────────────────────────────────
  if (SKIP_PAGES.has(pageName())) return;

  window.addEventListener('DOMContentLoaded', () => {
    if (window.Capacitor?.isNativePlatform?.()) {
      initNative();   // Diálogo 100% nativo Android
    } else {
      initWeb();      // Banner CSS para navegador
    }
  });

})();
