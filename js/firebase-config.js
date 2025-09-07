// Configuración de Firebase - ¡REMPLAZA CON TUS PROPIOS DATOS!
const firebaseConfig = {
  apiKey: "AIzaSyDFn7fJPpOzuyiBKBXh7Lm8pHN6TwY8K-g",
  authDomain: "virtualgift-login.firebaseapp.com",
  projectId: "virtualgift-login",
  storageBucket: "virtualgift-login.firebasestorage.app",
  messagingSenderId: "807245369735",
  appId: "1:807245369735:web:b52a8412bfb23c8ad28322",
  measurementId: "G-LF2SDF6J90"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Inicializar servicios de Firebase
const auth = firebase.auth();
const db = firebase.firestore();