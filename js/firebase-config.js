// firebase-config.js
// ==================
// Config de Firebase (usa tus propios valores)
const firebaseConfig = {
  apiKey: "AIzaSyDFn7fJPpOzuyiBKBXh7Lm8pHN6TwY8K-g",
  authDomain: "virtualgift-login.firebaseapp.com",
  projectId: "virtualgift-login",
  storageBucket: "virtualgift-login.firebasestorage.app",
  messagingSenderId: "807245369735",
  appId: "1:807245369735:web:b52a8412bfb23c8ad28322",
  measurementId: "G-LF2SDF6J90"
};

// Inicialización segura (evita doble init si cargas este archivo en varias páginas)
(function initFirebase() {
  try {
    if (!firebase.apps || firebase.apps.length === 0) {
      firebase.initializeApp(firebaseConfig); // v8 y v9-compat friendly
    }
  } catch (e) {
    // En caso de que algún script ya lo haya inicializado
    console.warn('Firebase ya estaba inicializado:', e?.message || e);
  }

  // Servicios
  const auth = firebase.auth();
  const db   = firebase.firestore();

  // Persistencia de sesión LOCAL (se mantiene tras cerrar la app)
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .catch((e) => console.warn('No se pudo establecer persistencia LOCAL:', e?.message || e));

  // Idioma del dispositivo para emails/avisos
  auth.useDeviceLanguage?.();

  // Exponer de forma global para otros scripts (auth.js / welcome.js)
  window.firebaseApp = firebase.app();
  window.firebase    = firebase; // por si algún script espera el global
  window.auth        = auth;
  window.db          = db;

  // (Opcional) logs útiles
  console.log('[Firebase] init OK:', window.firebaseApp?.name, ' project:', firebaseConfig.projectId);
})();
