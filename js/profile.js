/* ============================================ */
/* CONSTANTES Y CONFIGURACIÓN */
/* ============================================ */
const AVATAR_PLACEHOLDER = 'images/logo-virtual-login.png';
const CACHE_KEY = 'vg_user_cache_profile';
const CACHE_DURATION = 5 * 60 * 1000;

const SUPPORT_EMAIL = 'soporte@virtualgift.com';

/* ============================================ */
/* VARIABLES GLOBALES */
/* ============================================ */
let __isUploadingAvatar = false;
let __lastStableAvatar = '';
let __emailRaw = '';
let __emailShown = false;

/* ============================================ */
/* UTILIDADES GENERALES */
/* ============================================ */

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(window.__toastT);
  window.__toastT = setTimeout(() => el.style.display = 'none', 2400);
}

function cacheBust(url) {
  const u = String(url || '').trim();
  if (!u) return u;
  const sep = u.includes('?') ? '&' : '?';
  return u + sep + 'v=' + Date.now();
}

function maskEmail(email) {
  const e = String(email || '').trim();
  if (!e || !e.includes('@')) return e;

  const [name, domain] = e.split('@');
  const parts = domain.split('.');
  const tld = parts.length > 1 ? parts.pop() : '';
  const domainName = parts.join('.');

  const safeName = name.length <= 2
    ? (name[0] ? name[0] + '*' : '*')
    : (name.slice(0, 2) + '***' + name.slice(-1));

  const safeDomain = domainName.length <= 3
    ? (domainName[0] ? domainName[0] + '**' : '**')
    : (domainName.slice(0, 2) + '***' + domainName.slice(-1));

  return safeName + '@' + safeDomain + (tld ? ('.' + tld) : '');
}

/* ============================================ */
/* MODALES CUSTOM                              */
/* ============================================ */

function injectModals() {
  if (document.getElementById('vg-modal-overlay')) return;

  const html = `
    <div id="vg-modal-overlay" class="vg-modal-overlay" style="display:none;" role="dialog" aria-modal="true">
      <div class="vg-modal-box">
        <p id="vg-modal-message" class="vg-modal-message"></p>
        <div class="vg-modal-actions">
          <button id="vg-modal-cancel" class="vg-modal-btn vg-modal-btn-cancel">Cancelar</button>
          <button id="vg-modal-confirm" class="vg-modal-btn vg-modal-btn-confirm">Confirmar</button>
        </div>
      </div>
    </div>

    <div id="vg-input-overlay" class="vg-modal-overlay" style="display:none;" role="dialog" aria-modal="true">
      <div class="vg-modal-box">
        <p class="vg-modal-message">¿Cómo quieres que aparezca tu nombre?</p>
        <input id="vg-input-field" class="vg-modal-input" type="text" maxlength="40" autocomplete="off" />
        <div class="vg-modal-actions">
          <button id="vg-input-cancel" class="vg-modal-btn vg-modal-btn-cancel">Cancelar</button>
          <button id="vg-input-confirm" class="vg-modal-btn vg-modal-btn-confirm">Guardar</button>
        </div>
      </div>
    </div>
  `;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);
}

function showConfirmModal(message, confirmLabel = 'Confirmar', confirmClass = 'vg-modal-btn-confirm') {
  return new Promise((resolve) => {
    const overlay   = document.getElementById('vg-modal-overlay');
    const msgEl     = document.getElementById('vg-modal-message');
    const btnOk     = document.getElementById('vg-modal-confirm');
    const btnCancel = document.getElementById('vg-modal-cancel');

    msgEl.textContent     = message;
    btnOk.textContent     = confirmLabel;
    btnOk.className       = `vg-modal-btn ${confirmClass}`;
    overlay.style.display = 'flex';

    const cleanup = (result) => {
      overlay.style.display = 'none';
      btnOk.removeEventListener('click', onOk);
      btnCancel.removeEventListener('click', onCancel);
      resolve(result);
    };

    const onOk     = () => cleanup(true);
    const onCancel = () => cleanup(false);

    btnOk.addEventListener('click', onOk);
    btnCancel.addEventListener('click', onCancel);
  });
}

