// ==================== FIREBASE CONFIGURATION (ROBUSTA 10/10) ====================
// - Espera a que las librerías firebase carguen
// - Inicializa 1 sola vez
// - Expone window.auth / window.db / window.storage
// - Expone waitForFirebase(callback) y waitForFirebaseStorage(callback)
// ===============================================================================

const firebaseConfig = {
  apiKey: "AIzaSyDFn7fJPpOzuyiBKBXh7Lm8pHN6TwY8K-g",
  authDomain: "virtualgift-login.firebaseapp.com",
  projectId: "virtualgift-login",

  // ✅ Bucket REAL (según tu Firebase Console)
  storageBucket: "virtualgift-login.firebasestorage.app",

  messagingSenderId: "807245369735",
  appId: "1:807245369735:web:b52a8412bfb23c8ad28322",
  measurementId: "G-LF2SDF6J90"
};

(function initFirebaseRobust() {
  const MAX_ATTEMPTS = 140; // 140 * 50ms = 7s
  const INTERVAL_MS = 50;

  let attempts = 0;

  function libsReadyBase() {
    return typeof window.firebase !== "undefined"
      && typeof window.firebase.initializeApp === "function"
      && typeof window.firebase.auth === "function"
      && typeof window.firebase.firestore === "function";
  }

  function libsReadyStorage() {
    return typeof window.firebase !== "undefined"
      && typeof window.firebase.storage === "function";
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

      // Storage es opcional (solo si firebase-storage.js está cargado)
      const storage = libsReadyStorage() ? firebase.storage() : null;

      // 3) Persistencia (no bloquea la app)
      auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .then(() => console.log("✅ Persistencia LOCAL configurada"))
        .catch((e) => console.warn("⚠️ Persistencia no se pudo establecer:", e?.message || e));

      // Idioma
      if (typeof auth.useDeviceLanguage === "function") auth.useDeviceLanguage();

      // 4) Exponer global
      window.firebaseApp = firebase.app();
      window.auth = auth;
      window.db = db;
      window.storage = storage; // puede ser null si no se cargó firebase-storage.js

      // 5) Flags
      window.__firebaseReady = true;
      window.__firebaseStorageReady = !!storage;

      console.log("📦 Firebase listo:", {
        auth: !!window.auth,
        firestore: !!window.db,
        storage: !!window.storage
      });

    } catch (err) {
      console.error("❌ Error inicializando Firebase:", err);
      window.__firebaseReady = false;
      window.__firebaseStorageReady = false;
    }
  }

  // ✅ Helper global: listo? (base)
  window.isFirebaseReady = function isFirebaseReady() {
    return !!(
      window.firebase
      && window.auth
      && window.db
      && typeof window.db.collection === "function"
    );
  };

  // ✅ Helper global: listo con storage?
  window.isFirebaseStorageReady = function isFirebaseStorageReady() {
    return !!(
      window.isFirebaseReady()
      && window.storage
      && typeof window.storage.ref === "function"
    );
  };

  // ✅ Esperar a firebase base
  window.waitForFirebase = function waitForFirebase(callback, maxAttempts = 120) {
    let i = 0;
    const t = setInterval(() => {
      i++;
      if (window.isFirebaseReady()) {
        clearInterval(t);
        callback();
      } else if (i >= maxAttempts) {
        clearInterval(t);
        console.error("❌ Timeout: Firebase base no está listo");
        callback(new Error("Firebase timeout"));
      }
    }, 100);
  };

  // ✅ Esperar a firebase + storage (ideal para Perfil)
  window.waitForFirebaseStorage = function waitForFirebaseStorage(callback, maxAttempts = 140) {
    let i = 0;
    const t = setInterval(() => {
      i++;
      if (window.isFirebaseStorageReady()) {
        clearInterval(t);
        callback();
      } else if (i >= maxAttempts) {
        clearInterval(t);
        console.error("❌ Timeout: Firebase Storage no está listo (¿cargaste firebase-storage.js?)");
        callback(new Error("Firebase Storage timeout"));
      }
    }, 100);
  };

  // 0) Esperar librerías base firebase
  const tick = setInterval(() => {
    attempts++;

    if (libsReadyBase()) {
      clearInterval(tick);
      boot();
      return;
    }

    if (attempts >= MAX_ATTEMPTS) {
      clearInterval(tick);
      console.error("❌ Firebase libs no cargaron a tiempo (firebase-app/auth/firestore).");
      window.__firebaseReady = false;
      window.__firebaseStorageReady = false;
    }
  }, INTERVAL_MS);

})();
