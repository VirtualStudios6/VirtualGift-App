/* ============================================ */
/* CONSTANTES Y CONFIGURACIÓN */
/* ============================================ */
const AVATAR_PLACEHOLDER = 'images/logo-virtual-login.png';
const CACHE_KEY = 'vg_user_cache_profile';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

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

/**
 * Muestra un toast de notificación temporal
 */
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(window.__toastT);
  window.__toastT = setTimeout(() => el.style.display = 'none', 2400);
}

/**
 * Cache bust para evitar que se cacheen las imágenes
 */
function cacheBust(url) {
  const u = String(url || '').trim();
  if (!u) return u;
  const sep = u.includes('?') ? '&' : '?';
  return u + sep + 'v=' + Date.now();
}

/**
 * Enmascara el email para mostrar solo parte (privacidad)
 */
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
/* GESTIÓN DE ESTADOS DE LA UI */
/* ============================================ */

/**
 * Muestra el contenido principal del perfil
 */
function showContent() {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('error').style.display = 'none';
  document.getElementById('content').style.display = 'block';
}

/**
 * Muestra el estado de error
 */
function showError() {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('content').style.display = 'none';
  document.getElementById('error').style.display = 'flex';
}

/* ============================================ */
/* GESTIÓN DE AVATAR */
/* ============================================ */

/**
 * Establece el avatar de forma segura con fallback
 */
function safeSetAvatar(url) {
  const avatarEl = document.getElementById('avatar');
  const clean = (url && String(url).trim()) ? String(url).trim() : '';

  avatarEl.onerror = null;
  avatarEl.src = clean || AVATAR_PLACEHOLDER;

  avatarEl.onerror = () => {
    avatarEl.onerror = null;
    avatarEl.src = AVATAR_PLACEHOLDER;
  };
}

/**
 * Abre el selector de archivos para cambiar avatar
 */
function openAvatarPicker() {
  const user = window.auth?.currentUser;
  if (!user) return;

  const input = document.getElementById('avatarInput');
  input.value = '';
  input.click();
}

/**
 * Carga una imagen desde un archivo
 */
function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Imagen inválida'));
    };
    img.src = url;
  });
}

/**
 * Comprime una imagen a JPEG con tamaño y calidad especificados
 */
async function compressImageToJpeg(file, maxSize = 512, quality = 0.75) {
  const img = await loadImageFromFile(file);

  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;

  const scale = Math.min(maxSize / width, maxSize / height, 1);
  const newW = Math.max(1, Math.round(width * scale));
  const newH = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = newW;
  canvas.height = newH;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, newW, newH);

  const blob = await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
  });

  if (!blob) throw new Error('No se pudo comprimir la imagen');
  return blob;
}

/**
 * Sube el blob del avatar a Firebase Storage
 */
async function uploadAvatarBlob(user, blob) {
  const path = `avatars/${user.uid}.jpg`;
  const ref = window.storage.ref().child(path);
  const metadata = {
    contentType: 'image/jpeg',
    cacheControl: 'public, max-age=3600'
  };

  await ref.put(blob, metadata);
  return await ref.getDownloadURL();
}

/**
 * Guarda el avatar en Auth, Firestore y caché local
 */
async function setAvatarEverywhere(user, photoURL) {
  // 1) Firebase Auth
  await user.updateProfile({ photoURL });

  // 2) Firestore
  await window.db.collection('users').doc(user.uid).set({
    photoURL,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  // 3) Caché local
  setCachedUserData({ photoURL });
}

/* ============================================ */
/* GESTIÓN DE EMAIL */
/* ============================================ */

/**
 * Renderiza el email (mostrado u oculto) y actualiza el icono
 */
function renderEmail() {
  const el = document.getElementById('userEmail');
  const btn = document.getElementById('btnToggleEmail');
  const eyeOpen = document.getElementById('eyeOpen');
  const eyeClosed = document.getElementById('eyeClosed');

  const shown = __emailShown ? __emailRaw : maskEmail(__emailRaw);
  el.textContent = shown || '';

  // Cambiar icono según estado
  eyeOpen.style.display = __emailShown ? 'none' : 'block';
  eyeClosed.style.display = __emailShown ? 'block' : 'none';

  // Desactivar botón si no hay email
  btn.disabled = !__emailRaw;
  btn.style.opacity = __emailRaw ? '1' : '0.5';
  btn.style.pointerEvents = __emailRaw ? 'auto' : 'none';
}

/* ============================================ */
/* GESTIÓN DE PROVEEDOR DE AUTENTICACIÓN */
/* ============================================ */

/**
 * Establece el chip de proveedor según el método de autenticación
 */
function setProviderChip(user) {
  const chip = document.getElementById('chipProvider');
  const providers = (user.providerData || []).map(p => p.providerId);

  if (providers.includes('password')) {
    chip.textContent = '🔐 Cuenta con contraseña';
  } else if (providers.includes('google.com')) {
    chip.textContent = '🔐 Cuenta Google';
  } else {
    chip.textContent = '🔐 Cuenta segura';
  }
}

/* ============================================ */
/* GESTIÓN DE CACHÉ LOCAL */
/* ============================================ */

/**
 * Obtiene datos del usuario desde el caché local
 */
function getCachedUserData() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const data = JSON.parse(cached);
    const age = Date.now() - data.timestamp;

    if (age < CACHE_DURATION) return data.user;

    localStorage.removeItem(CACHE_KEY);
    return null;
  } catch {
    return null;
  }
}