function showInputModal(currentValue) {
  return new Promise((resolve) => {
    const overlay   = document.getElementById('vg-input-overlay');
    const input     = document.getElementById('vg-input-field');
    const btnOk     = document.getElementById('vg-input-confirm');
    const btnCancel = document.getElementById('vg-input-cancel');

    input.value           = currentValue || '';
    overlay.style.display = 'flex';

    setTimeout(() => input.focus(), 120);

    const cleanup = (result) => {
      overlay.style.display = 'none';
      btnOk.removeEventListener('click', onOk);
      btnCancel.removeEventListener('click', onCancel);
      input.removeEventListener('keydown', onKey);
      resolve(result);
    };

    const onOk     = () => cleanup(input.value);
    const onCancel = () => cleanup(null);
    const onKey    = (e) => { if (e.key === 'Enter') onOk(); };

    btnOk.addEventListener('click', onOk);
    btnCancel.addEventListener('click', onCancel);
    input.addEventListener('keydown', onKey);
  });
}

/* ============================================ */
/* GESTIÓN DE ESTADOS DE LA UI                 */
/* ============================================ */

function showContent() {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('error').style.display   = 'none';

  // ✅ FIX: no usar display:block inline — deja que el CSS decida
  // (en desktop el CSS aplica display:flex para el sidebar)
  const content = document.getElementById('content');
  content.classList.remove('hidden');
}

function showError() {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('content').classList.add('hidden');
  document.getElementById('error').style.display   = 'flex';
}

/* ============================================ */
/* GESTIÓN DE AVATAR */
/* ============================================ */

function safeSetAvatar(url) {
  const avatarEl = document.getElementById('avatar');
  const clean = (url && String(url).trim()) ? String(url).trim() : '';

  function applyPlaceholderStyle() {
    avatarEl.style.objectFit  = 'contain';
    avatarEl.style.padding    = '12px';
    avatarEl.style.background = 'rgba(141,23,251,0.12)';
  }

  function applyPhotoStyle() {
    avatarEl.style.objectFit  = 'cover';
    avatarEl.style.padding    = '0';
    avatarEl.style.background = 'rgba(255,255,255,0.06)';
  }

  const isPlaceholder = !clean || clean.includes('logo-virtual-login');

  avatarEl.onerror = null;
  avatarEl.src = clean || AVATAR_PLACEHOLDER;

  if (isPlaceholder) {
    applyPlaceholderStyle();
  } else {
    applyPhotoStyle();
  }

  avatarEl.onerror = () => {
    avatarEl.onerror = null;
    avatarEl.src = AVATAR_PLACEHOLDER;
    applyPlaceholderStyle();
  };
}

function openAvatarPicker() {
  const user = window.auth?.currentUser;
  if (!user) return;
  const input = document.getElementById('avatarInput');
  input.value = '';
  input.click();
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload  = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Imagen inválida')); };
    img.src = url;
  });
}

async function compressImageToJpeg(file, maxSize = 512, quality = 0.75) {
  const img = await loadImageFromFile(file);

  const width  = img.naturalWidth  || img.width;
  const height = img.naturalHeight || img.height;
  const scale  = Math.min(maxSize / width, maxSize / height, 1);
  const newW   = Math.max(1, Math.round(width  * scale));
  const newH   = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width  = newW;
  canvas.height = newH;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, newW, newH);

  const blob = await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
  });

  if (!blob) throw new Error('No se pudo comprimir la imagen');
  return blob;
}

