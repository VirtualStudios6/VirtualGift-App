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
/* AUTENTICACIÓN */
/* ============================================ */

/**
 * Verifica la autenticación del usuario y carga datos iniciales
 */
function checkAuth() {
  waitForFirebase(() => {
    firebase.auth().onAuthStateChanged((user) => {
      if (!user) { window.location.href = withAppFlag('index.html'); return; }
      if (!user.emailVerified && user.providerData?.[0]?.providerId === 'password') {
        window.location.href = withAppFlag('verify-pending.html'); return;
      }
    });
  });
}

/* ============================================ */
/* LOGO → VOLVER AL INICIO (FIX DEFINITIVO) */
/* ============================================ */

checkAuth();

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
