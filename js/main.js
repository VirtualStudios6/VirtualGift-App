// ==================== CONFIGURACIÓN ====================
const CONFIG = {
  NOTIFICATION_DURATION: 3500,
  PASSWORD_MIN_LENGTH: 8,
  INITIAL_USER_POINTS: 100,
  INITIAL_USER_LEVEL: 1,
  INITIAL_USER_EXPERIENCE: 0,
  NEXT_LEVEL_THRESHOLD: 200,
  DISCORD_CLIENT_ID: '1417729368825794640',
  DISCORD_REDIRECT_URI: 'https://virtualstudios6.github.io/VirtualGift-App/',
  // REEMPLAZA ESTO CON TU CLIENT_SECRET REAL:
  DISCORD_CLIENT_SECRET: 'FUabzEkiOoLogmzhUL6fXMVbaHN6nmUn'
};

// ==================== ESTADO GLOBAL ====================
const State = {
  isLoading: false,
  setLoading(loading) {
    this.isLoading = loading;
    const buttons = ['login-btn', 'register-btn', 'send-recovery-email', 'discord-login'];
    buttons.forEach(btnId => {
      const btn = document.getElementById(btnId);
      if (btn) {
        btn.disabled = loading;
        if (loading && btnId === 'discord-login') {
          btn.classList.add('btn-loading');
        } else {
          btn.classList.remove('btn-loading');
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
    document.getElementById('recovery-container').classList.add('active');
    document.getElementById('recovery-overlay').classList.add('active');
  },

  hideRecoveryForm() {
    document.getElementById('recovery-container').classList.remove('active');
    document.getElementById('recovery-overlay').classList.remove('active');
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
      NotificationManager.show('¡Inicio de sesión exitoso!', 'success');
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
        emailVerified: false
      });

      // Enviar correo de verificación
      await user.sendEmailVerification();

      NotificationManager.show('¡Cuenta creada exitosamente! Se ha enviado un correo de verificación', 'success');

      // Por seguridad, pide verificar el correo antes de acceder.
      await firebase.auth().signOut();

      // Si quieres dejar pasar aunque no haya verificado, descomenta la línea de abajo (NO recomendado):
      // setTimeout(() => { window.location.href = 'welcome.html'; }, 2000);

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

// ==================== DISCORD OAUTH ====================
const DiscordAuth = {
  async initiateLogin() {
    if (State.isLoading) return;
    State.setLoading(true);

    try {
      const state = this.generateState();
      sessionStorage.setItem('discord_oauth_state', state);

      const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${CONFIG.DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(CONFIG.DISCORD_REDIRECT_URI)}&response_type=code&scope=identify%20email&state=${state}&prompt=none`;

      window.location.href = authUrl;
    } catch (error) {
      NotificationManager.show('Error al conectar con Discord', 'error');
      State.setLoading(false);
    }
  },

  async handleCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    const state = urlParams.get('state');

    if (error) {
      NotificationManager.show(`Error de Discord: ${error}`, 'error');
      this.cleanUrl();
      return;
    }

    if (code && state) {
      const savedState = sessionStorage.getItem('discord_oauth_state');
      if (state !== savedState) {
        NotificationManager.show('Error de seguridad', 'error');
        this.cleanUrl();
        return;
      }

      sessionStorage.removeItem('discord_oauth_state');
      await this.exchangeCodeForToken(code);
    }
  },

  async exchangeCodeForToken(code) {
    try {
      NotificationManager.show('Procesando autenticación...', 'info');

      // Intercambiar código por token usando client_secret
      const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: CONFIG.DISCORD_CLIENT_ID,
          client_secret: CONFIG.DISCORD_CLIENT_SECRET,
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: CONFIG.DISCORD_REDIRECT_URI,
          scope: 'identify email'
        })
      });

      if (!tokenResponse.ok) {
        throw new Error('Error al obtener token de Discord');
      }

      const tokens = await tokenResponse.json();
      await this.getUserInfo(tokens.access_token);

    } catch (error) {
      console.error('Error Discord auth:', error);
      NotificationManager.show('Error en la autenticación', 'error');
      State.setLoading(false);
    }
  },

  async getUserInfo(accessToken) {
    try {
      const userResponse = await fetch('https://discord.com/api/users/@me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!userResponse.ok) {
        throw new Error('Error al obtener información del usuario');
      }

      const discordUser = await userResponse.json();
      await this.createFirebaseUser(discordUser);

    } catch (error) {
      NotificationManager.show('Error al obtener datos del usuario', 'error');
      State.setLoading(false);
    }
  },

  async createFirebaseUser(discordUser) {
    try {
      // Crear usuario en Firebase
      const email = `${discordUser.id}@discord.virtualgift.com`;
      const password = this.generateSecurePassword();

      const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;

      // Actualizar perfil
      await user.updateProfile({
        displayName: discordUser.username
      });

      // Guardar en Firestore
      await firebase.firestore().collection('users').doc(user.uid).set({
        username: discordUser.username,
        email: email,
        discordId: discordUser.id,
        discordUsername: discordUser.username,
        discordAvatar: discordUser.avatar,
        points: CONFIG.INITIAL_USER_POINTS,
        level: CONFIG.INITIAL_USER_LEVEL,
        experience: CONFIG.INITIAL_USER_EXPERIENCE,
        nextLevel: CONFIG.NEXT_LEVEL_THRESHOLD,
        joinDate: firebase.firestore.FieldValue.serverTimestamp(),
        lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
        emailVerified: true,
        loginMethod: 'discord'
      });

      NotificationManager.show(`¡Bienvenido, ${discordUser.username}!`, 'success');
      this.cleanUrl();

      setTimeout(() => {
        window.location.href = 'welcome.html';
      }, 1200);

    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        await this.handleExistingUser(discordUser);
      } else {
        NotificationManager.show('Error al crear usuario: ' + error.message, 'error');
        State.setLoading(false);
      }
    }
  },

  async handleExistingUser(discordUser) {
    try {
      const email = `${discordUser.id}@discord.virtualgift.com`;
      const password = this.generateSecurePassword();

      // Intentar login
      await firebase.auth().signInWithEmailAndPassword(email, password);
      NotificationManager.show(`¡Bienvenido de nuevo, ${discordUser.username}!`, 'success');

      this.cleanUrl();
      setTimeout(() => {
        window.location.href = 'welcome.html';
      }, 1200);

    } catch (error) {
      NotificationManager.show('Error al iniciar sesión', 'error');
      State.setLoading(false);
    }
  },

  generateState() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  },

  generateSecurePassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  },

  cleanUrl() {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
};

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', function() {
  // Configuración inicial
  document.documentElement.style.backgroundColor = '#0f172a';
  document.body.style.backgroundColor = '#0f172a';

  // Inicializar el manejo de formularios
  FormManager.init();

  // Event listener para Discord
  const discordBtn = document.getElementById('discord-login');
  if (discordBtn) {
    discordBtn.addEventListener('click', () => DiscordAuth.initiateLogin());
  }

  // Manejar callback de Discord al cargar la página
  DiscordAuth.handleCallback();
});