async function uploadAvatarBlob(user, blob) {
  const path     = `avatars/${user.uid}.jpg`;
  const ref      = window.storage.ref().child(path);
  const metadata = { contentType: 'image/jpeg', cacheControl: 'public, max-age=3600' };

  await ref.put(blob, metadata);
  return await ref.getDownloadURL();
}

async function setAvatarEverywhere(user, photoURL) {
  await user.updateProfile({ photoURL });

  await window.db.collection('users').doc(user.uid).set({
    photoURL,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  setCachedUserData({ photoURL });
}

/* ============================================ */
/* GESTIÓN DE EMAIL */
/* ============================================ */

function renderEmail() {
  const el        = document.getElementById('userEmail');
  const eyeOpen   = document.getElementById('eyeOpen');
  const eyeClosed = document.getElementById('eyeClosed');
  const btn       = document.getElementById('btnToggleEmail');

  el.textContent = __emailShown ? __emailRaw : maskEmail(__emailRaw);

  eyeOpen.style.display   = __emailShown ? 'none'  : 'block';
  eyeClosed.style.display = __emailShown ? 'block' : 'none';

  btn.disabled            = !__emailRaw;
  btn.style.opacity       = __emailRaw ? '1' : '0.5';
  btn.style.pointerEvents = __emailRaw ? 'auto' : 'none';
}

/* ============================================ */
/* PROVEEDOR DE AUTENTICACIÓN */
/* ============================================ */

function setProviderChip(user) {
  const chip     = document.getElementById('chipProvider');
  const btnReset = document.getElementById('btnResetPassword');
  const providers = (user.providerData || []).map(p => p.providerId);

  if (providers.includes('password')) {
    chip.textContent       = '🔐 Cuenta con contraseña';
    btnReset.style.display = 'flex';
  } else if (providers.includes('google.com')) {
    chip.textContent       = '🔵 Cuenta Google';
    btnReset.style.display = 'none';
  } else {
    chip.textContent       = '🔐 Cuenta segura';
    btnReset.style.display = 'none';
  }
}

/* ============================================ */
/* CACHÉ LOCAL */
/* ============================================ */

function getCachedUserData() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const data = JSON.parse(cached);
    const age  = Date.now() - data.timestamp;

    if (age < CACHE_DURATION) return data.user;

    localStorage.removeItem(CACHE_KEY);
    return null;
  } catch {
    return null;
  }
}

function setCachedUserData(userData) {
  try {
    const prev   = getCachedUserData() || {};
    const merged = { ...prev, ...userData };
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      user: merged,
      timestamp: Date.now()
    }));
  } catch (err) {
    console.warn('Error guardando caché:', err);
  }
}

/* ============================================ */
/* CARGA DE DATOS */
/* ============================================ */

function loadBasicUserData(user) {
  document.getElementById('userName').textContent = user.displayName || 'Usuario';

  __emailRaw   = user.email || '';
  __emailShown = false;
  renderEmail();

  __lastStableAvatar = user.photoURL || '';
  safeSetAvatar(cacheBust(user.photoURL) || AVATAR_PLACEHOLDER);

  setProviderChip(user);
  showContent();
}

async function loadFirestoreData(user) {
  try {
    const cached = getCachedUserData();
    if (cached) {
      if (cached.photoURL && !__isUploadingAvatar) safeSetAvatar(cacheBust(cached.photoURL));
      if (cached.displayName) document.getElementById('userName').textContent = cached.displayName;
      fetchAndUpdateFirestore(user, true);
      return;
    }
    await fetchAndUpdateFirestore(user, false);
  } catch (e) {
    console.warn('Error cargando datos de Firestore:', e);
  }
}

