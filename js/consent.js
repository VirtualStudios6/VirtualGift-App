'use strict';

/* ============================================================
   VirtualGift — Gestión de Consentimiento (GDPR / Privacidad)
   Aparece una sola vez en la primera visita del usuario.
   Decisión guardada en localStorage (clave: vg_consent_v1).
   ============================================================ */
(function () {

  const CONSENT_KEY = 'vg_consent_v1';

  // Páginas donde NO se muestra el banner (autenticación / splash)
  const SKIP_PAGES = new Set([
    '', 'index.html', 'landing.html', 'login.html', 'splash.html',
    'welcome.html', 'verify-pending.html', 'action.html',
    'admin.html', 'admin-news.html', 'admin-notificaciones.html',
  ]);

  function pageName() {
    return (location.pathname.split('/').pop() || '').toLowerCase();
  }

  // ── Leer / guardar consentimiento ─────────────────────────
  function getStored() {
    try { return JSON.parse(localStorage.getItem(CONSENT_KEY)); }
    catch { return null; }
  }

  function storeDecision(personalized) {
    const data = { personalized: !!personalized, ts: Date.now() };
    try { localStorage.setItem(CONSENT_KEY, JSON.stringify(data)); } catch {}
    // Notificar a otros módulos (ej. unity-ads.js)
    window.dispatchEvent(new CustomEvent('vg:consent', { detail: data }));
    hideBanner();
  }

  // ── API pública ───────────────────────────────────────────
  window.VGConsent = {
    /** Devuelve true si el usuario ya respondió */
    hasConsent:      () => getStored() !== null,
    /** Devuelve true si aceptó anuncios personalizados */
    isPersonalized:  () => (getStored() || {}).personalized === true,
    /** El usuario acepta todo (anuncios personalizados) */
    accept:          () => storeDecision(true),
    /** El usuario acepta solo lo esencial (sin personalización) */
    decline:         () => storeDecision(false),
    /** Para mostrar el banner manualmente (ej. desde ajustes) */
    showBanner:      showBanner,
  };

  // ── CSS del banner ────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('vgc-style')) return;
    const s = document.createElement('style');
    s.id = 'vgc-style';
    s.textContent = `
      #vg-consent {
        position: fixed;
        bottom: 0; left: 0; right: 0;
        z-index: 999999;
        padding: 20px 20px calc(20px + env(safe-area-inset-bottom));
        background: rgba(7, 3, 22, 0.97);
        border-top: 1px solid rgba(139, 92, 246, 0.35);
        -webkit-backdrop-filter: blur(24px);
        backdrop-filter: blur(24px);
        box-shadow: 0 -12px 48px rgba(0,0,0,0.55);
        transform: translateY(110%);
        transition: transform 0.38s cubic-bezier(0.32, 0.72, 0, 1);
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
      }
      #vg-consent.vgc-visible {
        transform: translateY(0);
      }
      .vgc-wrap {
        max-width: 520px;
        margin: 0 auto;
      }
      .vgc-top {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
      }
      .vgc-icon {
        font-size: 1.5rem;
        line-height: 1;
      }
      .vgc-title {
        font-size: 1rem;
        font-weight: 800;
        color: #fff;
        flex: 1;
      }
      .vgc-text {
        font-size: .78rem;
        color: rgba(255,255,255,.52);
        line-height: 1.65;
        margin-bottom: 16px;
      }
      .vgc-text a {
        color: #a78bfa;
        text-decoration: none;
        font-weight: 600;
      }
      .vgc-text a:hover { text-decoration: underline; }
      .vgc-btns {
        display: flex;
        gap: 10px;
      }
      .vgc-btn {
        flex: 1;
        padding: 12px 16px;
        border-radius: 12px;
        border: none;
        font-size: .86rem;
        font-weight: 800;
        cursor: pointer;
        font-family: inherit;
        transition: opacity .18s, transform .15s;
        -webkit-tap-highlight-color: transparent;
      }
      .vgc-btn:active { opacity: .82; transform: scale(.97); }
      .vgc-btn-accept {
        background: linear-gradient(135deg, #7c3aed, #a855f7);
        color: #fff;
        box-shadow: 0 4px 20px rgba(139,92,246,.35);
      }
      .vgc-btn-decline {
        background: rgba(255,255,255,.07);
        color: rgba(255,255,255,.65);
        border: 1px solid rgba(255,255,255,.11);
      }
      .vgc-detail {
        font-size: .7rem;
        color: rgba(255,255,255,.25);
        text-align: center;
        margin-top: 12px;
        line-height: 1.5;
      }
    `;
    document.head.appendChild(s);
  }

  // ── Mostrar banner ────────────────────────────────────────
  function showBanner() {
    if (document.getElementById('vg-consent')) return;
    injectStyles();

    const el = document.createElement('div');
    el.id = 'vg-consent';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Consentimiento de privacidad');
    el.innerHTML = `
      <div class="vgc-wrap">
        <div class="vgc-top">
          <span class="vgc-icon">🍪</span>
          <span class="vgc-title">Tu privacidad importa</span>
        </div>
        <p class="vgc-text">
          VirtualGift usa cookies y tecnologías similares para personalizar anuncios,
          analizar el uso de la app y mejorar tu experiencia. Al aceptar, ayudas a que
          la app sea gratuita y los anuncios sean relevantes para ti.<br><br>
          Consulta nuestra
          <a href="${typeof withAppFlag==='function'?withAppFlag('legal/Politicas.html'):'legal/Politicas.html'}">
            Política de Privacidad
          </a>
          y nuestros
          <a href="${typeof withAppFlag==='function'?withAppFlag('legal/terminos.html'):'legal/terminos.html'}">
            Términos de Uso
          </a>.
        </p>
        <div class="vgc-btns">
          <button type="button" class="vgc-btn vgc-btn-decline" onclick="VGConsent.decline()">
            Solo esenciales
          </button>
          <button type="button" class="vgc-btn vgc-btn-accept" onclick="VGConsent.accept()">
            Aceptar todo
          </button>
        </div>
        <p class="vgc-detail">
          Puedes cambiar tu preferencia en cualquier momento desde tu perfil.
        </p>
      </div>`;

    document.body.appendChild(el);
    // Animar entrada
    requestAnimationFrame(() =>
      requestAnimationFrame(() => el.classList.add('vgc-visible'))
    );
  }

  // ── Ocultar banner ────────────────────────────────────────
  function hideBanner() {
    const el = document.getElementById('vg-consent');
    if (!el) return;
    el.classList.remove('vgc-visible');
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 420);
  }

  // ── Init ──────────────────────────────────────────────────
  // No mostrar en páginas de autenticación / admin
  if (SKIP_PAGES.has(pageName())) return;

  window.addEventListener('DOMContentLoaded', () => {
    if (!getStored()) {
      // Pequeño delay para que la página cargue primero
      setTimeout(showBanner, 800);
    }
  });

})();