/**
 * Guarda datos del usuario en el caché local (merge)
 */
function setCachedUserData(userData) {
  try {
    const prev = getCachedUserData() || {};
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
/* VERIFICACIÓN DE FIREBASE */
/* ============================================ */

/**
 * Verifica si Firebase está listo para usar
 */
function isFirebaseReady() {
  return typeof firebase !== 'undefined'
    && typeof firebase.auth === 'function'
    && typeof firebase.firestore === 'function'
    && typeof firebase.storage === 'function'
    && window.auth && window.db && window.storage;
}

/**
 * Espera a que Firebase esté listo
 */
function waitForFirebase(callback, maxAttempts = 30) {
  let attempts = 0;
  const check = setInterval(() => {
    attempts++;
    if (isFirebaseReady()) {
      clearInterval(check);
      callback();
    } else if (attempts >= maxAttempts) {
      clearInterval(check);
      console.error('Firebase timeout');
      showError();
    }
  }, 100);
}

/* ============================================ */
/* CARGA DE DATOS DEL USUARIO */
/* ============================================ */

/**
 * Carga los datos básicos del usuario desde Firebase Auth
 */
function loadBasicUserData(user) {
  // Nombre
  document.getElementById('userName').textContent = user.displayName || 'Usuario';

  // Email
  __emailRaw = user.email || '';
  __emailShown = false;
  renderEmail();

  // Avatar
  __lastStableAvatar = user.photoURL || '';
  safeSetAvatar(cacheBust(user.photoURL) || AVATAR_PLACEHOLDER);

  // Chip de proveedor
  setProviderChip(user);

  // Mostrar contenido
  showContent();
}

/**
 * Carga datos adicionales desde Firestore
 */
async function loadFirestoreData(user) {
  try {
    // 1) Intentar usar caché primero
    const cached = getCachedUserData();
    if (cached) {
      if (cached.photoURL && !__isUploadingAvatar) {
        safeSetAvatar(cacheBust(cached.photoURL));
      }
      if (cached.displayName) {
        document.getElementById('userName').textContent = cached.displayName;
      }

      // Refresh silencioso en background
      fetchAndUpdateFirestore(user, true);
      return;
    }

    // 2) Si no hay caché, cargar desde Firestore
    await fetchAndUpdateFirestore(user, false);
  } catch (e) {
    console.warn('Error cargando datos de Firestore:', e);
  }
}

/**
 * Obtiene y actualiza datos desde Firestore
 */
async function fetchAndUpdateFirestore(user, silent = false) {
  const ref = window.db.collection('users').doc(user.uid);
  const snap = await ref.get();

  if (!snap.exists) return;

  const data = snap.data() || {};
  setCachedUserData(data);

  // Actualizar nombre si existe
  if (data.displayName) {
    document.getElementById('userName').textContent = data.displayName;
  }

  // Actualizar avatar SOLO si no se está subiendo uno nuevo
  if (data.photoURL && !__isUploadingAvatar) {
    safeSetAvatar(cacheBust(data.photoURL));
  }
}

/* ============================================ */
/* AUTENTICACIÓN */
/* ============================================ */

/**
 * Verifica la autenticación del usuario
 */
function checkAuth() {
  waitForFirebase(() => {
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
/* ACCIONES DEL USUARIO */
/* ============================================ */

/**
 * Permite al usuario cambiar su nombre
 */
async function editName(user) {
  try {
    const current = document.getElementById('userName').textContent || '';
    const next = prompt('¿Cómo quieres que aparezca tu nombre?', current);

    if (next === null) return; // Usuario canceló

    const name = String(next).trim();
    if (name.length < 2) {
      toast('Pon un nombre más largo 🙂');
      return;
    }

    toast('Guardando nombre...');

    // Actualizar en Auth
    await user.updateProfile({ displayName: name });

    // Actualizar en Firestore
    await window.db.collection('users').doc(user.uid).set({
      displayName: name,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // Actualizar UI y caché
    document.getElementById('userName').textContent = name;
    setCachedUserData({ displayName: name });

    toast('✅ Nombre actualizado');
  } catch (e) {
    console.error('Error editando nombre:', e);
    toast('❌ No se pudo cambiar el nombre');
  }
}

/**
 * Envía un correo para resetear la contraseña
 */
async function resetPassword(user) {
  try {
    const email = user?.email || '';
    if (!email) {
      toast('❌ No hay correo en la cuenta');
      return;
    }

    const providers = (user.providerData || []).map(p => p.providerId);

    // Advertir si no es cuenta de contraseña
    if (!providers.includes('password')) {
      const confirmed = confirm(
        'Tu cuenta parece ser de Google/otro proveedor. ' +
        '¿Aún así quieres enviar el correo para cambiar contraseña?'
      );
      if (!confirmed) return;
    }

    toast('Enviando correo...');
    await window.auth.sendPasswordResetEmail(email);
    toast('✅ Revisa tu correo (spam también)');
  } catch (e) {
    console.error('Error reseteando contraseña:', e);
    toast('❌ No se pudo enviar el correo');
  }
}

/**
 * Cierra la sesión del usuario
 */
function logout() {
  if (!confirm('¿Seguro que quieres cerrar sesión?')) return;

  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (err) {
    console.warn('Error limpiando caché:', err);
  }

  if (window.auth) {
    window.auth.signOut()
      .then(() => window.location.href = withAppFlag('index.html'))
      .catch(() => window.location.href = withAppFlag('index.html'));
  } else {
    window.location.href = withAppFlag('index.html');
  }
}

/* ============================================ */
/* EVENT LISTENERS */
/* ============================================ */

/**
 * Maneja la selección de archivo de avatar
 */
document.getElementById('avatarInput').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const user = window.auth?.currentUser;
  if (!user) return;

  // Guardar avatar estable antes del preview
  __lastStableAvatar = user.photoURL || __lastStableAvatar || '';
  __isUploadingAvatar = true;

  // Preview local inmediato
  let localUrl = '';
  try {
    localUrl = URL.createObjectURL(file);
    safeSetAvatar(localUrl);
  } catch (err) {
    console.warn('Error creando preview:', err);
  }

  try {
    toast('Subiendo avatar...');

    // 1) Comprimir imagen
    const blob = await compressImageToJpeg(file, 512, 0.75);

    // 2) Subir a Storage
    const url = await uploadAvatarBlob(user, blob);

    // 3) Guardar en Auth, Firestore y caché
    await setAvatarEverywhere(user, url);

    // 4) Recargar usuario para obtener datos actualizados
    try {
      await user.reload();
    } catch (err) {
      console.warn('Error recargando usuario:', err);
    }

    // 5) Actualizar UI
    safeSetAvatar(cacheBust(url));
    __lastStableAvatar = url;

    toast('✅ Avatar actualizado');
  } catch (err) {
    console.error('Error subiendo avatar:', err);

    // Restaurar avatar anterior en caso de error
    const fallback = __lastStableAvatar || user.photoURL || '';
    safeSetAvatar(cacheBust(fallback) || AVATAR_PLACEHOLDER);

    // Mensajes de error específicos
    const msg = (err && err.code) ? String(err.code) : '';
    if (msg.includes('storage/unauthorized')) {
      toast('❌ Sin permiso para subir (Storage rules)');
    } else if (msg.includes('storage/canceled')) {
      toast('❌ Subida cancelada');
    } else {
      toast('❌ No se pudo subir el avatar');
    }
  } finally {
    __isUploadingAvatar = false;

    // Limpiar URL temporal
    if (localUrl) {
      setTimeout(() => {
        try {
          URL.revokeObjectURL(localUrl);
        } catch (err) {
          console.warn('Error revocando URL:', err);
        }
      }, 1500);
    }
  }
});

/**
 * Configura los event listeners al cargar la página
 */
function setupEventListeners() {
  // Avatar: click en imagen o en botón de editar
  document.getElementById('avatar').addEventListener('click', openAvatarPicker);
  document.getElementById('btnEditAvatar').addEventListener('click', openAvatarPicker);

  // Toggle mostrar/ocultar email
  document.getElementById('btnToggleEmail').addEventListener('click', () => {
    __emailShown = !__emailShown;
    renderEmail();
  });

  // Editar nombre
  document.getElementById('btnEditName').addEventListener('click', () => {
    const user = window.auth?.currentUser;
    if (user) editName(user);
  });

  // Resetear contraseña
  document.getElementById('btnResetPassword').addEventListener('click', () => {
    const user = window.auth?.currentUser;
    if (user) resetPassword(user);
  });

  // Cerrar sesión
  document.getElementById('btnLogout').addEventListener('click', logout);
}

/* ============================================ */
/* INICIALIZACIÓN */
/* ============================================ */

// Iniciar cuando la página esté cargada
window.addEventListener('load', () => {
  setupEventListeners();
  checkAuth();
});