async function fetchAndUpdateFirestore(user, silent = false) {
  const ref  = window.db.collection('users').doc(user.uid);
  const snap = await ref.get();

  if (!snap.exists) return;

  const data = snap.data() || {};
  setCachedUserData(data);

  if (data.displayName) document.getElementById('userName').textContent = data.displayName;
  if (data.photoURL && !__isUploadingAvatar) safeSetAvatar(cacheBust(data.photoURL));

  // ── Referral code ──────────────────────────────────────
  let code = data.referralCode;
  if (!code) {
    code = 'VG' + user.uid.slice(0, 6).toUpperCase();
    ref.set({ referralCode: code }, { merge: true })
       .catch((e) => console.warn('[profile] referralCode:', e?.code || e?.message));
  }

  const codeEl  = document.getElementById('referralCode');
  const section = document.getElementById('referralSection');
  if (codeEl) codeEl.textContent = code;

  // Mostrar sección con animación (quitar clase hidden)
  if (section) {
    section.classList.remove('ref-section--hidden');
    if (window.lucide) lucide.createIcons({ parentNode: section });
  }

  // Estadísticas
  const statsEl = document.getElementById('referralStats');
  if (statsEl) {
    if (data.referredBy) {
      statsEl.textContent = '✓ Ya usaste un código de invitación';
    } else if (data.referralCount > 0) {
      statsEl.textContent = `${data.referralCount} amigo${data.referralCount !== 1 ? 's' : ''} invitado${data.referralCount !== 1 ? 's' : ''}`;
    }
  }

  // Mostrar campo "¿te invitó alguien?" solo si no tiene referido
  if (!data.referredBy) {
    const enterWrap = document.getElementById('refEnterWrap');
    if (enterWrap) enterWrap.classList.remove('ref-enter-wrap--hidden');
  }
}

/* ============================================ */
/* AUTENTICACIÓN                               */
/* ============================================ */

function checkAuth() {
  // ✅ FIX: usar waitForFirebase, no waitForFirebaseStorage (no existe)
  window.waitForFirebase((err) => {
    if (err) { showError(); return; }

    window.auth.onAuthStateChanged(async (user) => {
      if (!user) {
        window.location.href = withAppFlag('index.html');
        return;
      }
      loadBasicUserData(user);
      await loadFirestoreData(user);
      if (typeof initPush === 'function') initPush(user.uid);
    });
  });
}

/* ============================================ */
/* ACCIONES                                    */
/* ============================================ */

