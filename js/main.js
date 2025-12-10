// ==================== CONFIGURACIÓN ====================
const CONFIG = {
  NOTIFICATION_DURATION: 3500,
  PASSWORD_MIN_LENGTH: 8,
  INITIAL_USER_POINTS: 100,
  INITIAL_USER_LEVEL: 1,
  INITIAL_USER_EXPERIENCE: 0,
  NEXT_LEVEL_THRESHOLD: 200
};

// ==================== ESTADO GLOBAL ====================
const State = {
  isLoading: false,
  setLoading(loading) {
    this.isLoading = loading;
    const buttons = ['login-btn', 'register-btn', 'send-recovery-email', 'google-login', 'facebook-login'];
    buttons.forEach(btnId => {
      const btn = document.getElementById(btnId);
      if (btn) {
        btn.disabled = loading;
        if (loading) {
          if (btnId === 'google-login') {
            btn.innerHTML = 'Conectando...';
          } else if (btnId === 'facebook-login') {
            btn.innerHTML = '<svg class="social-icon" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg> Conectando...';
          }
        } else {
          if (btnId === 'google-login') {
            btn.innerHTML = '<svg class="social-icon" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> Continuar con Google';
          } else if (btnId === 'facebook-login') {
            btn.innerHTML = '<svg class="social-icon" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg> Continuar con Facebook';
          }
        }
      }
    });
  }
};

// ==================== NOTIFICACIONES ====================
const NotificationManager = {
  show(message, type = 'success') {
    const notification = document.getElementById('notification');
    if (!notification) return;

    notification.textContent = message;
    notification.className = `notification show ${type}`;

    setTimeout(() => {
      notification.classList.remove('show');
    }, CONFIG.NOTIFICATION_DURATION);
  }
};

