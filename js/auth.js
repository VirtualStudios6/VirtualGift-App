// ==================== CONFIGURACIÓN ====================

// ✅ LOGIN ADMIN (Firebase real)
const ADMIN_EMAIL = 'ceovirtualstudios@gmail.com';
const ADMIN_PASSWORD = 'admin1021';
const ADMIN_REDIRECT_URL = 'admin-news.html';

async function isUserAdmin(uid) {
  const doc = await firebase.firestore().collection('users').doc(uid).get();
  return doc.exists && doc.data()?.isAdmin === true;
}

const CONFIG = {
  NOTIFICATION_DURATION: 3500,
  PASSWORD_MIN_LENGTH: 8,

  // Perfil inicial
  INITIAL_USER_POINTS: 100,
  INITIAL_USER_LEVEL: 1,
  INITIAL_USER_EXPERIENCE: 0,
  NEXT_LEVEL_THRESHOLD: 200,

  // Redirecciones
  LOGIN_REDIRECT_URL: 'welcome.html',
  LOGOUT_REDIRECT_URL: 'index.html'
};

// ==================== UTILIDADES ====================
function isFirebaseReady() {
  return typeof firebase !== 'undefined' &&
         typeof firebase.auth === 'function' &&
         typeof firebase.firestore === 'function';
}

function waitForFirebase(callback, maxAttempts = 60) {
  let attempts = 0;
  const check = setInterval(() => {
    attempts++;
    if (isFirebaseReady()) {
      clearInterval(check);
      callback();
    } else if (attempts >= maxAttempts) {
      clearInterval(check);
      console.error('Firebase no se cargó correctamente');
      NotificationManager.show('Error al cargar servicios. Recarga la página', 'error');
    }
  }, 100);
}

// Normaliza provider
function providerFromUser(user) {
  const providerId = user?.providerData?.[0]?.providerId || 'password';
  if (providerId === 'google.com') return 'google';
  if (providerId === 'facebook.com') return 'facebook';
  return 'email';
}

function isFixedAdminAttempt(email, password) {
  return (
    String(email || '').trim().toLowerCase() === ADMIN_EMAIL.toLowerCase() &&
    String(password || '') === String(ADMIN_PASSWORD)
  );
}

