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
          const originalText = btn.textContent;
          btn.setAttribute('data-original-text', originalText);
          btn.textContent = 'Conectando...';
        } else {
          const originalText = btn.getAttribute('data-original-text');
          if (originalText) {
            btn.textContent = originalText;
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
    this.showForm('login-form');

    document.getElementById('show-register')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.showForm('register-form');
    });

    document.getElementById('show-login')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.showForm('login-form');
    });

    document.getElementById('forgot-password')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.showRecoveryForm();
    });

    document.getElementById('cancel-recovery')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.hideRecoveryForm();
    });

    document.getElementById('recovery-overlay')?.addEventListener('click', () => {
      this.hideRecoveryForm();
    });

    document.getElementById('send-recovery-email')?.addEventListener('click', () => {
      this.sendRecoveryEmail();
    });

    document.getElementById('login-btn')?.addEventListener('click', () => {
      this.handleLogin();
    });

    document.getElementById('register-btn')?.addEventListener('click', () => {
      this.handleRegistration();
    });

    document.getElementById('password')?.addEventListener('input', (e) => {
      this.checkPasswordStrength(e.target.value);
    });
  },

  showForm(formId) {
    document.querySelectorAll('.form').forEach(form => {
      form.classList.remove('active');
    });

    document.getElementById(formId)?.classList.add('active');
    this.hideRecoveryForm();
  },

  showRecoveryForm() {
    document.getElementById('recovery-container')?.classList.add('show');
    document.getElementById('recovery-overlay')?.classList.add('show');
  },

  hideRecoveryForm() {
    document.getElementById('recovery-container')?.classList.remove('show');
    document.getElementById('recovery-overlay')?.classList.remove('show');
    const recoveryEmail = document.getElementById('recovery-email');
    if (recoveryEmail) recoveryEmail.value = '';
  },

  async sendRecoveryEmail() {
    const email = document.getElementById('recovery-email')?.value.trim();

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
    const email = document.getElementById('login-email')?.value.trim();
    const password = document.getElementById('login-password')?.value;

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

      await firebase.firestore().collection('users').doc(user.uid).update({
        lastLogin: firebase.firestore.FieldValue.serverTimestamp()
      });

      NotificationManager.show('¡Inicio de sesión exitoso!', 'success');
      localStorage.setItem('vg_logged', '1');

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
    const username = document.getElementById('username')?.value.trim();
    const email = document.getElementById('email')?.value.trim();
    const password = document.getElementById('password')?.value;
    const confirmPassword = document.getElementById('confirm-password')?.value;
    const termsAccepted = document.getElementById('terms')?.checked;

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
      const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;

      await user.updateProfile({
        displayName: username
      });

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

      await user.sendEmailVerification();

      NotificationManager.show('¡Cuenta creada exitosamente! Se ha enviado un correo de verificación', 'success');

      await firebase.auth().signOut();

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
    if (!strengthBar) return;

    let strength = 0;

    if (password.length >= CONFIG.PASSWORD_MIN_LENGTH) strength += 25;
    if (/[a-z]/.test(password)) strength += 25;
    if (/[A-Z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password)) strength += 25;

    strengthBar.style.width = strength + '%';

    if (strength < 50) {
      strengthBar.style.backgroundColor = '#ef4444';
    } else if (strength < 75) {
      strengthBar.style.backgroundColor = '#f59e0b';
    } else {
      strengthBar.style.backgroundColor = '#10b981';
    }
  },

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
};

