// ----------------------------
// Configuración y Constantes
// ----------------------------
const CONFIG = {
  NOTIFICATION_DURATION: 3500,
  PASSWORD_MIN_LENGTH: 8,
  INITIAL_USER_POINTS: 100,
  INITIAL_USER_LEVEL: 1,
  INITIAL_USER_EXPERIENCE: 0,
  NEXT_LEVEL_THRESHOLD: 200
};

const VALIDATION_PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  username: /^[a-zA-Z0-9_]{3,20}$/,
  password: {
    minLength: 8,
    hasLowerCase: /[a-z]/,
    hasUpperCase: /[A-Z]/,
    hasNumber: /[0-9]/,
    hasSpecialChar: /[^A-Za-z0-9]/
  }
};

// ----------------------------
// Discord OAuth Configuration
// ----------------------------
const DISCORD_CONFIG = {
  clientId: '1417729368825794640',
  redirectUri: 'https://virtualstudios6.github.io/VirtualGift-App/',
  scope: 'identify email'
};

// ----------------------------
// DOM References
// ----------------------------
const DOM = {
  loginForm: document.getElementById('login-form'),
  registerForm: document.getElementById('register-form'),
  loginBtn: document.getElementById('login-btn'),
  registerBtn: document.getElementById('register-btn'),
  sendRecoveryEmailBtn: document.getElementById('send-recovery-email'),
  cancelRecoveryBtn: document.getElementById('cancel-recovery'),
  username: document.getElementById('username'),
  email: document.getElementById('email'),
  password: document.getElementById('password'),
  confirmPassword: document.getElementById('confirm-password'),
  loginEmail: document.getElementById('login-email'),
  loginPassword: document.getElementById('login-password'),
  recoveryEmail: document.getElementById('recovery-email'),
  termsCheckbox: document.getElementById('terms'),
  notification: document.getElementById('notification'),
  recoveryContainer: document.getElementById('recovery-container'),
  recoveryOverlay: document.getElementById('recovery-overlay'),
  forgotPasswordLink: document.getElementById('forgot-password'),
  showRegister: document.getElementById('show-register'),
  showLogin: document.getElementById('show-login'),
  passwordStrengthBar: document.getElementById('password-strength-bar'),
  googleLoginBtn: document.getElementById('google-login'),
  discordLoginBtn: document.getElementById('discord-login')
};

// ----------------------------
// Estado Global
// ----------------------------
const State = {
  currentUser: null,
  isLoading: false,
  setLoading(loading) {
    this.isLoading = loading;
    const buttons = [DOM.loginBtn, DOM.registerBtn, DOM.sendRecoveryEmailBtn, DOM.googleLoginBtn, DOM.discordLoginBtn];
    buttons.forEach(btn => {
      if (btn) {
        btn.disabled = loading;
        if (loading) {
          btn.innerHTML = btn === DOM.discordLoginBtn ? 
            '<svg class="social-icon" viewBox="0 0 24 24" fill="#5865F2"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419-.0002 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9554 2.4189-2.1568 2.4189Z"/></svg> Conectando...' :
            'Cargando...';
        } else {
          btn.innerHTML = btn === DOM.discordLoginBtn ? 
            '<svg class="social-icon" viewBox="0 0 24 24" fill="#5865F2"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419-.0002 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9554 2.4189-2.1568 2.4189Z"/></svg> Continuar con Discord' :
            'Iniciar Sesión';
        }
      }
    });
  }
};

