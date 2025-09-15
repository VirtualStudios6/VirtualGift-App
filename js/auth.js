// Función de validación
function validateField(input, errorId, message, condition) {
  const errorElement = document.getElementById(errorId);
  if (!condition) {
    if (errorElement) errorElement.textContent = message;
    input.classList.add('invalid');
    return false;
  } else {
    if (errorElement) errorElement.textContent = '';
    input.classList.remove('invalid');
    return true;
  }
}

// DOM
const DOM = {
  registerForm: document.getElementById('register-form'),
  loginForm: document.getElementById('login-form'),
  tabs: document.querySelectorAll('.tab'),
  registerBtn: document.getElementById('register-btn'),
  loginBtn: document.getElementById('login-btn'),
  notification: document.getElementById('notification'),
  usernameInput: document.getElementById('username'),
  emailInput: document.getElementById('email'),
  passwordInput: document.getElementById('password'),
  confirmPasswordInput: document.getElementById('confirm-password'),
  loginEmailInput: document.getElementById('login-email'),
  loginPasswordInput: document.getElementById('login-password'),
  forgotPasswordLink: document.getElementById('forgot-password'),
  resendVerificationBtn: document.getElementById('resend-verification'),
  continueToDashboardBtn: document.getElementById('continue-to-dashboard'),
  recoveryEmail: document.getElementById('recovery-email'),
  sendRecoveryEmailBtn: document.getElementById('send-recovery-email'),
  cancelRecoveryBtn: document.getElementById('cancel-recovery')
};

let currentUser = null;

// Notificación
function showNotification(msg, isError = false) {
  DOM.notification.textContent = msg;
  DOM.notification.className = 'notification show';
  if (isError) DOM.notification.classList.add('error');
  setTimeout(() => DOM.notification.classList.remove('show'), 3000);
}

// Registro
DOM.registerBtn.addEventListener('click', async () => {
  const username = DOM.usernameInput.value.trim();
  const email = DOM.emailInput.value.trim();
  const password = DOM.passwordInput.value;
  const confirmPassword = DOM.confirmPasswordInput.value;
  const termsAccepted = document.getElementById('terms').checked;

  const validUser = validateField(DOM.usernameInput, 'username-error', 'Elige un nombre de usuario', username !== '');
  const validEmail = validateField(DOM.emailInput, 'email-error', 'Correo inválido', /\S+@\S+\.\S+/.test(email));
  const validPass = validateField(DOM.passwordInput, 'password-error', 'Mínimo 8 caracteres', password.length >= 8);
  const validConfirm = validateField(DOM.confirmPasswordInput, 'confirm-password-error', 'No coinciden', password === confirmPassword);
  const validTerms = validateField(document.getElementById('terms'), 'terms-error', 'Debes aceptar los términos', termsAccepted);

  if (!(validUser && validEmail && validPass && validConfirm && validTerms)) return;

  try {
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;
    currentUser = user;
    await user.updateProfile({ displayName: username });
    await db.collection('users').doc(user.uid).set({
      username, email, points: 100, level: 1, experience: 0,
      nextLevel: 200, joinDate: new Date(), lastLogin: new Date()
    });
    await user.sendEmailVerification();
    showNotification('Cuenta creada. Verifica tu correo.');
  } catch (e) {
    showNotification('Error al registrar: ' + e.message, true);
  }
});

// Login
DOM.loginBtn.addEventListener('click', async () => {
  const email = DOM.loginEmailInput.value.trim();
  const password = DOM.loginPasswordInput.value;
  if (!email || !password) return showNotification('Completa todos los campos', true);

  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    const user = userCredential.user;
    if (!user.emailVerified) {
      showNotification('Verifica tu correo antes de entrar', true);
      return;
    }
    await db.collection('users').doc(user.uid).update({ lastLogin: new Date() });
    window.location.href = 'dashboard.html';
  } catch (e) {
    showNotification('Error: ' + e.message, true);
  }
});

// Recuperar
DOM.sendRecoveryEmailBtn.addEventListener('click', async () => {
  const email = DOM.recoveryEmail.value.trim();
  if (!email) return showNotification('Ingresa tu correo', true);
  try {
    await auth.sendPasswordResetEmail(email);
    showNotification('Correo de recuperación enviado');
    document.getElementById('recovery-container').classList.remove('show');
  } catch (e) {
    showNotification('Error: ' + e.message, true);
  }
});
DOM.cancelRecoveryBtn.addEventListener('click', () => {
  document.getElementById('recovery-container').classList.remove('show');
});

// Tabs
DOM.tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    DOM.tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.form-container').forEach(f => f.classList.remove('active'));
    document.getElementById(`${tab.dataset.tab}-form`).classList.add('active');
  });
});

// Fuerza de contraseña
DOM.passwordInput.addEventListener('input', () => {
  const pass = DOM.passwordInput.value;
  let strength = 0;
  if (pass.length >= 8) strength += 25;
  if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) strength += 25;
  if (/[0-9]/.test(pass)) strength += 25;
  if (/[^A-Za-z0-9]/.test(pass)) strength += 25;

  const bar = document.getElementById('password-strength-bar');
  bar.style.width = strength + '%';
  bar.style.background = strength < 50 ? '#ff4d4d' : strength < 75 ? '#f39c12' : '#2ecc71';
});
