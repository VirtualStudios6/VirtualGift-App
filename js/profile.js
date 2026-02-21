/* ============================================ */
/* CONSTANTES Y CONFIGURACIÓN */
/* ============================================ */
const AVATAR_PLACEHOLDER = 'images/logo-virtual-login.png';
const CACHE_KEY = 'vg_user_cache_profile';
const CACHE_DURATION = 5 * 60 * 1000;

// ✅ Cambia esto por tu correo de soporte
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

    msgEl.textContent    = message;
    btnOk.textContent    = confirmLabel;
    btnOk.className      = `vg-modal-btn ${confirmClass}`;
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
/* GESTIÓN DE ESTADOS DE LA UI */
/* ============================================ */

function showContent() {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('error').style.display = 'none';
  document.getElementById('content').style.display = 'block';
}

function showError() {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('content').style.display = 'none';
  document.getElementById('error').style.display = 'flex';
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

  btn.disabled         = !__emailRaw;
  btn.style.opacity    = __emailRaw ? '1' : '0.5';
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
    chip.textContent      = '🔐 Cuenta con contraseña';
    btnReset.style.display = 'flex';
  } else if (providers.includes('google.com')) {
    chip.textContent      = '🔵 Cuenta Google';
    btnReset.style.display = 'none';
  } else {
    chip.textContent      = '🔐 Cuenta segura';
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
}

/* ============================================ */
/* AUTENTICACIÓN */
/* ============================================ */

function checkAuth() {
  window.waitForFirebaseStorage((err) => {
    if (err) { showError(); return; }
    window.auth.onAuthStateChanged(async (user) => {
      if (!user) {
        window.location.href = withAppFlag('index.html');
        return;
      }
      loadBasicUserData(user);
      await loadFirestoreData(user);
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
    if (name.length < 2) { toast('Pon un nombre más largo 🙂'); return; }

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
    if (msg.includes('permission-denied'))                             toast('❌ Sin permisos (Firestore Rules)');
    else if (msg.includes('unavailable') || msg.includes('network'))  toast('❌ Sin conexión. Intenta de nuevo');
    else                                                               toast('❌ No se pudo cambiar el nombre');
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

// ✅ NUEVO: Reportar problema via mailto
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

// ✅ NUEVO: Eliminar cuenta con doble confirmación
async function deleteAccount(user) {
  // Primera confirmación
  const primera = await showConfirmModal(
    '⚠️ ¿Eliminar tu cuenta?\n\nEsta acción es permanente. Perderás todos tus puntos, historial y datos.',
    'Continuar',
    'vg-modal-btn-danger'
  );
  if (!primera) return;

  // Segunda confirmación (doble seguridad)
  const segunda = await showConfirmModal(
    '🗑️ Confirmación final\n\n¿Estás completamente seguro? No hay vuelta atrás.',
    'Sí, eliminar mi cuenta',
    'vg-modal-btn-danger'
  );
  if (!segunda) return;

  toast('Eliminando cuenta...');

  try {
    // 1. Eliminar documento de Firestore
    await window.db.collection('users').doc(user.uid).delete();

    // 2. Limpiar caché local
    try { localStorage.removeItem(CACHE_KEY); } catch {}

    // 3. Eliminar cuenta de Firebase Auth
    await user.delete();

    // 4. Redirigir al login
    window.location.href = withAppFlag('index.html');

  } catch (e) {
    console.error('Error eliminando cuenta:', e);

    // Firebase requiere re-autenticación si el login fue hace mucho tiempo
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
      setTimeout(() => {
        try { URL.revokeObjectURL(localUrl); } catch {}
      }, 1500);
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

  // ✅ NUEVOS
  document.getElementById('btnReport').addEventListener('click', () => {
    const user = window.auth?.currentUser;
    if (user) reportProblem(user);
  });

  document.getElementById('btnDeleteAccount').addEventListener('click', () => {
    const user = window.auth?.currentUser;
    if (user) deleteAccount(user);
  });
}

/* ============================================ */
/* INICIALIZACIÓN */
/* ============================================ */

window.addEventListener('load', () => {
  injectModals();
  setupEventListeners();
  checkAuth();
});