// ==================== MANEJO DE FORMULARIOS ====================
const FormManager = {
  init() {
    // Mostrar formulario de login por defecto
    this.showForm('login-form');

    // Event listeners para cambiar entre formularios
    document.getElementById('show-register').addEventListener('click', (e) => {
      e.preventDefault();
      this.showForm('register-form');
    });

    document.getElementById('show-login').addEventListener('click', (e) => {
      e.preventDefault();
      this.showForm('login-form');
    });

    // Event listener para recuperar contraseña
    document.getElementById('forgot-password').addEventListener('click', (e) => {
      e.preventDefault();
      this.showRecoveryForm();
    });

    // Event listener para cancelar recuperación
    document.getElementById('cancel-recovery').addEventListener('click', (e) => {
      e.preventDefault();
      this.hideRecoveryForm();
    });

    // Event listener para overlay de recuperación
    document.getElementById('recovery-overlay').addEventListener('click', () => {
      this.hideRecoveryForm();
    });

    // Event listener para enviar correo de recuperación
    document.getElementById('send-recovery-email').addEventListener('click', () => {
      this.sendRecoveryEmail();
    });

    // Event listeners para los botones de login y registro
    document.getElementById('login-btn').addEventListener('click', () => {
      this.handleLogin();
    });

    document.getElementById('register-btn').addEventListener('click', () => {
      this.handleRegistration();
    });

    // Validación de contraseña en tiempo real
    document.getElementById('password').addEventListener('input', (e) => {
      this.checkPasswordStrength(e.target.value);
    });
  },

  showForm(formId) {
    // Ocultar todos los formularios
    document.querySelectorAll('.form').forEach(form => {
      form.classList.remove('active');
    });

    // Mostrar el formulario seleccionado
    document.getElementById(formId).classList.add('active');

    // Ocultar formulario de recuperación si está visible
    this.hideRecoveryForm();
  },

  showRecoveryForm() {
    document.getElementById('recovery-container').classList.add('show');
    document.getElementById('recovery-overlay').classList.add('show');
  },

  hideRecoveryForm() {
    document.getElementById('recovery-container').classList.remove('show');
    document.getElementById('recovery-overlay').classList.remove('show');
    document.getElementById('recovery-email').value = '';
  },

  async sendRecoveryEmail() {
    const email = document.getElementById('recovery-email').value.trim();

    if (!email) {
      NotificationManager.show('Por favor, ingresa tu correo electrónico', 'error');
      return;
    }

    if (!this.isValidEmail(email)) {
      NotificationManager.show('Por favor, ingresa un correo válido', 'error');
      return;
    }

    State.setLoading(true);

    try {
      await firebase.auth().sendPasswordResetEmail(email);
      NotificationManager.show('Se ha enviado un enlace de recuperación a tu correo', 'success');
      this.hideRecoveryForm();
    } catch (error) {
      console.error('Error al enviar correo de recuperación:', error);
      NotificationManager.show('Error al enviar el correo: ' + error.message, 'error');
    }

    State.setLoading(false);
  },

  async handleLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
      NotificationManager.show('Por favor, completa todos los campos', 'error');
      return;
    }

    if (!this.isValidEmail(email)) {
      NotificationManager.show('Por favor, ingresa un correo válido', 'error');
      return;
    }

    State.setLoading(true);

    try {
      const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
      const user = userCredential.user;
      
      if (!user.emailVerified) {
        NotificationManager.show('Verifica tu email antes de continuar', 'error');
        await firebase.auth().signOut();
        State.setLoading(false);
        return;
      }

      // Actualizar último login
      await firebase.firestore().collection('users').doc(user.uid).update({
        lastLogin: firebase.firestore.FieldValue.serverTimestamp()
      });

      NotificationManager.show('¡Inicio de sesión exitoso!', 'success');
      localStorage.setItem('vg_logged', '1');
      
      // Redirigir a welcome.html después de login exitoso
      setTimeout(() => {
        window.location.href = 'welcome.html';
      }, 1200);

    } catch (error) {
      console.error('Error al iniciar sesión:', error);

      let errorMessage = 'Error al iniciar sesión';
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No existe una cuenta con este correo';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Contraseña incorrecta';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Correo electrónico inválido';
      }

      NotificationManager.show(errorMessage, 'error');
    }

    State.setLoading(false);
  },

  async handleRegistration() {
    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const termsAccepted = document.getElementById('terms').checked;

    // Validaciones
    if (!username || !email || !password || !confirmPassword) {
      NotificationManager.show('Por favor, completa todos los campos', 'error');
      return;
    }

    if (!this.isValidEmail(email)) {
      NotificationManager.show('Por favor, ingresa un correo válido', 'error');
      return;
    }

    if (password.length < CONFIG.PASSWORD_MIN_LENGTH) {
      NotificationManager.show(`La contraseña debe tener al menos ${CONFIG.PASSWORD_MIN_LENGTH} caracteres`, 'error');
      return;
    }

    if (password !== confirmPassword) {
      NotificationManager.show('Las contraseñas no coinciden', 'error');
      return;
    }

    if (!termsAccepted) {
      NotificationManager.show('Debes aceptar los términos y condiciones', 'error');
      return;
    }

    State.setLoading(true);

    try {
      // Crear usuario en Firebase Auth
      const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;

      // Actualizar perfil con el nombre de usuario
      await user.updateProfile({
        displayName: username
      });

      // Guardar información adicional en Firestore
      await firebase.firestore().collection('users').doc(user.uid).set({
        username: username,
        email: email,
        points: CONFIG.INITIAL_USER_POINTS,
        level: CONFIG.INITIAL_USER_LEVEL,
        experience: CONFIG.INITIAL_USER_EXPERIENCE,
        nextLevel: CONFIG.NEXT_LEVEL_THRESHOLD,
        joinDate: firebase.firestore.FieldValue.serverTimestamp(),
        lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
        emailVerified: false,
        loginMethod: 'email'
      });

      // Enviar correo de verificación
      await user.sendEmailVerification();

      NotificationManager.show('¡Cuenta creada exitosamente! Se ha enviado un correo de verificación', 'success');

      // Por seguridad, cerrar sesión hasta que verifique el correo
      await firebase.auth().signOut();

      // Cambiar a formulario de login
      setTimeout(() => {
        this.showForm('login-form');
      }, 2000);

    } catch (error) {
      console.error('Error al registrar usuario:', error);

      let errorMessage = 'Error al crear la cuenta';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Ya existe una cuenta con este correo';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'La contraseña es demasiado débil';
      }

      NotificationManager.show(errorMessage, 'error');
    }

    State.setLoading(false);
  },

  checkPasswordStrength(password) {
    const strengthBar = document.getElementById('password-strength-bar');
    let strength = 0;

    if (password.length >= CONFIG.PASSWORD_MIN_LENGTH) strength += 25;
    if (/[a-z]/.test(password)) strength += 25;
    if (/[A-Z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password)) strength += 25;

    strengthBar.style.width = strength + '%';

    if (strength < 50) {
      strengthBar.style.backgroundColor = '#ef4444'; // Rojo
    } else if (strength < 75) {
      strengthBar.style.backgroundColor = '#f59e0b'; // Amarillo
    } else {
      strengthBar.style.backgroundColor = '#10b981'; // Verde
    }
  },

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
};