// ----------------------------
// Utilidades
// ----------------------------
const Utils = {
  debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  },
  sanitizeInput(input) {
    return input.trim().replace(/[<>\"']/g, '');
  },
  isValidEmail(email) {
    return VALIDATION_PATTERNS.email.test(email);
  },
  getPasswordStrength(password) {
    let strength = 0;
    const checks = VALIDATION_PATTERNS.password;
    if (password.length >= checks.minLength) strength += 25;
    if (checks.hasLowerCase.test(password) && checks.hasUpperCase.test(password)) strength += 25;
    if (checks.hasNumber.test(password)) strength += 25;
    if (checks.hasSpecialChar.test(password)) strength += 25;
    return strength;
  },
  getFirebaseErrorMessage(error) {
    const messages = {
      'auth/user-not-found': 'Usuario no encontrado',
      'auth/wrong-password': 'Contraseña incorrecta',
      'auth/email-already-in-use': 'El correo ya está en uso',
      'auth/weak-password': 'Contraseña muy débil',
      'auth/invalid-email': 'Correo electrónico inválido',
      'auth/user-disabled': 'Cuenta deshabilitada',
      'auth/too-many-requests': 'Demasiados intentos. Intenta más tarde',
      'auth/network-request-failed': 'Error de conexión'
    };
    return messages[error.code] || error.message || 'Error desconocido';
  },
  generateRandomState() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
};

// ----------------------------
// Notificaciones
// ----------------------------
const NotificationManager = {
  timeout: null,
  show(message, type='success') {
    if (!DOM.notification) return;
    DOM.notification.textContent = message;
    DOM.notification.className = `notification show ${type}`;
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = setTimeout(() => DOM.notification.classList.remove('show'), CONFIG.NOTIFICATION_DURATION);
  },
  success(msg) { this.show(msg, 'success'); },
  error(msg) { this.show(msg, 'error'); },
  info(msg) { this.show(msg, 'info'); }
};

// ----------------------------
// Validación
// ----------------------------
const ValidationManager = {
  validateField(input, errorId, message, condition) {
    const errorEl = document.getElementById(errorId);
    if (!condition) {
      if (errorEl) errorEl.textContent = message;
      input.classList.add('invalid');
      input.setAttribute('aria-invalid', 'true');
      return false;
    } else {
      if (errorEl) errorEl.textContent = '';
      input.classList.remove('invalid');
      input.setAttribute('aria-invalid', 'false');
      return true;
    }
  },
  validateUsername(username) {
    return this.validateField(DOM.username, 'username-error', 
      'Nombre de usuario debe tener 3-20 caracteres (solo letras, números y _)',
      username.length >= 3 && VALIDATION_PATTERNS.username.test(username));
  },
  validateEmail(email, inputEl=DOM.email) {
    return this.validateField(inputEl, inputEl===DOM.email?'email-error':'', 'Ingresa un correo válido', Utils.isValidEmail(email));
  },
  validatePassword(password) {
    const strength = Utils.getPasswordStrength(password);
    return this.validateField(DOM.password, 'password-error', 'Contraseña debe tener al menos 8 caracteres', password.length >= CONFIG.PASSWORD_MIN_LENGTH);
  },
  validatePasswordConfirmation(password, confirmPassword) {
    return this.validateField(DOM.confirmPassword, 'confirm-password-error', 'Las contraseñas no coinciden', password === confirmPassword && confirmPassword.length>0);
  },
  validateTerms(accepted) {
    return this.validateField(DOM.termsCheckbox, 'terms-error', 'Debes aceptar los términos', accepted);
  }
};

// ----------------------------
// Firebase Manager
// ----------------------------
const FirebaseManager = {
  async createUser(email, password, username) {
    const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;
    await user.updateProfile({displayName: username});
    await firebase.firestore().collection('users').doc(user.uid).set({
      username: Utils.sanitizeInput(username),
      email: email.toLowerCase(),
      points: CONFIG.INITIAL_USER_POINTS,
      level: CONFIG.INITIAL_USER_LEVEL,
      experience: CONFIG.INITIAL_USER_EXPERIENCE,
      nextLevel: CONFIG.NEXT_LEVEL_THRESHOLD,
      joinDate: firebase.firestore.FieldValue.serverTimestamp(),
      lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
      emailVerified: false
    });
    await user.sendEmailVerification();
    return user;
  },
  async signInUser(email, password) {
    const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
    const user = userCredential.user;
    if (!user.emailVerified) throw new Error('Verifica tu correo antes de iniciar sesión');
    await firebase.firestore().collection('users').doc(user.uid).update({
      lastLogin: firebase.firestore.FieldValue.serverTimestamp()
    });
    return user;
  },
  async sendPasswordReset(email) {
    await firebase.auth().sendPasswordResetEmail(email);
  }
};

// ----------------------------
// Discord OAuth Manager (simulado)
// ----------------------------
const DiscordAuthManager = {
  async initiateLogin() {
    if (State.isLoading) return;
    State.setLoading(true);
    NotificationManager.info('Conectando con Discord...');
    try {
      // Simular autenticación exitosa después de 2 segundos
      setTimeout(() => {
        this.simulateDiscordLogin();
      }, 2000);
    } catch (error) {
      NotificationManager.error('Error al conectar con Discord');
      State.setLoading(false);
    }
  },
  
  async simulateDiscordLogin() {
    try {
      // Generar datos simulados de usuario de Discord
      const randomId = Math.floor(1000000000 + Math.random() * 9000000000);
      const discordUser = {
        id: randomId.toString(),
        username: 'UsuarioDiscord_' + Math.floor(1000 + Math.random() * 9000),
        email: `discord_${randomId}@virtualgift.com`,
        avatar: null,
        verified: true
      };
      
      // Crear email y password únicos para Firebase
      const firebaseEmail = `discord_${discordUser.id}@virtualgift.app`;
      const firebasePassword = this.generateSecurePassword();
      
      // Crear usuario en Firebase
      const userCredential = await firebase.auth().createUserWithEmailAndPassword(firebaseEmail, firebasePassword);
      const user = userCredential.user;
      
      // Actualizar perfil del usuario
      await user.updateProfile({ displayName: discordUser.username });
      
      // Guardar información adicional en Firestore
      await firebase.firestore().collection('users').doc(user.uid).set({
        username: discordUser.username,
        email: firebaseEmail,
        discordId: discordUser.id,
        points: CONFIG.INITIAL_USER_POINTS,
        level: CONFIG.INITIAL_USER_LEVEL,
        experience: CONFIG.INITIAL_USER_EXPERIENCE,
        nextLevel: CONFIG.NEXT_LEVEL_THRESHOLD,
        joinDate: firebase.firestore.FieldValue.serverTimestamp(),
        lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
        emailVerified: true,
        loginMethod: 'discord',
        avatar: discordUser.avatar
      });
      
      State.currentUser = user;
      NotificationManager.success(`¡Bienvenido, ${discordUser.username}!`);
      
      // Redirección unificada
      setTimeout(() => Session.afterSignInRedirect(), 800);
      
    } catch (error) {
      console.error('Error en login Discord:', error);
      
      if (error.code === 'auth/email-already-in-use') {
        // Intentar login automático si el usuario ya existe (demo)
        await this.handleExistingUser();
      } else {
        NotificationManager.error('Error en la autenticación: ' + error.message);
      }
    } finally {
      State.setLoading(false);
    }
  },
  
  async handleExistingUser() {
    try {
      // Demo: crear nuevo usuario con otro correo
      const randomId = Math.floor(1000000000 + Math.random() * 9000000000);
      const firebaseEmail = `discord_${randomId}@virtualgift.app`;
      const firebasePassword = this.generateSecurePassword();
      
      const userCredential = await firebase.auth().createUserWithEmailAndPassword(firebaseEmail, firebasePassword);
      const user = userCredential.user;
      
      const discordUser = {
        username: 'UsuarioDiscord_' + Math.floor(1000 + Math.random() * 9000),
        id: randomId.toString()
      };
      
      await user.updateProfile({ displayName: discordUser.username });
      
      await firebase.firestore().collection('users').doc(user.uid).set({
        username: discordUser.username,
        email: firebaseEmail,
        discordId: discordUser.id,
        points: CONFIG.INITIAL_USER_POINTS,
        level: CONFIG.INITIAL_USER_LEVEL,
        experience: CONFIG.INITIAL_USER_EXPERIENCE,
        nextLevel: CONFIG.NEXT_LEVEL_THRESHOLD,
        joinDate: firebase.firestore.FieldValue.serverTimestamp(),
        lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
        emailVerified: true,
        loginMethod: 'discord'
      });
      
      State.currentUser = user;
      NotificationManager.success(`¡Bienvenido, ${discordUser.username}}!`);
      
      setTimeout(() => Session.afterSignInRedirect(), 800);
      
    } catch (error) {
      NotificationManager.error('Error al crear usuario: ' + error.message);
    }
  },
  
  generateSecurePassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  },
  
  handleCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
      NotificationManager.success('Autenticación con Discord exitosa');
      this.cleanUrlParams();
    }
  },
  
  cleanUrlParams() {
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
  }
};

