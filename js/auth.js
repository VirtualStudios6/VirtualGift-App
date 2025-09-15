// ----------------------------
// DOM References
// ----------------------------
const DOM = {
  loginForm: document.getElementById('login-form'),
  registerForm: document.getElementById('register-form'),
  loginBtn: document.getElementById('login-btn'),
  registerBtn: document.getElementById('register-btn'),
  notification: document.getElementById('notification'),
  username: document.getElementById('username'),
  email: document.getElementById('email'),
  password: document.getElementById('password'),
  confirmPassword: document.getElementById('confirm-password'),
  loginEmail: document.getElementById('login-email'),
  loginPassword: document.getElementById('login-password'),
  forgotPasswordLink: document.getElementById('forgot-password'),
  recoveryContainer: document.getElementById('recovery-container'),
  recoveryEmail: document.getElementById('recovery-email'),
  sendRecoveryEmailBtn: document.getElementById('send-recovery-email'),
  cancelRecoveryBtn: document.getElementById('cancel-recovery'),
  showRegister: document.getElementById('show-register'),
  showLogin: document.getElementById('show-login'),
  termsCheckbox: document.getElementById('terms')
};

let currentUser = null;

// ----------------------------
// Notification
// ----------------------------
function showNotification(message, type = 'success') {
  DOM.notification.textContent = message;
  DOM.notification.className = `notification show ${type}`;
  setTimeout(() => DOM.notification.classList.remove('show'), 3500);
}

// ----------------------------
// Validation
// ----------------------------
function validateField(input, errorId, message, condition) {
  const errorEl = document.getElementById(errorId);
  if (!condition) {
    errorEl && (errorEl.textContent = message);
    input.classList.add('invalid');
    return false;
  } else {
    errorEl && (errorEl.textContent = '');
    input.classList.remove('invalid');
    return true;
  }
}

// ----------------------------
// Form Toggle
// ----------------------------
DOM.showRegister.addEventListener('click', e => {
  e.preventDefault();
  DOM.loginForm.classList.remove('active');
  DOM.registerForm.classList.add('active');
});

DOM.showLogin.addEventListener('click', e => {
  e.preventDefault();
  DOM.registerForm.classList.remove('active');
  DOM.loginForm.classList.add('active');
});

// ----------------------------
// Registration
// ----------------------------
DOM.registerBtn.addEventListener('click', async () => {
  const username = DOM.username.value.trim();
  const email = DOM.email.value.trim();
  const password = DOM.password.value;
  const confirmPass = DOM.confirmPassword.value;
  const termsAccepted = DOM.termsCheckbox.checked;

  const validUser = validateField(DOM.username, 'username-error', 'Elige un nombre de usuario', username !== '');
  const validEmail = validateField(DOM.email, 'email-error', 'Correo inválido', /\S+@\S+\.\S+/.test(email));
  const validPass = validateField(DOM.password, 'password-error', 'Mínimo 8 caracteres', password.length >= 8);
  const validConfirm = validateField(DOM.confirmPassword, 'confirm-password-error', 'No coinciden', password === confirmPass);
  const validTerms = validateField(DOM.termsCheckbox, 'terms-error', 'Debes aceptar los términos', termsAccepted);

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
  } catch (error) {
    console.error(error);
    showNotification(error.message || 'Error al registrar', 'error');
  }
});

// ----------------------------
// Login
// ----------------------------
DOM.loginBtn.addEventListener('click', async () => {
  const email = DOM.loginEmail.value.trim();
  const password = DOM.loginPassword.value;

  if (!email || !password) return showNotification('Completa todos los campos', 'error');

  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    const user = userCredential.user;

    if (!user.emailVerified) return showNotification('Verifica tu correo antes de entrar', 'error');

    await db.collection('users').doc(user.uid).update({ lastLogin: new Date() });
    window.location.href = 'dashboard.html';
  } catch (error) {
    console.error(error);
    showNotification(error.message || 'Error al iniciar sesión', 'error');
  }
});

// ----------------------------
// Password Recovery
// ----------------------------
DOM.forgotPasswordLink.addEventListener('click', e => {
  e.preventDefault();
  DOM.recoveryContainer.classList.add('show');
});

DOM.sendRecoveryEmailBtn.addEventListener('click', async () => {
  const email = DOM.recoveryEmail.value.trim();
  if (!email) return showNotification('Ingresa tu correo', 'error');

  try {
    await auth.sendPasswordResetEmail(email);
    showNotification('Correo de recuperación enviado');
    DOM.recoveryContainer.classList.remove('show');
  } catch (error) {
    console.error(error);
    showNotification(error.message || 'Error al enviar correo', 'error');
  }
});

DOM.cancelRecoveryBtn.addEventListener('click', () => {
  DOM.recoveryContainer.classList.remove('show');
});

// ----------------------------
// Password Strength
// ----------------------------
DOM.password.addEventListener('input', () => {
  const pass = DOM.password.value;
  let strength = 0;
  if (pass.length >= 8) strength += 25;
  if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) strength += 25;
  if (/[0-9]/.test(pass)) strength += 25;
  if (/[^A-Za-z0-9]/.test(pass)) strength += 25;

  const bar = document.getElementById('password-strength-bar');
  bar.style.width = `${strength}%`;
  bar.style.background = strength < 50 ? '#f43f5e' : strength < 75 ? '#f59e0b' : '#10b981';
});