// ==================== GOOGLE SIGN-IN (REDIRECT) ====================
const GoogleAuth = {
  async initiateLogin() {
    if (State.isLoading) return;
    State.setLoading(true);

    NotificationManager.show('Conectando con Google...', 'info');

    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');

    try {
      // Usar signInWithRedirect en lugar de popup (compatible con WebView)
      await firebase.auth().signInWithRedirect(provider);
    } catch (error) {
      console.error('Error Google Sign-In:', error);
      NotificationManager.show('Error al conectar con Google', 'error');
      State.setLoading(false);
    }
  },

  async handleRedirectResult() {
    try {
      const result = await firebase.auth().getRedirectResult();

      if (result.user) {
        const user = result.user;

        const userRef = firebase.firestore().collection('users').doc(user.uid);
        const doc = await userRef.get();

        if (!doc.exists) {
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
          await userRef.update({
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
          });
        }

        NotificationManager.show(`¡Bienvenido, ${user.displayName || 'Gamer'}!`, 'success');
        localStorage.setItem('vg_logged', '1');

        setTimeout(() => {
          window.location.href = 'welcome.html';
        }, 1200);
      }
    } catch (error) {
      if (error.code && error.code !== 'auth/popup-closed-by-user') {
        console.error('Error en redirect de Google:', error);
        NotificationManager.show('Error al autenticar con Google', 'error');
      }
    }
  }
};

// ==================== FACEBOOK SIGN-IN (REDIRECT) ====================
const FacebookAuth = {
  async initiateLogin() {
    if (State.isLoading) return;
    State.setLoading(true);

    NotificationManager.show('Conectando con Facebook...', 'info');

    const provider = new firebase.auth.FacebookAuthProvider();

    try {
      // Usar signInWithRedirect en lugar de popup (compatible con WebView)
      await firebase.auth().signInWithRedirect(provider);
    } catch (error) {
      console.error('Error Facebook Sign-In:', error);
      NotificationManager.show('Error al conectar con Facebook', 'error');
      State.setLoading(false);
    }
  },

  async handleRedirectResult() {
    try {
      const result = await firebase.auth().getRedirectResult();

      if (result.user && result.credential && result.credential.providerId === 'facebook.com') {
        const user = result.user;

        const userRef = firebase.firestore().collection('users').doc(user.uid);
        const doc = await userRef.get();

        if (!doc.exists) {
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
          await userRef.update({
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
          });
        }

        NotificationManager.show(`¡Bienvenido, ${user.displayName || 'Gamer'}!`, 'success');
        localStorage.setItem('vg_logged', '1');

        setTimeout(() => {
          window.location.href = 'welcome.html';
        }, 1200);
      }
    } catch (error) {
      if (error.code && error.code !== 'auth/popup-closed-by-user') {
        console.error('Error en redirect de Facebook:', error);
        NotificationManager.show('Error al autenticar con Facebook', 'error');
      }
    }
  }
};

// ==================== MANEJO DE SESIÓN ====================
const SessionManager = {
  init() {
    if (localStorage.getItem('vg_logged') === '1') {
      firebase.auth().onAuthStateChanged((user) => {
        if (user && (window.location.pathname.includes('index.html') || window.location.pathname === '/')) {
          window.location.href = 'welcome.html';
        }
      });
    }

    firebase.auth().onAuthStateChanged((user) => {
      if (user) {
        localStorage.setItem('vg_logged', '1');
      } else {
        localStorage.removeItem('vg_logged');
      }
    });

    // Manejar resultado de redirect de Google y Facebook
    GoogleAuth.handleRedirectResult();
    FacebookAuth.handleRedirectResult();
  }
};

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', function() {
  document.documentElement.style.backgroundColor = '#020515';
  document.body.style.backgroundColor = '#020515';

  SessionManager.init();
  FormManager.init();

  const googleBtn = document.getElementById('google-login');
  if (googleBtn) {
    googleBtn.addEventListener('click', () => GoogleAuth.initiateLogin());
  }

  const facebookBtn = document.getElementById('facebook-login');
  if (facebookBtn) {
    facebookBtn.addEventListener('click', () => FacebookAuth.initiateLogin());
  }

  console.log('Auth system initialized successfully');
});

// ==================== FUNCIÓN DE LOGOUT ====================
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