// ----------------------------
// Form Handlers
// ----------------------------
const FormHandlers = {
  async handleRegistration(e) {
    e?.preventDefault();
    if (State.isLoading) return;
    const username = Utils.sanitizeInput(DOM.username.value);
    const email = Utils.sanitizeInput(DOM.email.value.trim().toLowerCase());
    const password = DOM.password.value;
    const confirmPass = DOM.confirmPassword.value;
    const termsAccepted = DOM.termsCheckbox.checked;

    const validations = [
      ValidationManager.validateUsername(username),
      ValidationManager.validateEmail(email),
      ValidationManager.validatePassword(password),
      ValidationManager.validatePasswordConfirmation(password, confirmPass),
      ValidationManager.validateTerms(termsAccepted)
    ];

    if (!validations.every(Boolean)) return NotificationManager.error('Corrige los errores en el formulario');

    State.setLoading(true);
    try {
      const user = await FirebaseManager.createUser(email, password, username);
      State.currentUser = user;
      NotificationManager.success('Cuenta creada. Revisa tu correo para verificarla.');
      this.clearForm(DOM.registerForm);
    } catch (error) {
      NotificationManager.error(Utils.getFirebaseErrorMessage(error));
    } finally { State.setLoading(false); }
  },

  async handleLogin(e) {
    e?.preventDefault();
    if (State.isLoading) return;
    const email = Utils.sanitizeInput(DOM.loginEmail.value.trim().toLowerCase());
    const password = DOM.loginPassword.value;
    if (!email || !password) return NotificationManager.error('Completa todos los campos');
    if (!Utils.isValidEmail(email)) return NotificationManager.error('Correo inválido');

    State.setLoading(true);
    try {
      const user = await FirebaseManager.signInUser(email, password);
      State.currentUser = user;
      NotificationManager.success('Inicio de sesión exitoso');
      Session.afterSignInRedirect();
    } catch (error) {
      NotificationManager.error(Utils.getFirebaseErrorMessage(error));
    } finally { State.setLoading(false); }
  },

  async handlePasswordRecovery(e) {
    e?.preventDefault();
    if (State.isLoading) return;
    const email = Utils.sanitizeInput(DOM.recoveryEmail.value.trim().toLowerCase());
    if (!email) return NotificationManager.error('Ingresa tu correo');
    if (!Utils.isValidEmail(email)) return NotificationManager.error('Correo inválido');

    State.setLoading(true);
    try {
      await FirebaseManager.sendPasswordReset(email);
      NotificationManager.success('Correo de recuperación enviado');
      this.hideRecoveryModal();
      this.clearRecoveryForm();
    } catch (error) {
      NotificationManager.error(Utils.getFirebaseErrorMessage(error));
    } finally { State.setLoading(false); }
  },

  showRecoveryModal() {
    DOM.recoveryContainer?.classList.add('show');
    DOM.recoveryOverlay?.classList.add('show');
    DOM.recoveryEmail?.focus();
  },
  hideRecoveryModal() {
    DOM.recoveryContainer?.classList.remove('show');
    DOM.recoveryOverlay?.classList.remove('show');
  },
  clearForm(form) {
    form.querySelectorAll('input').forEach(input=>{
      if(input.type!=='checkbox') input.value='';
      else input.checked=false;
      input.classList.remove('invalid');
      input.setAttribute('aria-invalid','false');
    });
    form.querySelectorAll('.error-msg').forEach(e=>e.textContent='');
    if(DOM.passwordStrengthBar) DOM.passwordStrengthBar.style.width='0';
  },
  clearRecoveryForm(){ if(DOM.recoveryEmail) DOM.recoveryEmail.value=''; },
  toggleForms(showRegister=true){
    const fadeOut = (el)=>{ el?.classList.remove('active'); };
    const fadeIn = (el)=>{ el?.classList.add('active'); };
    if(showRegister){ fadeOut(DOM.loginForm); fadeIn(DOM.registerForm); }
    else { fadeOut(DOM.registerForm); fadeIn(DOM.loginForm); }
  }
};

