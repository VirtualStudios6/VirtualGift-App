// ----------------------------
// Constants & Configuration
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
// DOM References
// ----------------------------
const DOM = {
  // Forms
  loginForm: document.getElementById('login-form'),
  registerForm: document.getElementById('register-form'),
  
  // Buttons
  loginBtn: document.getElementById('login-btn'),
  registerBtn: document.getElementById('register-btn'),
  sendRecoveryEmailBtn: document.getElementById('send-recovery-email'),
  cancelRecoveryBtn: document.getElementById('cancel-recovery'),
  
  // Inputs
  username: document.getElementById('username'),
  email: document.getElementById('email'),
  password: document.getElementById('password'),
  confirmPassword: document.getElementById('confirm-password'),
  loginEmail: document.getElementById('login-email'),
  loginPassword: document.getElementById('login-password'),
  recoveryEmail: document.getElementById('recovery-email'),
  termsCheckbox: document.getElementById('terms'),
  
  // UI Elements
  notification: document.getElementById('notification'),
  recoveryContainer: document.getElementById('recovery-container'),
  recoveryOverlay: document.getElementById('recovery-overlay'),
  forgotPasswordLink: document.getElementById('forgot-password'),
  showRegister: document.getElementById('show-register'),
  showLogin: document.getElementById('show-login'),
  passwordStrengthBar: document.getElementById('password-strength-bar')
};

// ----------------------------
// State Management
// ----------------------------
const State = {
  currentUser: null,
  isLoading: false,
  
  setLoading(loading) {
    this.isLoading = loading;
    this.updateLoadingStates(loading);
  },
  
  updateLoadingStates(loading) {
    const buttons = [DOM.loginBtn, DOM.registerBtn, DOM.sendRecoveryEmailBtn];
    buttons.forEach(btn => {
      if (btn) {
        btn.disabled = loading;
        btn.textContent = loading ? 
          (btn === DOM.loginBtn ? 'Iniciando...' : 
           btn === DOM.registerBtn ? 'Registrando...' : 'Enviando...') :
          btn.dataset.originalText || btn.textContent;
        
        if (!btn.dataset.originalText && !loading) {
          btn.dataset.originalText = btn.textContent;
        }
      }
    });
  }
};

// ----------------------------
// Utility Functions
// ----------------------------
const Utils = {
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
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
    const errorMessages = {
      'auth/user-not-found': 'Usuario no encontrado',
      'auth/wrong-password': 'Contraseña incorrecta',
      'auth/email-already-in-use': 'El correo ya está en uso',
      'auth/weak-password': 'Contraseña muy débil',
      'auth/invalid-email': 'Correo electrónico inválido',
      'auth/user-disabled': 'Cuenta deshabilitada',
      'auth/too-many-requests': 'Demasiados intentos. Intenta más tarde',
      'auth/network-request-failed': 'Error de conexión'
    };
    
    return errorMessages[error.code] || error.message || 'Error desconocido';
  }
};

// ----------------------------
// Notification System
// ----------------------------
const NotificationManager = {
  show(message, type = 'success') {
    if (!DOM.notification) return;
    
    DOM.notification.textContent = message;
    DOM.notification.className = `notification show ${type}`;
    
    // Clear any existing timeout
    if (this.timeout) clearTimeout(this.timeout);
    
    this.timeout = setTimeout(() => {
      DOM.notification.classList.remove('show');
    }, CONFIG.NOTIFICATION_DURATION);
  },
  
  success(message) {
    this.show(message, 'success');
  },
  
  error(message) {
    this.show(message, 'error');
  },
  
  timeout: null
};

// ----------------------------
// Validation System
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
    return this.validateField(
      DOM.username,
      'username-error',
      'Nombre de usuario debe tener 3-20 caracteres (solo letras, números y _)',
      username.length >= 3 && VALIDATION_PATTERNS.username.test(username)
    );
  },
  
  validateEmail(email) {
    return this.validateField(
      DOM.email,
      'email-error',
      'Ingresa un correo electrónico válido',
      Utils.isValidEmail(email)
    );
  },
  
  validatePassword(password) {
    const strength = Utils.getPasswordStrength(password);
    return this.validateField(
      DOM.password,
      'password-error',
      'La contraseña debe tener al menos 8 caracteres',
      password.length >= CONFIG.PASSWORD_MIN_LENGTH
    );
  },
  
  validatePasswordConfirmation(password, confirmPassword) {
    return this.validateField(
      DOM.confirmPassword,
      'confirm-password-error',
      'Las contraseñas no coinciden',
      password === confirmPassword && confirmPassword.length > 0
    );
  },
  
  validateTerms(accepted) {
    return this.validateField(
      DOM.termsCheckbox,
      'terms-error',
      'Debes aceptar los términos y condiciones',
      accepted
    );
  }
};