async function editName(user) {
  try {
    const current = document.getElementById('userName').textContent || '';
    const next    = await showInputModal(current);

    if (next === null) return;

    const name = String(next).trim();
    const nv = typeof Validators !== 'undefined' ? Validators.displayName(name) : null;
    if (nv && !nv.valid) { toast('❌ ' + nv.message); return; }
    else if (!nv && name.length < 2) { toast('Pon un nombre más largo 🙂'); return; }

    toast('Guardando nombre...');
    document.getElementById('userName').textContent = name;

    await window.db.collection('users').doc(user.uid).set({
      displayName: name,
      username: name,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    try {
      await user.updateProfile({ displayName: name });
      try { await user.reload(); } catch {}
    } catch (authErr) {
      console.warn('Auth updateProfile falló, pero Firestore sí guardó:', authErr);
    }

    setCachedUserData({ displayName: name, username: name });
    toast('✅ Nombre actualizado');
  } catch (e) {
    console.error('Error editando nombre:', e);
    const msg = String(e?.code || e?.message || '');
    if (msg.includes('permission-denied'))                            toast('❌ Sin permisos (Firestore Rules)');
    else if (msg.includes('unavailable') || msg.includes('network')) toast('❌ Sin conexión. Intenta de nuevo');
    else                                                              toast('❌ No se pudo cambiar el nombre');
  }
}

async function resetPassword(user) {
  try {
    const email = user?.email || '';
    if (!email) { toast('❌ No hay correo en la cuenta'); return; }

    const confirmed = await showConfirmModal('¿Enviar correo para cambiar contraseña a ' + email + '?');
    if (!confirmed) return;

    toast('Enviando correo...');
    await window.auth.sendPasswordResetEmail(email);
    toast('✅ Revisa tu correo (spam también)');
  } catch (e) {
    console.error('Error reseteando contraseña:', e);
    toast('❌ No se pudo enviar el correo');
  }
}

async function logout() {
  const confirmed = await showConfirmModal('¿Seguro que quieres cerrar sesión?');
  if (!confirmed) return;

  try { localStorage.removeItem(CACHE_KEY); } catch {}

  if (window.auth) {
    window.auth.signOut()
      .then(() => window.location.href = withAppFlag('index.html'))
      .catch(() => window.location.href = withAppFlag('index.html'));
  } else {
    window.location.href = withAppFlag('index.html');
  }
}

function reportProblem(user) {
  const nombre    = document.getElementById('userName')?.textContent || 'Usuario';
  const email     = user?.email || 'No disponible';
  const uid       = user?.uid   || 'No disponible';
  const userAgent = navigator.userAgent || 'No disponible';
  const fecha     = new Date().toLocaleString('es-DO');

  const subject = encodeURIComponent('🐛 Reporte de problema - VirtualGift');
  const body    = encodeURIComponent(
`Hola, quiero reportar un problema en VirtualGift.

-- Descripción del problema --
[Escribe aquí qué pasó, cuándo ocurrió y qué estabas haciendo]

-- Pasos para reproducirlo --
1.
2.
3.

-- Información del sistema --
Usuario: ${nombre}
Email: ${email}
UID: ${uid}
Fecha: ${fecha}
Dispositivo: ${userAgent}

-- Capturas de pantalla --
[Adjunta aquí capturas del problema si las tienes]
`
  );

  window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
}

async function deleteAccount(user) {
  const confirmada = await showConfirmModal(
    'Esta acción es irreversible. Se eliminarán todos tus datos, coins, participaciones en sorteos e historial.',
    'Sí, eliminar mi cuenta',
    'vg-modal-btn-danger'
  );
  if (!confirmada) return;

  // Mostrar loading
  const btn = document.getElementById('btnDeleteAccount');
  const originalHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span style="opacity:.75;font-size:13px;">Eliminando...</span>';
  }
  toast('Eliminando todos tus datos...');

  try {
    // 1. Borrar todos los datos del usuario (Firestore + Storage)
    await deleteUserData(user.uid);

    // 2. Limpiar caché local
    try { localStorage.removeItem(CACHE_KEY); } catch {}

    // 3. Eliminar cuenta de Authentication
    await user.delete();

    // 4. Redirigir
    window.location.href = withAppFlag('index.html');

  } catch (e) {
    console.error('Error eliminando cuenta:', e);
    if (btn) { btn.disabled = false; btn.innerHTML = originalHtml; }

    if (e.code === 'auth/requires-recent-login') {
      toast('Por seguridad, cierra sesión, vuelve a iniciar y repite esta acción.');
    } else {
      toast('❌ No se pudo eliminar la cuenta. Intenta de nuevo.');
    }
  }
}

/* ============================================ */
/* EVENT LISTENERS */
/* ============================================ */

document.getElementById('avatarInput').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const user = window.auth?.currentUser;
  if (!user) return;

  __lastStableAvatar  = user.photoURL || __lastStableAvatar || '';
  __isUploadingAvatar = true;

  let localUrl = '';
  try {
    localUrl = URL.createObjectURL(file);
    safeSetAvatar(localUrl);
  } catch (err) {
    console.warn('Error creando preview:', err);
  }

  try {
    toast('Subiendo avatar...');

    const blob = await compressImageToJpeg(file, 512, 0.75);
    const url  = await uploadAvatarBlob(user, blob);
    await setAvatarEverywhere(user, url);

    try { await user.reload(); } catch (err) { console.warn('Error recargando usuario:', err); }

    safeSetAvatar(cacheBust(url));
    __lastStableAvatar = url;
    toast('✅ Avatar actualizado');
  } catch (err) {
    console.error('Error subiendo avatar:', err);
    const fallback = __lastStableAvatar || user.photoURL || '';
    safeSetAvatar(cacheBust(fallback) || AVATAR_PLACEHOLDER);

    const msg = (err && err.code) ? String(err.code) : '';
    if (msg.includes('storage/unauthorized'))  toast('❌ Sin permiso para subir (Storage rules)');
    else if (msg.includes('storage/canceled')) toast('❌ Subida cancelada');
    else                                       toast('❌ No se pudo subir el avatar');
  } finally {
    __isUploadingAvatar = false;
    if (localUrl) {
      setTimeout(() => { try { URL.revokeObjectURL(localUrl); } catch {} }, 1500);
    }
  }
});