// ----------------------------
// Password Strength Indicator
// ----------------------------
const PasswordStrengthIndicator = {
  update: Utils.debounce(function(password){
    if(!DOM.passwordStrengthBar) return;
    const strength = Utils.getPasswordStrength(password);
    DOM.passwordStrengthBar.style.width = `${strength}%`;
    if(strength<50) DOM.passwordStrengthBar.style.background='var(--error)';
    else if(strength<75) DOM.passwordStrengthBar.style.background='#f59e0b';
    else DOM.passwordStrengthBar.style.background='#10b981';
    DOM.passwordStrengthBar.setAttribute('aria-valuenow', strength);
    DOM.passwordStrengthBar.setAttribute('aria-valuetext', this.getStrengthText(strength));
  },300),
  getStrengthText(strength){
    if(strength<25) return 'Muy débil';
    if(strength<50) return 'Débil';
    if(strength<75) return 'Buena';
    return 'Muy fuerte';
  }
};

// ----------------------------
// Google Sign-In
// ----------------------------
if(DOM.googleLoginBtn){
  DOM.googleLoginBtn.addEventListener('click', async () => {
    if(State.isLoading) return;
    State.setLoading(true);
    const provider = new firebase.auth.GoogleAuthProvider();

    try {
      const result = await firebase.auth().signInWithPopup(provider);
      const user = result.user;

      const userRef = firebase.firestore().collection('users').doc(user.uid);
      const doc = await userRef.get();
      if(!doc.exists){
        await userRef.set({
          username: user.displayName || 'Usuario',
          email: user.email,
          points: CONFIG.INITIAL_USER_POINTS,
          level: CONFIG.INITIAL_USER_LEVEL,
          experience: CONFIG.INITIAL_USER_EXPERIENCE,
          nextLevel: CONFIG.NEXT_LEVEL_THRESHOLD,
          joinDate: firebase.firestore.FieldValue.serverTimestamp(),
          lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
          emailVerified: user.emailVerified
        });
      } else {
        await userRef.update({
          lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        });
      }

      State.currentUser = user;
      NotificationManager.success(`Bienvenido, ${user.displayName || 'Gamer'}`);
      Session.afterSignInRedirect();
    } catch(error){
      console.error('Error Google Sign-In:', error);
      NotificationManager.error(Utils.getFirebaseErrorMessage(error));
    } finally{
      State.setLoading(false);
    }
  });
}

