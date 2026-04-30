/* ============================================ */
/* GESTIÓN DE NOTIFICACIONES */
/* ============================================ */

/* ============================================ */
/* VERIFICACIÓN DE FIREBASE */
/* ============================================ */

/**
 * Verifica si Firebase está completamente inicializado
 * @returns {boolean} True si Firebase está listo
 */
function isFirebaseReady() {
  return typeof firebase !== 'undefined'
    && typeof firebase.auth === 'function'
    && typeof firebase.firestore === 'function';
}

/**
 * Espera a que Firebase esté listo antes de ejecutar el callback
 * @param {Function} callback - Función a ejecutar cuando Firebase esté listo
 * @param {number} maxAttempts - Número máximo de intentos (default: 30)
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
      console.error('Firebase timeout - redirigiendo a login');
      window.location.href = withAppFlag('index.html');
    }
  }, 100);
}

/* ============================================ */
/* GESTIÓN DE NOTIFICACIONES */
/* ============================================ */

/**
 * Actualiza el badge visual de notificaciones
 * @param {number} count - Número de notificaciones
 */
function updateBadge(count) {
  const badge = document.getElementById('notificationBadge');
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  }
}

/**
 * Inicia el listener en tiempo real del badge de notificaciones
 * @param {Object} user - Usuario autenticado de Firebase
 */
let _unsubNotifCount = null;

function stopNotifCount() {
  if (_unsubNotifCount) { _unsubNotifCount(); _unsubNotifCount = null; }
}

function loadNotificationCount(user) {
  if (!isFirebaseReady()) return;
  stopNotifCount();
  _unsubNotifCount = firebase.firestore()
    .collection('notifications')
    .where('userId', 'in', [user.uid, 'ALL'])
    .orderBy('timestamp', 'desc')
    .limit(50)
    .onSnapshot(
      (snapshot) => {
        let hidden = new Set();
        try { hidden = new Set(JSON.parse(localStorage.getItem(`vg_notifs_hidden_${user.uid}`) || '[]')); } catch {}
        const unread = snapshot.docs.filter(doc => !doc.data().read && !hidden.has(doc.id)).length;
        updateBadge(unread);
      },
      (err) => { console.warn('Error en listener de notificaciones:', err); }
    );
}

/* ============================================ */
/* AUTENTICACIÓN */
/* ============================================ */

/**
 * Verifica la autenticación del usuario y carga datos iniciales
 */
function checkAuth() {
  waitForFirebase(() => {
    firebase.auth().onAuthStateChanged((user) => {
      if (!user) { stopNotifCount(); window.location.href = withAppFlag('index.html'); return; }
      if (!user.emailVerified && user.providerData?.[0]?.providerId === 'password') {
        stopNotifCount(); window.location.href = withAppFlag('verify-pending.html'); return;
      }
      loadNotificationCount(user);
    });
  });
}

/* ============================================ */
/* LOGO → VOLVER AL INICIO (FIX DEFINITIVO) */
/* ============================================ */

checkAuth();

window.addEventListener('beforeunload', stopNotifCount);
window.addEventListener('pagehide', stopNotifCount);

document.addEventListener('DOMContentLoaded', () => {
  const logo = document.getElementById('appLogo');
  if (!logo) return;

  logo.addEventListener('click', () => {
    const currentPath = window.location.pathname.toLowerCase();

    // Si estamos en inicio
    if (currentPath.includes("inicio")) {
      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    } else {
      // Si estamos en cualquier otra página
      window.location.href = withAppFlag("inicio.html");
    }
  });
});
