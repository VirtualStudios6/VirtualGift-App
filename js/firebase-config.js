// ==================== FIREBASE CONFIGURATION (ROBUSTA) ====================
// - Espera a que la librería firebase cargue
// - Inicializa 1 sola vez
// - Expone window.auth / window.db / window.storage
// - Expone waitForFirebase(callback)
// ==========================================================================

const firebaseConfig = {
  apiKey: "AIzaSyDFn7fJPpOzuyiBKBXh7Lm8pHN6TwY8K-g",
  authDomain: "virtualgift-login.firebaseapp.com",
  projectId: "virtualgift-login",
  storageBucket: "virtualgift-login.appspot.com",
  messagingSenderId: "807245369735",
  appId: "1:807245369735:web:b52a8412bfb23c8ad28322",
  measurementId: "G-LF2SDF6J90"
};

(function initFirebaseRobust() {
  const MAX_ATTEMPTS = 120; // 120 * 50ms = 6s
  const INTERVAL_MS = 50;

  let attempts = 0;

  function libsReady() {
    return typeof window.firebase !== "undefined"
      && typeof window.firebase.initializeApp === "function"
      && typeof window.firebase.auth === "function"
      && typeof window.firebase.firestore === "function";
  }

  function boot() {
    try {
      // 1) Init app (solo una vez)
      if (!firebase.apps || firebase.apps.length === 0) {
        firebase.initializeApp(firebaseConfig);
        console.log("✅ Firebase inicializado");
      } else {
        console.log("ℹ️ Firebase ya estaba inicializado");
      }

      // 2) Servicios
      const auth = firebase.auth();
      const db = firebase.firestore();

      // Storage puede no estar importado en algunas páginas (ej: inicio.html)
      const storage = (firebase.storage && typeof firebase.storage === "function")
        ? firebase.storage()
        : null;

      // 3) Persistencia
      auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .then(() => console.log("✅ Persistencia LOCAL configurada"))
        .catch((e) => console.warn("⚠️ Persistencia no se pudo establecer:", e?.message || e));

      // Idioma
      if (auth.useDeviceLanguage) auth.useDeviceLanguage();

      // 4) Exponer global
      window.firebaseApp = firebase.app();
      window.firebase = firebase;
      window.auth = auth;
      window.db = db;
      window.storage = storage; // puede ser null

      // 5) Flag de listo
      window.__firebaseReady = true;
      console.log("📦 Firebase listo:", {
        auth: !!window.auth,
        firestore: !!window.db,
        storage: !!window.storage
      });

    } catch (err) {
      console.error("❌ Error inicializando Firebase:", err);
      window.__firebaseReady = false;
    }
  }

  // Helper global: listo?
  window.isFirebaseReady = function isFirebaseReady() {
    return !!(window.firebase && window.auth && window.db && typeof window.db.collection === "function");
  };

  // Helper global: esperar a firebase
  window.waitForFirebase = function waitForFirebase(callback, maxAttempts = 120) {
    let i = 0;
    const t = setInterval(() => {
      i++;
      if (window.isFirebaseReady()) {
        clearInterval(t);
        callback();
      } else if (i >= maxAttempts) {
        clearInterval(t);
        console.error("❌ Timeout: Firebase no está listo");
        callback(new Error("Firebase timeout"));
      }
    }, 100);
  };

  // 0) Esperar librerías firebase
  const tick = setInterval(() => {
    attempts++;

    if (libsReady()) {
      clearInterval(tick);
      boot();
      return;
    }

    if (attempts >= MAX_ATTEMPTS) {
      clearInterval(tick);
      console.error("❌ Firebase libs no cargaron a tiempo (firebase-app/auth/firestore).");
      window.__firebaseReady = false;
    }
  }, INTERVAL_MS);

})();
