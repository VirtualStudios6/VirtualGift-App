// ==================== CONFIGURACIÓN ====================

const CONFIG = {
  NOTIFICATION_DURATION: 3500,
  PASSWORD_MIN_LENGTH: 8,

  INITIAL_USER_POINTS: 175,
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

function isAndroidWebView() {
  return /Android/.test(navigator.userAgent) && /wv/.test(navigator.userAgent);
}

// ✅ Flag global para bloquear el redirect de onAuthStateChanged durante el registro
let _isRegistering = false;

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

      if (!btn.dataset.originalHtml) {
        btn.dataset.originalHtml = btn.innerHTML;
      }

      if (loading) {
        if (btn.classList.contains('btn-primary')) {
          btn.innerHTML = `<span>Conectando...</span><svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:white;animation:spin .7s linear infinite"><path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/></svg>`;
        } else {
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
    document.getElementById('show-register')?.addEventListener('click', e => {
      e.preventDefault(); this.showForm('register-form');
    });
    document.getElementById('show-login')?.addEventListener('click', e => {
      e.preventDefault(); this.showForm('login-form');
    });

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

    document.getElementById('login-form')?.addEventListener('submit', e => {
      e.preventDefault(); this.handleLogin();
    });
    document.getElementById('login-btn')?.addEventListener('click', () => this.handleLogin());
    document.getElementById('register-btn')?.addEventListener('click', () => this.handleRegistration());

    document.getElementById('password')?.addEventListener('input', e => {
      this.checkPasswordStrength(e.target.value);
    });
  },

  showForm(formId) {
    document.querySelectorAll('.form').forEach(f => f.classList.remove('active'));
    document.getElementById(formId)?.classList.add('active');
    this.hideRecoveryForm();

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
      console.error('❌ Error enviando recuperación:', error.code, error.message);
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
      console.error('❌ Error login:', error.code, error.message);
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

    // ✅ FIX RACE CONDITION: bloquear redirect de onAuthStateChanged durante registro
    _isRegistering = true;
    State.setLoading(true);

    try {
      const { user } = await firebase.auth().createUserWithEmailAndPassword(email, password);

      // Guardar displayName en Firebase Auth
      try {
        await user.updateProfile({ displayName: username });
        console.log('✅ displayName guardado en Auth:', username);
      } catch(e) {
        console.error('❌ Error guardando displayName en Auth:', e.code, e.message);
      }

      // Email de verificación
      try {
        await user.sendEmailVerification();
        console.log('✅ Email de verificación enviado a:', email);
      } catch(e) {
        console.error('❌ Error enviando verificación:', e.code, e.message);
      }

      // ✅ Guardar en Firestore ANTES de signOut (el flag bloquea el redirect)
      await firebase.firestore().collection('users').doc(user.uid).set({
        uid: user.uid,
        username,
        displayName: username,
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

      console.log('✅ Firestore: usuario creado | username:', username, '| points:', CONFIG.INITIAL_USER_POINTS);

      NotificationManager.show('¡Cuenta creada! Revisa tu email para verificarla 📧', 'success');

      await firebase.auth().signOut();

      setTimeout(() => this.showForm('login-form'), 2000);

    } catch (error) {
      console.error('❌ Error registro:', error.code, error.message);
      ErrorHandler.handle(error, 'Registration');
    } finally {
      _isRegistering = false; // ✅ Liberar flag siempre
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
      const nameFromAuth = user.displayName || 'Usuario';
      await userRef.set({
        ...base,
        username:    nameFromAuth,
        displayName: nameFromAuth,
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
      const existingData = doc.data() || {};
      const savedName = existingData.username || existingData.displayName || user.displayName || 'Usuario';
      await userRef.set({
        ...base,
        username:    savedName,
        displayName: savedName
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
      if (isAndroidWebView()) {
        await firebase.auth().signInWithRedirect(provider);
      } else {
        const result = await firebase.auth().signInWithPopup(provider);
        if (result.user) {
          await FormManager.upsertUserProfile(result.user);
          NotificationManager.show(`¡Bienvenido, ${result.user.displayName || 'Gamer'}! 🎮`, 'success');
          setTimeout(() => window.location.href = CONFIG.LOGIN_REDIRECT_URL, 800);
        }
      }
    } catch (error) {
      console.error('❌ Google login error:', error.code, error.message);
      if (
        error.code === 'auth/popup-blocked' ||
        error.code === 'auth/operation-not-supported-in-this-environment'
      ) {
        try {
          await firebase.auth().signInWithRedirect(provider);
        } catch (e) {
          ErrorHandler.handle(e, 'GoogleRedirect');
          State.setLoading(false);
        }
      } else if (error.code !== 'auth/popup-closed-by-user') {
        ErrorHandler.handle(error, 'GoogleLogin');
        State.setLoading(false);
      } else {
        State.setLoading(false);
      }
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
      if (isAndroidWebView()) {
        await firebase.auth().signInWithRedirect(provider);
      } else {
        const result = await firebase.auth().signInWithPopup(provider);
        if (result.user) {
          await FormManager.upsertUserProfile(result.user);
          NotificationManager.show(`¡Bienvenido, ${result.user.displayName || 'Gamer'}! 🎮`, 'success');
          setTimeout(() => window.location.href = CONFIG.LOGIN_REDIRECT_URL, 800);
        }
      }
    } catch (error) {
      console.error('❌ Facebook login error:', error.code, error.message);
      if (
        error.code === 'auth/popup-blocked' ||
        error.code === 'auth/operation-not-supported-in-this-environment'
      ) {
        try {
          await firebase.auth().signInWithRedirect(provider);
        } catch (e) {
          ErrorHandler.handle(e, 'FacebookRedirect');
          State.setLoading(false);
        }
      } else if (error.code !== 'auth/popup-closed-by-user') {
        ErrorHandler.handle(error, 'FacebookLogin');
        State.setLoading(false);
      } else {
        State.setLoading(false);
      }
    }
  }
};

// ==================== SESIÓN ====================
const SessionManager = {
  init() {
    firebase.auth().onAuthStateChanged(user => {
      // ✅ FIX: ignorar el evento si estamos en medio del registro
      if (_isRegistering) return;

      const isInLogin =
        window.location.pathname.endsWith('/') ||
        window.location.pathname.includes('index.html') ||
        window.location.pathname.includes('VirtualGift-App/index');

      if (user && isInLogin) window.location.href = CONFIG.LOGIN_REDIRECT_URL;
    });

    handleSocialRedirectResult();
  }
};

async function handleSocialRedirectResult() {
  if (!isFirebaseReady()) return;
  try {
    const result = await firebase.auth().getRedirectResult();
    if (result && result.user) {
      await FormManager.upsertUserProfile(result.user);
      NotificationManager.show(`¡Bienvenido, ${result.user.displayName || 'Gamer'}! 🎮`, 'success');
      setTimeout(() => window.location.href = CONFIG.LOGIN_REDIRECT_URL, 800);
    }
  } catch (error) {
    console.error('❌ Social redirect error:', error.code, error.message);
    if (error.code && error.code !== 'auth/popup-closed-by-user') {
      ErrorHandler.handle(error, 'SocialRedirect');
    }
  } finally {
    State.setLoading(false);
  }
}

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