// ----------------------------
// Firebase Operations
// ----------------------------
const FirebaseManager = {
  async createUser(email, password, username) {
    try {
      const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;
      
      // Update profile
      await user.updateProfile({ displayName: username });
      
      // Create user document
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
      
      // Send verification email
      await user.sendEmailVerification();
      
      return user;
    } catch (error) {
      throw new Error(Utils.getFirebaseErrorMessage(error));
    }
  },
  
  async signInUser(email, password) {
    try {
      const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
      const user = userCredential.user;
      
      if (!user.emailVerified) {
        throw new Error('Debes verificar tu correo electrónico antes de iniciar sesión');
      }
      
      // Update last login
      await firebase.firestore().collection('users').doc(user.uid).update({
        lastLogin: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      return user;
    } catch (error) {
      throw new Error(Utils.getFirebaseErrorMessage(error));
    }
  },
  
  async sendPasswordReset(email) {
    try {
      await firebase.auth().sendPasswordResetEmail(email);
    } catch (error) {
      throw new Error(Utils.getFirebaseErrorMessage(error));
    }
  }
};

// ----------------------------
// Form Handlers
// ----------------------------
const FormHandlers = {
  async handleRegistration(event) {
    event?.preventDefault();
    
    if (State.isLoading) return;
    
    const username = Utils.sanitizeInput(DOM.username.value);
    const email = DOM.email.value.trim().toLowerCase();
    const password = DOM.password.value;
    const confirmPass = DOM.confirmPassword.value;
    const termsAccepted = DOM.termsCheckbox.checked;
    
    // Validate all fields
    const validations = [
      ValidationManager.validateUsername(username),
      ValidationManager.validateEmail(email),
      ValidationManager.validatePassword(password),
      ValidationManager.validatePasswordConfirmation(password, confirmPass),
      ValidationManager.validateTerms(termsAccepted)
    ];
    
    if (!validations.every(Boolean)) {
      NotificationManager.error('Por favor corrige los errores en el formulario');
      return;
    }
    
    State.setLoading(true);
    
    try {
      const user = await FirebaseManager.createUser(email, password, username);
      State.currentUser = user;
      NotificationManager.success('Cuenta creada exitosamente. Revisa tu correo para verificar tu cuenta.');
      this.clearForm(DOM.registerForm);
    } catch (error) {
      console.error('Registration error:', error);
      NotificationManager.error(error.message);
    } finally {
      State.setLoading(false);
    }
  },
  
  async handleLogin(event) {
    event?.preventDefault();
    
    if (State.isLoading) return;
    
    const email = DOM.loginEmail.value.trim().toLowerCase();
    const password = DOM.loginPassword.value;
    
    if (!email || !password) {
      NotificationManager.error('Por favor completa todos los campos');
      return;
    }
    
    if (!Utils.isValidEmail(email)) {
      NotificationManager.error('Por favor ingresa un correo electrónico válido');
      return;
    }
    
    State.setLoading(true);
    
    try {
      const user = await FirebaseManager.signInUser(email, password);
      State.currentUser = user;
      NotificationManager.success('Inicio de sesión exitoso');
      
      // Redirect after a short delay
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 1000);
      
    } catch (error) {
      console.error('Login error:', error);
      NotificationManager.error(error.message);
    } finally {
      State.setLoading(false);
    }
  },
  
  async handlePasswordRecovery(event) {
    event?.preventDefault();
    
    if (State.isLoading) return;
    
    const email = DOM.recoveryEmail.value.trim().toLowerCase();
    
    if (!email) {
      NotificationManager.error('Por favor ingresa tu correo electrónico');
      return;
    }
    
    if (!Utils.isValidEmail(email)) {
      NotificationManager.error('Por favor ingresa un correo electrónico válido');
      return;
    }
    
    State.setLoading(true);
    
    try {
      await FirebaseManager.sendPasswordReset(email);
      NotificationManager.success('Correo de recuperación enviado exitosamente');
      this.hideRecoveryModal();
      this.clearRecoveryForm();
    } catch (error) {
      console.error('Password recovery error:', error);
      NotificationManager.error(error.message);
    } finally {
      State.setLoading(false);
    }
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
    const inputs = form.querySelectorAll('input');
    inputs.forEach(input => {
      if (input.type !== 'checkbox') {
        input.value = '';
      } else {
        input.checked = false;
      }
      input.classList.remove('invalid');
      input.setAttribute('aria-invalid', 'false');
    });
    
    const errorMessages = form.querySelectorAll('.error-msg');
    errorMessages.forEach(error => error.textContent = '');
  },
  
  clearRecoveryForm() {
    if (DOM.recoveryEmail) {
      DOM.recoveryEmail.value = '';
    }
  },
  
  toggleForms(showRegister = true) {
    if (showRegister) {
      DOM.loginForm?.classList.remove('active');
      DOM.registerForm?.classList.add('active');
    } else {
      DOM.registerForm?.classList.remove('active');
      DOM.loginForm?.classList.add('active');
    }
  }
};

// ----------------------------
// Password Strength Indicator
// ----------------------------
const PasswordStrengthIndicator = {
  update: Utils.debounce(function(password) {
    const strength = Utils.getPasswordStrength(password);
    const bar = DOM.passwordStrengthBar;
    
    if (!bar) return;
    
    bar.style.width = `${strength}%`;
    
    // Color coding
    if (strength < 50) {
      bar.style.background = 'var(--error, #f43f5e)';
    } else if (strength < 75) {
      bar.style.background = '#f59e0b'; // yellow
    } else {
      bar.style.background = '#10b981'; // green
    }
    
    // Accessibility
    bar.setAttribute('aria-valuenow', strength);
    bar.setAttribute('aria-valuetext', this.getStrengthText(strength));
  }, 300),
  
  getStrengthText(strength) {
    if (strength < 25) return 'Muy débil';
    if (strength < 50) return 'Débil';
    if (strength < 75) return 'Buena';
    return 'Muy fuerte';
  }
};

// ----------------------------
// Event Listeners Setup
// ----------------------------
function setupEventListeners() {
  // Form toggles
  DOM.showRegister?.addEventListener('click', (e) => {
    e.preventDefault();
    FormHandlers.toggleForms(true);
  });
  
  DOM.showLogin?.addEventListener('click', (e) => {
    e.preventDefault();
    FormHandlers.toggleForms(false);
  });
  
  // Form submissions
  DOM.registerBtn?.addEventListener('click', FormHandlers.handleRegistration);
  DOM.loginBtn?.addEventListener('click', FormHandlers.handleLogin);
  
  // Password recovery
  DOM.forgotPasswordLink?.addEventListener('click', (e) => {
    e.preventDefault();
    FormHandlers.showRecoveryModal();
  });
  
  DOM.sendRecoveryEmailBtn?.addEventListener('click', FormHandlers.handlePasswordRecovery);
  DOM.cancelRecoveryBtn?.addEventListener('click', () => FormHandlers.hideRecoveryModal());
  DOM.recoveryOverlay?.addEventListener('click', () => FormHandlers.hideRecoveryModal());
  
  // Password strength indicator
  DOM.password?.addEventListener('input', (e) => {
    PasswordStrengthIndicator.update(e.target.value);
  });
  
  // Real-time validation
  DOM.username?.addEventListener('blur', (e) => {
    if (e.target.value) ValidationManager.validateUsername(Utils.sanitizeInput(e.target.value));
  });
  
  DOM.email?.addEventListener('blur', (e) => {
    if (e.target.value) ValidationManager.validateEmail(e.target.value.trim());
  });
  
  DOM.confirmPassword?.addEventListener('input', (e) => {
    if (e.target.value) {
      ValidationManager.validatePasswordConfirmation(DOM.password.value, e.target.value);
    }
  });
  
  // Enter key support
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const activeForm = document.querySelector('.form.active');
      if (activeForm === DOM.loginForm) {
        FormHandlers.handleLogin();
      } else if (activeForm === DOM.registerForm) {
        FormHandlers.handleRegistration();
      }
    }
    
    // Escape key to close recovery modal
    if (e.key === 'Escape') {
      FormHandlers.hideRecoveryModal();
    }
  });
}

// ----------------------------
// Initialization
// ----------------------------
function init() {
  // Check if Firebase is loaded
  if (typeof firebase === 'undefined') {
    console.error('Firebase not loaded');
    NotificationManager.error('Error de configuración. Por favor recarga la página.');
    return;
  }
  
  // Setup event listeners
  setupEventListeners();
  
  // Set initial button texts
  if (DOM.loginBtn) DOM.loginBtn.dataset.originalText = DOM.loginBtn.textContent;
  if (DOM.registerBtn) DOM.registerBtn.dataset.originalText = DOM.registerBtn.textContent;
  if (DOM.sendRecoveryEmailBtn) DOM.sendRecoveryEmailBtn.dataset.originalText = DOM.sendRecoveryEmailBtn.textContent;
  
  console.log('Auth system initialized successfully');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}