// ----------------------------
// Discord Sign-In
// ----------------------------
if(DOM.discordLoginBtn){
  DOM.discordLoginBtn.addEventListener('click', () => {
    DiscordAuthManager.initiateLogin();
  });
}

// ----------------------------
// Manejo de Sesión / Redirects
// ----------------------------
const ROUTES = {
  login: 'index.html',     // Ajusta si tu archivo de login tiene otro nombre
  welcome: 'welcome.html'
};

const Session = {
  init() {
    // 0) Atajo: si el flag existe, evita el parpadeo del login
    if (localStorage.getItem('vg_logged') === '1') {
      if (!location.pathname.endsWith(ROUTES.welcome)) {
        location.replace(ROUTES.welcome);
        return;
      }
    }

    // 1) Persistencia LOCAL y lenguaje
    try {
      firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      firebase.auth().useDeviceLanguage();
    } catch (e) {
      console.warn('No se pudo establecer persistencia:', e);
    }

    // 2) Observador de sesión
    firebase.auth().onAuthStateChanged((user) => {
      if (user) {
        localStorage.setItem('vg_logged', '1');

        // Si estás en el login o raíz, redirige a welcome
        const inLogin =
          location.pathname.endsWith(ROUTES.login) ||
          location.pathname.endsWith('/') ||
          location.pathname.includes('VirtualGift-App/index');

        if (inLogin) {
          location.replace(ROUTES.welcome);
        }
      } else {
        localStorage.removeItem('vg_logged');
        if (location.pathname.endsWith(ROUTES.welcome)) {
          location.replace(ROUTES.login);
        }
      }
    });
  },

  afterSignInRedirect() {
    localStorage.setItem('vg_logged', '1');
    location.replace(ROUTES.welcome);
  },

  afterSignOutRedirect() {
    localStorage.removeItem('vg_logged');
    location.replace(ROUTES.login);
  }
};