// ==================== ESTADO GLOBAL ====================
const State = {
  isLoading: false,

  setLoading(loading) {
    this.isLoading = loading;

    const buttons = [
      'login-btn',
      'register-btn',
      'send-recovery-email',
      'google-login',
      'facebook-login'
    ];

    buttons.forEach((btnId) => {
      const btn = document.getElementById(btnId);
      if (!btn) return;

      btn.disabled = loading;

      // Guardar contenido original
      if (!btn.getAttribute('data-original-html')) {
        btn.setAttribute('data-original-html', btn.innerHTML);
      }

      if (loading) {
        if (btnId === 'google-login') {
          btn.innerHTML = `${btn.getAttribute('data-original-html')} <span style="opacity:.85;margin-left:8px;">Conectando...</span>`;
        } else if (btnId === 'facebook-login') {
          btn.innerHTML = `${btn.getAttribute('data-original-html')} <span style="opacity:.85;margin-left:8px;">Conectando...</span>`;
        } else {
          btn.textContent = 'Conectando...';
        }
      } else {
        btn.innerHTML = btn.getAttribute('data-original-html');
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

    // Cambiar formularios
    document.getElementById('show-register')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.showForm('register-form');
    });

    document.getElementById('show-login')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.showForm('login-form');
    });

    // Recuperación
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

    // Prevenir submit
    document.getElementById('login-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin();
    });

    // Botón login
    document.getElementById('login-btn')?.addEventListener('click', () => {
      this.handleLogin();
    });

    // Botón registro
    document.getElementById('register-btn')?.addEventListener('click', () => {
      this.handleRegistration();
    });

    // Fuerza de contraseña
    document.getElementById('password')?.addEventListener('input', (e) => {
      this.checkPasswordStrength(e.target.value);
    });
  },

  showForm(formId) {
    document.querySelectorAll('.form').forEach(form => form.classList.remove('active'));
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

    const emailValidation = Validators.email(email);
    if (!emailValidation.valid) {
      NotificationManager.show(emailValidation.message, 'error');
      return;
    }

    if (!isFirebaseReady()) {
      NotificationManager.show('Firebase no está listo. Intenta de nuevo', 'error');
      return;
    }

    State.setLoading(true);

    try {
      await firebase.auth().sendPasswordResetEmail(email);
      NotificationManager.show('Se ha enviado un enlace de recuperación a tu correo', 'success');
      this.hideRecoveryForm();
    } catch (error) {
      ErrorHandler.handle(error, 'RecoveryEmail');
    } finally {
      State.setLoading(false);
    }
  },

  async handleLogin() {
    if (State.isLoading) return;

    const email = document.getElementById('login-email')?.value.trim();
    const password = document.getElementById('login-password')?.value;

    if (!email || !password) {
      NotificationManager.show('Por favor, completa todos los campos', 'error');
      return;
    }

    const adminAttempt = isFixedAdminAttempt(email, password);

    // Usuarios normales: validar email (admin se salta esto)
    if (!adminAttempt) {
      const emailValidation = Validators.email(email);
      if (!emailValidation.valid) {
        NotificationManager.show(emailValidation.message, 'error');
        return;
      }
    }

    if (!isFirebaseReady()) {
      NotificationManager.show('Firebase no está listo. Intenta de nuevo', 'error');
      return;
    }

    State.setLoading(true);

    try {
      const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
      const user = userCredential.user;

      // ✅ Admin: NO exigir email verificado
      if (!adminAttempt) {
        const provider = providerFromUser(user);
        if (!user.emailVerified && provider === 'email') {
          NotificationManager.show('Verifica tu email antes de continuar', 'error');
          await firebase.auth().signOut();
          return;
        }
      }

      // ✅ Admin: comprobar isAdmin y redirigir a panel
      if (adminAttempt) {
        const okAdmin = await isUserAdmin(user.uid);
        if (!okAdmin) {
          NotificationManager.show('Tu usuario no tiene permisos de administrador', 'error');
          await firebase.auth().signOut();
          return;
        }

        // opcional: refrescar lastLogin
        await this.upsertUserProfile(user);

        NotificationManager.show('Acceso admin ✅', 'success');
        setTimeout(() => {
          window.location.href = ADMIN_REDIRECT_URL;
        }, 300);
        return;
      }

      // ✅ Normal: upsert y welcome
      await this.upsertUserProfile(user);
      NotificationManager.show('¡Inicio de sesión exitoso!', 'success');

      setTimeout(() => {
        window.location.href = CONFIG.LOGIN_REDIRECT_URL;
      }, 800);

    } catch (error) {
      ErrorHandler.handle(error, 'Login');
    } finally {
      State.setLoading(false);
    }
  },

  async handleRegistration() {
    if (State.isLoading) return;

    const username = document.getElementById('username')?.value.trim();
    const email = document.getElementById('email')?.value.trim();
    const password = document.getElementById('password')?.value;
    const confirmPassword = document.getElementById('confirm-password')?.value;
    const termsAccepted = document.getElementById('terms')?.checked;

    const usernameValidation = Validators.username(username);
    if (!usernameValidation.valid) {
      NotificationManager.show(usernameValidation.message, 'error');
      return;
    }

    const emailValidation = Validators.email(email);
    if (!emailValidation.valid) {
      NotificationManager.show(emailValidation.message, 'error');
      return;
    }

    const passwordValidation = Validators.password(password);
    if (!passwordValidation.valid) {
      NotificationManager.show(passwordValidation.message, 'error');
      return;
    }

    const matchValidation = Validators.passwordsMatch(password, confirmPassword);
    if (!matchValidation.valid) {
      NotificationManager.show(matchValidation.message, 'error');
      return;
    }

    if (!termsAccepted) {
      NotificationManager.show('Debes aceptar los términos y condiciones', 'error');
      return;
    }

    if (!isFirebaseReady()) {
      NotificationManager.show('Firebase no está listo. Intenta de nuevo', 'error');
      return;
    }

    State.setLoading(true);

    try {
      const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;

      try { await user.sendEmailVerification(); } catch (e) { console.warn('No se pudo enviar verificación:', e); }

      await firebase.firestore().collection('users').doc(user.uid).set({
        uid: user.uid,
        username: username,
        email: email,
        provider: 'email',
        photoURL: '',
        points: CONFIG.INITIAL_USER_POINTS,
        level: CONFIG.INITIAL_USER_LEVEL,
        experience: CONFIG.INITIAL_USER_EXPERIENCE,
        nextLevel: CONFIG.NEXT_LEVEL_THRESHOLD,
        gamesPlayed: 0,
        achievements: 0,
        sorteosParticipados: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastLogin: firebase.firestore.FieldValue.serverTimestamp()
      });

      NotificationManager.show('¡Cuenta creada! Verifica tu email antes de continuar', 'success');

      await firebase.auth().signOut();

      setTimeout(() => {
        this.showForm('login-form');
      }, 2000);

    } catch (error) {
      ErrorHandler.handle(error, 'Registration');
    } finally {
      State.setLoading(false);
    }
  },

  async upsertUserProfile(user) {
    const userRef = firebase.firestore().collection('users').doc(user.uid);
    const doc = await userRef.get();

    const baseUpdate = {
      uid: user.uid,
      email: user.email || '',
      provider: providerFromUser(user),
      photoURL: user.photoURL || '',
      lastLogin: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (!doc.exists) {
      await userRef.set({
        ...baseUpdate,
        username: user.displayName || 'Usuario',
        points: CONFIG.INITIAL_USER_POINTS,
        level: CONFIG.INITIAL_USER_LEVEL,
        experience: CONFIG.INITIAL_USER_EXPERIENCE,
        nextLevel: CONFIG.NEXT_LEVEL_THRESHOLD,
        gamesPlayed: 0,
        achievements: 0,
        sorteosParticipados: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } else {
      await userRef.set({
        ...baseUpdate,
        username: doc.data()?.username || user.displayName || 'Usuario'
      }, { merge: true });
    }
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

    if (strength < 50) strengthBar.style.backgroundColor = '#ef4444';
    else if (strength < 75) strengthBar.style.backgroundColor = '#f59e0b';
    else strengthBar.style.backgroundColor = '#10b981';
  }
};

// ==================== GOOGLE SIGN-IN ====================
const GoogleAuth = {
  async initiateLogin() {
    if (State.isLoading) return;

    if (!isFirebaseReady()) {
      NotificationManager.show('Firebase no está listo. Intenta de nuevo', 'error');
      return;
    }

    State.setLoading(true);
    NotificationManager.show('Conectando con Google...', 'info');

    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');

    try {
      await firebase.auth().signInWithRedirect(provider);
    } catch (error) {
      ErrorHandler.handle(error, 'GoogleLogin');
      State.setLoading(false);
    }
  },

  async handleRedirectResult() {
    if (!isFirebaseReady()) return;

    try {
      const result = await firebase.auth().getRedirectResult();

      if (result.user) {
        await FormManager.upsertUserProfile(result.user);

        // Si el user es admin, mandarlo al panel
        const okAdmin = await isUserAdmin(result.user.uid);
        if (okAdmin) {
          NotificationManager.show('Acceso admin ✅', 'success');
          setTimeout(() => window.location.href = ADMIN_REDIRECT_URL, 300);
          return;
        }

        NotificationManager.show(`¡Bienvenido, ${result.user.displayName || 'Gamer'}!`, 'success');
        setTimeout(() => {
          window.location.href = CONFIG.LOGIN_REDIRECT_URL;
        }, 800);
      }
    } catch (error) {
      if (error.code && error.code !== 'auth/popup-closed-by-user') {
        ErrorHandler.handle(error, 'GoogleRedirect');
      }
    } finally {
      State.setLoading(false);
    }
  }
};

// ==================== FACEBOOK SIGN-IN ====================
const FacebookAuth = {
  async initiateLogin() {
    if (State.isLoading) return;

    if (!isFirebaseReady()) {
      NotificationManager.show('Firebase no está listo. Intenta de nuevo', 'error');
      return;
    }

    State.setLoading(true);
    NotificationManager.show('Conectando con Facebook...', 'info');

    const provider = new firebase.auth.FacebookAuthProvider();

    try {
      await firebase.auth().signInWithRedirect(provider);
    } catch (error) {
      ErrorHandler.handle(error, 'FacebookLogin');
      State.setLoading(false);
    }
  },

  async handleRedirectResult() {
    if (!isFirebaseReady()) return;

    try {
      const result = await firebase.auth().getRedirectResult();

      if (result.user) {
        await FormManager.upsertUserProfile(result.user);

        // Si el user es admin, mandarlo al panel
        const okAdmin = await isUserAdmin(result.user.uid);
        if (okAdmin) {
          NotificationManager.show('Acceso admin ✅', 'success');
          setTimeout(() => window.location.href = ADMIN_REDIRECT_URL, 300);
          return;
        }

        NotificationManager.show(`¡Bienvenido, ${result.user.displayName || 'Gamer'}!`, 'success');
        setTimeout(() => {
          window.location.href = CONFIG.LOGIN_REDIRECT_URL;
        }, 800);
      }
    } catch (error) {
      if (error.code && error.code !== 'auth/popup-closed-by-user') {
        ErrorHandler.handle(error, 'FacebookRedirect');
      }
    } finally {
      State.setLoading(false);
    }
  }
};

// ==================== MANEJO DE SESIÓN ====================
const SessionManager = {
  init() {
    firebase.auth().onAuthStateChanged(async (user) => {
      const isInLogin =
        window.location.pathname.endsWith('/') ||
        window.location.pathname.includes('index.html') ||
        window.location.pathname.includes('VirtualGift-App/index');

      if (user && isInLogin) {
        // Si es admin -> panel, si no -> welcome
        try {
          const okAdmin = await isUserAdmin(user.uid);
          window.location.href = okAdmin ? ADMIN_REDIRECT_URL : CONFIG.LOGIN_REDIRECT_URL;
        } catch {
          window.location.href = CONFIG.LOGIN_REDIRECT_URL;
        }
      }
    });

    GoogleAuth.handleRedirectResult();
    FacebookAuth.handleRedirectResult();
  }
};

// ==================== INICIALIZACIÓN ====================
function initializeApp() {
  document.documentElement.style.backgroundColor = '#020515';
  document.body.style.backgroundColor = '#020515';

  waitForFirebase(() => {
    console.log('✅ Firebase listo');

    SessionManager.init();
    FormManager.init();

    document.getElementById('google-login')?.addEventListener('click', () => GoogleAuth.initiateLogin());
    document.getElementById('facebook-login')?.addEventListener('click', () => FacebookAuth.initiateLogin());

    console.log('✅ Auth inicializado');
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

// ==================== FUNCIÓN GLOBAL DE LOGOUT ====================
function vgSignOut() {
  if (!isFirebaseReady()) {
    window.location.href = CONFIG.LOGOUT_REDIRECT_URL;
    return;
  }

  firebase.auth().signOut()
    .then(() => window.location.href = CONFIG.LOGOUT_REDIRECT_URL)
    .catch((error) => {
      console.error('Error al cerrar sesión:', error);
      window.location.href = CONFIG.LOGOUT_REDIRECT_URL;
    });
}
