// ==================== CONFIGURACIÓN ====================

const CONFIG = {
  NOTIFICATION_DURATION: 3500,
  PASSWORD_MIN_LENGTH: 8,

  INITIAL_USER_POINTS: 100,
  INITIAL_USER_LEVEL: 1,
  INITIAL_USER_EXPERIENCE: 0,
  NEXT_LEVEL_THRESHOLD: 200,

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

function providerFromUser(user) {
  const providerId = user?.providerData?.[0]?.providerId || 'password';
  if (providerId === 'google.com')   return 'google';
  if (providerId === 'facebook.com') return 'facebook';
  return 'email';
}

// ==================== ESTADO GLOBAL ====================
const State = {
  isLoading: false,

  setLoading(loading) {
    this.isLoading = loading;

    const buttons = ['login-btn', 'register-btn', 'send-recovery-email', 'google-login', 'facebook-login'];

    buttons.forEach(btnId => {
      const btn = document.getElementById(btnId);
      if (!btn) return;

      btn.disabled = loading;

      // Guardar HTML original (con iconos SVG intactos)
      if (!btn.dataset.originalHtml) {
        btn.dataset.originalHtml = btn.innerHTML;
      }

      if (loading) {
        // Para btn-primary: preservar estructura con <span>
        if (btn.classList.contains('btn-primary')) {
          btn.innerHTML = `<span>Conectando...</span><svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:white;animation:spin .7s linear infinite"><path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/></svg>`;
        } else {
          // btn-social: añadir texto sin borrar el logo SVG
          const span = btn.querySelector('span') || btn;
          if (!btn.dataset.loadingActive) {
            btn.dataset.loadingActive = '1';
            btn.insertAdjacentHTML('beforeend', '<span class="btn-loading-txt" style="opacity:.75;font-size:12px;margin-left:4px;">Conectando...</span>');
          }
        }
      } else {
        btn.innerHTML = btn.dataset.originalHtml;
        delete btn.dataset.loadingActive;
      }
    });
  }
};

// CSS para el spinner en botón
(function injectSpinnerCSS() {
  if (document.getElementById('auth-spin-css')) return;
  const s = document.createElement('style');
  s.id = 'auth-spin-css';
  s.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(s);
})();

// ==================== NOTIFICACIONES ====================
const NotificationManager = {
  show(message, type = 'success') {
    const notification = document.getElementById('notification');
    if (!notification) return;
    notification.textContent = message;
    notification.className = `notification show ${type}`;
    setTimeout(() => notification.classList.remove('show'), CONFIG.NOTIFICATION_DURATION);
  }
};

// ==================== MANEJO DE FORMULARIOS ====================
const FormManager = {
  init() {
    // Los tabs del nuevo index.html usan switchTab() directamente.
    // Estos listeners son por compatibilidad (por si otra página los usa).
    document.getElementById('show-register')?.addEventListener('click', e => {
      e.preventDefault(); this.showForm('register-form');
    });
    document.getElementById('show-login')?.addEventListener('click', e => {
      e.preventDefault(); this.showForm('login-form');
    });

    // Recuperación
    document.getElementById('forgot-password')?.addEventListener('click', e => {
      e.preventDefault(); this.showRecoveryForm();
    });
    document.getElementById('cancel-recovery')?.addEventListener('click', e => {
      e.preventDefault(); this.hideRecoveryForm();
    });
    document.getElementById('recovery-overlay')?.addEventListener('click', () => {
      this.hideRecoveryForm();
    });
    document.getElementById('send-recovery-email')?.addEventListener('click', () => {
      this.sendRecoveryEmail();
    });

    // Submit y botones
    document.getElementById('login-form')?.addEventListener('submit', e => {
      e.preventDefault(); this.handleLogin();
    });
    document.getElementById('login-btn')?.addEventListener('click', () => this.handleLogin());
    document.getElementById('register-btn')?.addEventListener('click', () => this.handleRegistration());

    // Fuerza de contraseña (si el inline de index.html no lo manejó aún)
    document.getElementById('password')?.addEventListener('input', e => {
      this.checkPasswordStrength(e.target.value);
    });
  },

  showForm(formId) {
    // Ocultar todos los formularios
    document.querySelectorAll('.form').forEach(f => f.classList.remove('active'));
    document.getElementById(formId)?.classList.add('active');
    this.hideRecoveryForm();

    // Sincronizar con el tab indicator del nuevo index.html
    const isRegister = formId === 'register-form';
    const indicator  = document.getElementById('tabIndicator');
    const tabLogin   = document.getElementById('tabLogin');
    const tabReg     = document.getElementById('tabRegister');
    if (indicator) indicator.style.transform = isRegister ? 'translateX(100%)' : 'translateX(0)';
    if (tabLogin)  tabLogin.classList.toggle('active',  !isRegister);
    if (tabReg)    tabReg.classList.toggle('active',    isRegister);
  },

  showRecoveryForm() {
    document.getElementById('recovery-container')?.classList.add('show', 'active');
    document.getElementById('recovery-overlay')?.classList.add('show', 'active');
  },

  hideRecoveryForm() {
    document.getElementById('recovery-container')?.classList.remove('show', 'active');
    document.getElementById('recovery-overlay')?.classList.remove('show', 'active');
    const el = document.getElementById('recovery-email');
    if (el) el.value = '';
  },

  async sendRecoveryEmail() {
    const email = document.getElementById('recovery-email')?.value.trim();
    if (!email) { NotificationManager.show('Por favor, ingresa tu correo', 'error'); return; }

    const v = Validators.email(email);
    if (!v.valid) { NotificationManager.show(v.message, 'error'); return; }

    if (!isFirebaseReady()) { NotificationManager.show('Firebase no está listo. Intenta de nuevo', 'error'); return; }

    State.setLoading(true);
    try {
      await firebase.auth().sendPasswordResetEmail(email);
      NotificationManager.show('Enlace enviado a tu correo 📧', 'success');
      this.hideRecoveryForm();
    } catch (error) {
      ErrorHandler.handle(error, 'RecoveryEmail');
    } finally {
      State.setLoading(false);
    }
  },

  async handleLogin() {
    if (State.isLoading) return;

    const email    = document.getElementById('login-email')?.value.trim();
    const password = document.getElementById('login-password')?.value;

    if (!email || !password) { NotificationManager.show('Completa todos los campos', 'error'); return; }

    const ev = Validators.email(email);
    if (!ev.valid) { NotificationManager.show(ev.message, 'error'); return; }

    if (!isFirebaseReady()) { NotificationManager.show('Firebase no está listo', 'error'); return; }

    State.setLoading(true);
    try {
      const { user } = await firebase.auth().signInWithEmailAndPassword(email, password);

      if (!user.emailVerified && providerFromUser(user) === 'email') {
        NotificationManager.show('Verifica tu email antes de continuar', 'error');
        await firebase.auth().signOut();
        return;
      }

      await this.upsertUserProfile(user);
      NotificationManager.show('¡Bienvenido de vuelta! 👋', 'success');
      setTimeout(() => window.location.href = CONFIG.LOGIN_REDIRECT_URL, 800);

    } catch (error) {
      ErrorHandler.handle(error, 'Login');
    } finally {
      State.setLoading(false);
    }
  },

  async handleRegistration() {
    if (State.isLoading) return;

    const username        = document.getElementById('username')?.value.trim();
    const email           = document.getElementById('email')?.value.trim();
    const password        = document.getElementById('password')?.value;
    const confirmPassword = document.getElementById('confirm-password')?.value;
    const termsAccepted   = document.getElementById('terms')?.checked;

    const uv = Validators.username(username);
    if (!uv.valid) { NotificationManager.show(uv.message, 'error'); return; }

    const ev = Validators.email(email);
    if (!ev.valid) { NotificationManager.show(ev.message, 'error'); return; }

    const pv = Validators.password(password);
    if (!pv.valid) { NotificationManager.show(pv.message, 'error'); return; }

    const mv = Validators.passwordsMatch(password, confirmPassword);
    if (!mv.valid) { NotificationManager.show(mv.message, 'error'); return; }

    if (!termsAccepted) { NotificationManager.show('Acepta los términos y condiciones', 'error'); return; }

    if (!isFirebaseReady()) { NotificationManager.show('Firebase no está listo', 'error'); return; }

    State.setLoading(true);
    try {
      const { user } = await firebase.auth().createUserWithEmailAndPassword(email, password);

      try { await user.sendEmailVerification(); } catch(e) { console.warn('Verificación:', e); }

      await firebase.firestore().collection('users').doc(user.uid).set({
        uid: user.uid,
        username,
        email,
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

      NotificationManager.show('¡Cuenta creada! Revisa tu email para verificarla 📧', 'success');
      await firebase.auth().signOut();

      setTimeout(() => this.showForm('login-form'), 2000);

    } catch (error) {
      ErrorHandler.handle(error, 'Registration');
    } finally {
      State.setLoading(false);
    }
  },

  async upsertUserProfile(user) {
    const userRef = firebase.firestore().collection('users').doc(user.uid);
    const doc     = await userRef.get();

    const base = {
      uid: user.uid,
      email: user.email || '',
      provider: providerFromUser(user),
      photoURL: user.photoURL || '',
      lastLogin: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (!doc.exists) {
      await userRef.set({
        ...base,
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
        ...base,
        username: doc.data()?.username || user.displayName || 'Usuario'
      }, { merge: true });
    }
  },

  checkPasswordStrength(password) {
    const bar = document.getElementById('password-strength-bar');
    const lbl = document.getElementById('pwStrengthLabel');
    if (!bar) return;

    let score = 0;
    if (password.length >= CONFIG.PASSWORD_MIN_LENGTH) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    const pct   = ['0%','25%','50%','75%','100%'][score];
    const color = ['','#ef4444','#f97316','#eab308','#22c55e'][score];
    const text  = ['','Débil','Regular','Buena','Fuerte'][score];

    bar.style.width      = pct;
    bar.style.background = color;
    if (lbl) { lbl.textContent = text; lbl.style.color = color; }
  }
};

// ==================== GOOGLE SIGN-IN ====================
const GoogleAuth = {
  async initiateLogin() {
    if (State.isLoading) return;
    if (!isFirebaseReady()) { NotificationManager.show('Firebase no está listo', 'error'); return; }

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
        NotificationManager.show(`¡Bienvenido, ${result.user.displayName || 'Gamer'}! 🎮`, 'success');
        setTimeout(() => window.location.href = CONFIG.LOGIN_REDIRECT_URL, 800);
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
    if (!isFirebaseReady()) { NotificationManager.show('Firebase no está listo', 'error'); return; }

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
        NotificationManager.show(`¡Bienvenido, ${result.user.displayName || 'Gamer'}! 🎮`, 'success');
        setTimeout(() => window.location.href = CONFIG.LOGIN_REDIRECT_URL, 800);
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

// ==================== SESIÓN ====================
const SessionManager = {
  init() {
    firebase.auth().onAuthStateChanged(user => {
      const isInLogin =
        window.location.pathname.endsWith('/') ||
        window.location.pathname.includes('index.html') ||
        window.location.pathname.includes('VirtualGift-App/index');

      if (user && isInLogin) window.location.href = CONFIG.LOGIN_REDIRECT_URL;
    });

    GoogleAuth.handleRedirectResult();
    FacebookAuth.handleRedirectResult();
  }
};

// ==================== INICIALIZACIÓN ====================
function initializeApp() {
  document.documentElement.style.backgroundColor = '#03010f';
  document.body.style.backgroundColor = '#03010f';

  waitForFirebase(() => {
    SessionManager.init();
    FormManager.init();

    document.getElementById('google-login')?.addEventListener('click',   () => GoogleAuth.initiateLogin());
    document.getElementById('facebook-login')?.addEventListener('click', () => FacebookAuth.initiateLogin());
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

// ==================== LOGOUT GLOBAL ====================
function vgSignOut() {
  if (!isFirebaseReady()) { window.location.href = CONFIG.LOGOUT_REDIRECT_URL; return; }
  firebase.auth().signOut()
    .then(()  => window.location.href = CONFIG.LOGOUT_REDIRECT_URL)
    .catch(()  => window.location.href = CONFIG.LOGOUT_REDIRECT_URL);
}