function setupEventListeners() {
  document.getElementById('avatar').addEventListener('click', openAvatarPicker);
  document.getElementById('btnEditAvatar').addEventListener('click', openAvatarPicker);

  document.getElementById('btnToggleEmail').addEventListener('click', () => {
    __emailShown = !__emailShown;
    renderEmail();
  });

  document.getElementById('btnEditName').addEventListener('click', () => {
    const user = window.auth?.currentUser;
    if (user) editName(user);
  });

  document.getElementById('btnResetPassword').addEventListener('click', () => {
    const user = window.auth?.currentUser;
    if (user) resetPassword(user);
  });

  document.getElementById('btnLogout').addEventListener('click', logout);

  document.getElementById('btnReport').addEventListener('click', () => {
    const user = window.auth?.currentUser;
    if (user) reportProblem(user);
  });

  document.getElementById('btnDeleteAccount').addEventListener('click', () => {
    const user = window.auth?.currentUser;
    if (user) deleteAccount(user);
  });

  // ── Helpers de referidos ────────────────────────────────
  function getReferralUrl() {
    const code = document.getElementById('referralCode')?.textContent || '';
    if (!code || code === '—') return null;
    const base = window.location.href.replace(/home\.html.*$/, '');
    return `${base}index.html?ref=${code}`;
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback para Capacitor / Android WebView
      const el = document.createElement('textarea');
      el.value = text;
      el.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      return true;
    }
  }

  function showCopiedFeedback() {
    const el = document.getElementById('referralCopied');
    if (!el) return;
    el.classList.add('show');
    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(() => el.classList.remove('show'), 2400);
  }

  // ── Copiar solo el código ────────────────────────────────
  document.getElementById('btnCopyCode')?.addEventListener('click', async () => {
    const code = document.getElementById('referralCode')?.textContent || '';
    if (!code || code === '—') return;
    const btn = document.getElementById('btnCopyCode');
    await copyToClipboard(code);
    btn?.classList.add('copied');
    setTimeout(() => btn?.classList.remove('copied'), 1600);
    toast('Código copiado');
  });

  // ── Compartir enlace (Share API nativa en Capacitor/móvil) ──
  document.getElementById('btnShareReferral')?.addEventListener('click', async () => {
    const url = getReferralUrl();
    if (!url) return;
    const shareData = {
      title: 'VirtualGift',
      text:  '¡Únete a VirtualGift y gana coins gratis! Usa mi código al registrarte.',
      url,
    };
    try {
      // navigator.share funciona de forma nativa en Capacitor (Android / iOS)
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
      } else {
        await copyToClipboard(url);
        showCopiedFeedback();
      }
    } catch (e) {
      if (e?.name !== 'AbortError') {
        await copyToClipboard(url);
        showCopiedFeedback();
      }
    }
  });

  // ── Copiar enlace completo ───────────────────────────────
  document.getElementById('btnCopyReferral')?.addEventListener('click', async () => {
    const url = getReferralUrl();
    if (!url) return;
    await copyToClipboard(url);
    showCopiedFeedback();
  });

  // ── Aplicar código de invitación (para usuarios sin referido) ──
  document.getElementById('btnApplyRef')?.addEventListener('click', () => applyReferralCode());
  document.getElementById('refCodeInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') applyReferralCode();
  });
  document.getElementById('refCodeInput')?.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });
}

