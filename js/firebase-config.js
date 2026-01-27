// ==================== FIREBASE CONFIGURATION ====================
// Configuración mejorada de Firebase con mejor manejo de errores
// ================================================================

const firebaseConfig = {
  apiKey: "AIzaSyDFn7fJPpOzuyiBKBXh7Lm8pHN6TwY8K-g",
  authDomain: "virtualgift-login.firebaseapp.com",
  projectId: "virtualgift-login",
  storageBucket: "virtualgift-login.firebasestorage.app",
  messagingSenderId: "807245369735",
  appId: "1:807245369735:web:b52a8412bfb23c8ad28322",
  measurementId: "G-LF2SDF6J90"
};

// Inicialización segura de Firebase
(function initFirebase() {
  try {
    // Verificar si Firebase ya está inicializado
    if (!firebase.apps || firebase.apps.length === 0) {
      firebase.initializeApp(firebaseConfig);
      console.log('✅ Firebase inicializado correctamente');
    } else {
      console.log('ℹ️ Firebase ya estaba inicializado');
    }
  } catch (error) {
    console.error('❌ Error al inicializar Firebase:', error);
    // Mostrar error al usuario
    setTimeout(() => {
      alert('Error al conectar con el servidor. Por favor, recarga la página.');
    }, 500);
    return;
  }

  try {
    // Obtener servicios de Firebase
    const auth = firebase.auth();
    const db = firebase.firestore();

    // Configurar persistencia de sesión LOCAL (se mantiene al cerrar el navegador)
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
      .then(() => {
        console.log('✅ Persistencia de sesión configurada');
      })
      .catch((error) => {
        console.warn('⚠️ No se pudo establecer persistencia:', error.message);
      });

    // Configurar idioma del dispositivo para emails
    if (auth.useDeviceLanguage) {
      auth.useDeviceLanguage();
    }

    // Exponer servicios globalmente para otros scripts
    window.firebaseApp = firebase.app();
    window.firebase = firebase;
    window.auth = auth;
    window.db = db;

    console.log('📦 Servicios Firebase disponibles:', {
      app: '✓',
      auth: '✓',
      firestore: '✓'
    });

  } catch (error) {
    console.error('❌ Error al configurar servicios Firebase:', error);
  }
})();

// Función helper para verificar si Firebase está listo
function isFirebaseReady() {
  return typeof firebase !== 'undefined' &&
         typeof firebase.auth === 'function' &&
         typeof firebase.firestore === 'function' &&
         window.auth !== undefined &&
         window.db !== undefined;
}

// Función helper para esperar a que Firebase esté listo
function waitForFirebase(callback, maxAttempts = 60) {
  let attempts = 0;
  const checkInterval = setInterval(() => {
    attempts++;

    if (isFirebaseReady()) {
      clearInterval(checkInterval);
      console.log('✅ Firebase está listo para usar');
      callback();
    } else if (attempts >= maxAttempts) {
      clearInterval(checkInterval);
      console.error('❌ Timeout: Firebase no se cargó correctamente');
      alert('Error al cargar servicios. Por favor, recarga la página.');
    }
  }, 100);
}

// Exponer funciones helper globalmente
window.isFirebaseReady = isFirebaseReady;
window.waitForFirebase = waitForFirebase;