// ----------------------------
// Eventos
// ----------------------------
function setupEventListeners(){
  DOM.showRegister?.addEventListener('click', e=>{ e.preventDefault(); FormHandlers.toggleForms(true); });
  DOM.showLogin?.addEventListener('click', e=>{ e.preventDefault(); FormHandlers.toggleForms(false); });
  DOM.registerBtn?.addEventListener('click', FormHandlers.handleRegistration);
  DOM.loginBtn?.addEventListener('click', FormHandlers.handleLogin);
  DOM.forgotPasswordLink?.addEventListener('click', e=>{ e.preventDefault(); FormHandlers.showRecoveryModal(); });
  DOM.sendRecoveryEmailBtn?.addEventListener('click', FormHandlers.handlePasswordRecovery);
  DOM.cancelRecoveryBtn?.addEventListener('click', ()=>FormHandlers.hideRecoveryModal());
  DOM.recoveryOverlay?.addEventListener('click', ()=>FormHandlers.hideRecoveryModal());
  DOM.password?.addEventListener('input', e=>PasswordStrengthIndicator.update(e.target.value));
  DOM.confirmPassword?.addEventListener('input', e=>{
    if(e.target.value) ValidationManager.validatePasswordConfirmation(DOM.password.value, e.target.value);
  });
  DOM.username?.addEventListener('blur', e=>{
    if(e.target.value) ValidationManager.validateUsername(Utils.sanitizeInput(e.target.value));
  });
  DOM.email?.addEventListener('blur', e=>{
    if(e.target.value) ValidationManager.validateEmail(Utils.sanitizeInput(e.target.value.trim()), DOM.email);
  });
  document.addEventListener('keydown', e=>{
    if(e.key==='Enter'){
      const activeForm=document.querySelector('.form.active');
      if(activeForm===DOM.loginForm) FormHandlers.handleLogin();
      else if(activeForm===DOM.registerForm) FormHandlers.handleRegistration();
    }
    if(e.key==='Escape') FormHandlers.hideRecoveryModal();
  });
}

// ----------------------------
// Inicialización
// ----------------------------
function init(){
  if(typeof firebase==='undefined'){
    console.error('Firebase not loaded');
    NotificationManager.error('Error de configuración. Recarga la página');
    return;
  }

  // Inicializa manejo de sesión y redirecciones
  Session.init();

  setupEventListeners();
  // Manejar callback de Discord al cargar la página
  DiscordAuthManager.handleCallback();
  console.log('Auth system initialized successfully');
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
else init();

// ----------------------------
// Helper de Logout (opcional)
// ----------------------------
function vgSignOut() {
  firebase.auth().signOut()
    .catch(()=>{})
    .finally(() => Session.afterSignOutRedirect());
}