/* ============================================ */
/* APLICAR CÓDIGO DE REFERIDO                  */
/* ============================================ */
async function applyReferralCode() {
  const input   = document.getElementById('refCodeInput');
  const msgEl   = document.getElementById('refEnterMsg');
  const btn     = document.getElementById('btnApplyRef');
  const rawCode = (input?.value || '').trim().toUpperCase();

  function setMsg(text, type) {
    if (!msgEl) return;
    msgEl.textContent = text;
    msgEl.className = `ref-enter-msg${type ? ' ' + type : ''}`;
  }

  if (!rawCode) { setMsg('Ingresa un código', 'error'); return; }
  if (!/^VG[A-Z0-9]{6}$/.test(rawCode)) { setMsg('Formato inválido (ej: VGABC123)', 'error'); return; }

  const user = window.auth?.currentUser;
  if (!user) { setMsg('Sesión expirada, recarga la página', 'error'); return; }

  const myCode = document.getElementById('referralCode')?.textContent || '';
  if (rawCode === myCode) { setMsg('No puedes usar tu propio código', 'error'); return; }

  // Deshabilitar mientras procesa
  if (btn) { btn.disabled = true; }
  setMsg('Verificando...', '');

  try {
    const db = window.db;
    // Buscar al referidor
    const snap = await db.collection('users')
      .where('referralCode', '==', rawCode)
      .limit(1).get();

    if (snap.empty) { setMsg('Código no encontrado', 'error'); return; }

    const referrerId  = snap.docs[0].id;
    const referrerRef = snap.docs[0].ref;
    const BONUS       = 500;
    const userRef     = db.collection('users').doc(user.uid);
    const now         = firebase.firestore.Timestamp.now();

    // Verificar que el usuario actual no tenga ya un referido
    const mySnap = await userRef.get();
    if (mySnap.data()?.referredBy) {
      setMsg('Ya tienes un código aplicado', 'error'); return;
    }

    // Recompensar al referidor
    await referrerRef.update({
      points:        firebase.firestore.FieldValue.increment(BONUS),
      referralCount: firebase.firestore.FieldValue.increment(1),
    });
    await db.collection('pointsHistory').add({
      userId: referrerId, type: 'referral_bonus',
      points: BONUS, fromUser: user.uid, createdAt: now,
    });

    // Recompensar al usuario actual
    await userRef.update({
      points:    firebase.firestore.FieldValue.increment(BONUS),
      referredBy: referrerId,
    });
    await db.collection('pointsHistory').add({
      userId: user.uid, type: 'referral_bonus',
      points: BONUS, fromCode: rawCode, createdAt: now,
    });

    // Actualizar UI
    setMsg(`¡+${BONUS} coins aplicados!`, 'success');
    toast(`+${BONUS} coins de bienvenida`);
    const statsEl = document.getElementById('referralStats');
    if (statsEl) statsEl.textContent = '✓ Ya usaste un código de invitación';
    // Ocultar el bloque de ingreso
    const wrap = document.getElementById('refEnterWrap');
    if (wrap) wrap.classList.add('ref-enter-wrap--hidden');

  } catch (e) {
    console.error('[referral] apply error — code:', e.code, '| msg:', e.message);
    if (e.code === 'permission-denied') {
      setMsg('Sin permisos en Firestore. Revisa las reglas.', 'error');
    } else if (e.code === 'not-found') {
      setMsg('Código no encontrado', 'error');
    } else {
      setMsg('Error al aplicar, intenta de nuevo', 'error');
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* ============================================ */
/* INICIALIZACIÓN */
/* ============================================ */

window.addEventListener('load', () => {
  injectModals();
  setupEventListeners();
  checkAuth();
});