// ==================== GOOGLE SIGN-IN ====================
const GoogleAuth = {
  async initiateLogin() {
    if (State.isLoading) return;
    State.setLoading(true);

    const provider = new firebase.auth.GoogleAuthProvider();

    try {
      const result = await firebase.auth().signInWithPopup(provider);
      const user = result.user;

      // Verificar si el usuario ya existe en Firestore
      const userRef = firebase.firestore().collection('users').doc(user.uid);
      const doc = await userRef.get();

      if (!doc.exists) {
        // Crear nuevo usuario en Firestore
        await userRef.set({
          username: user.displayName || 'Usuario',
          email: user.email,
          points: CONFIG.INITIAL_USER_POINTS,
          level: CONFIG.INITIAL_USER_LEVEL,
          experience: CONFIG.INITIAL_USER_EXPERIENCE,
          nextLevel: CONFIG.NEXT_LEVEL_THRESHOLD,
          joinDate: firebase.firestore.FieldValue.serverTimestamp(),
          lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
          emailVerified: user.emailVerified,
          loginMethod: 'google',
          photoURL: user.photoURL
        });
      } else {
        // Actualizar último login
        await userRef.update({
          lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        });
      }

      NotificationManager.show(`¡Bienvenido, ${user.displayName || 'Gamer'}!`, 'success');
      localStorage.setItem('vg_logged', '1');

      setTimeout(() => {
        window.location.href = 'welcome.html';
      }, 1200);

    } catch (error) {
      console.error('Error Google Sign-In:', error);
      
      let errorMessage = 'Error al conectar con Google';
      if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Ventana de autenticación cerrada';
      } else if (error.code === 'auth/cancelled-popup-request') {
        errorMessage = 'Solicitud cancelada';
      } else if (error.code === 'auth/account-exists-with-different-credential') {
        errorMessage = 'Ya existe una cuenta con este correo';
      }

      NotificationManager.show(errorMessage, 'error');
    } finally {
      State.setLoading(false);
    }
  }
};

// ==================== FACEBOOK SIGN-IN ====================
const FacebookAuth = {
  async initiateLogin() {
    if (State.isLoading) return;
    State.setLoading(true);

    const provider = new firebase.auth.FacebookAuthProvider();

    try {
      const result = await firebase.auth().signInWithPopup(provider);
      const user = result.user;

      // Verificar si el usuario ya existe en Firestore
      const userRef = firebase.firestore().collection('users').doc(user.uid);
      const doc = await userRef.get();

      if (!doc.exists) {
        // Crear nuevo usuario en Firestore
        await userRef.set({
          username: user.displayName || 'Usuario',
          email: user.email || '',
          points: CONFIG.INITIAL_USER_POINTS,
          level: CONFIG.INITIAL_USER_LEVEL,
          experience: CONFIG.INITIAL_USER_EXPERIENCE,
          nextLevel: CONFIG.NEXT_LEVEL_THRESHOLD,
          joinDate: firebase.firestore.FieldValue.serverTimestamp(),
          lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
          emailVerified: user.emailVerified,
          loginMethod: 'facebook',
          photoURL: user.photoURL
        });
      } else {
        // Actualizar último login
        await userRef.update({
          lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        });
      }

      NotificationManager.show(`¡Bienvenido, ${user.displayName || 'Gamer'}!`, 'success');
      localStorage.setItem('vg_logged', '1');

      setTimeout(() => {
        window.location.href = 'welcome.html';
      }, 1200);

    } catch (error) {
      console.error('Error Facebook Sign-In:', error);
      
      let errorMessage = 'Error al conectar con Facebook';
      if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Ventana de autenticación cerrada';
      } else if (error.code === 'auth/cancelled-popup-request') {
        errorMessage = 'Solicitud cancelada';
      } else if (error.code === 'auth/account-exists-with-different-credential') {
        errorMessage = 'Ya existe una cuenta con este correo';
      }

      NotificationManager.show(errorMessage, 'error');
    } finally {
      State.setLoading(false);
    }
  }
};

// ==================== MANEJO DE SESIÓN ====================
const SessionManager = {
  init() {
    // Verificar si ya hay sesión activa
    if (localStorage.getItem('vg_logged') === '1') {
      firebase.auth().onAuthStateChanged((user) => {
        if (user && window.location.pathname.includes('index.html')) {
          window.location.href = 'welcome.html';
        }
      });
    }

    // Observador de sesión
    firebase.auth().onAuthStateChanged((user) => {
      if (user) {
        localStorage.setItem('vg_logged', '1');
      } else {
        localStorage.removeItem('vg_logged');
      }
    });
  }
};

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', function() {
  // Configuración inicial
  document.documentElement.style.backgroundColor = '#020515';
  document.body.style.backgroundColor = '#020515';

  // Inicializar el manejo de sesión
  SessionManager.init();

  // Inicializar el manejo de formularios
  FormManager.init();

  // Event listener para Google
  const googleBtn = document.getElementById('google-login');
  if (googleBtn) {
    googleBtn.addEventListener('click', () => GoogleAuth.initiateLogin());
  }

  // Event listener para Facebook
  const facebookBtn = document.getElementById('facebook-login');
  if (facebookBtn) {
    facebookBtn.addEventListener('click', () => FacebookAuth.initiateLogin());
  }

  console.log('Auth system initialized successfully');
});

// ==================== FUNCIÓN DE LOGOUT (HELPER) ====================
function vgSignOut() {
  firebase.auth().signOut()
    .then(() => {
      localStorage.removeItem('vg_logged');
      window.location.href = 'index.html';
    })
    .catch((error) => {
      console.error('Error al cerrar sesión:', error);
    });
}