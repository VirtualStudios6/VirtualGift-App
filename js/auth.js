// Elementos DOM
const DOM = {
    registerForm: document.getElementById('register-form'),
    loginForm: document.getElementById('login-form'),
    userInfo: document.getElementById('user-info'),
    tabs: document.querySelectorAll('.tab'),
    registerBtn: document.getElementById('register-btn'),
    loginBtn: document.getElementById('login-btn'),
    logoutBtn: document.getElementById('logout-btn'),
    passwordInput: document.getElementById('password'),
    confirmPasswordInput: document.getElementById('confirm-password'),
    passwordStrengthBar: document.getElementById('password-strength-bar'),
    notification: document.getElementById('notification'),
    usernameInput: document.getElementById('username'),
    emailInput: document.getElementById('email'),
    loginEmailInput: document.getElementById('login-email'),
    loginPasswordInput: document.getElementById('login-password'),
    forgotPasswordLink: document.getElementById('forgot-password'),
    googleLoginBtn: document.getElementById('google-login'),
    facebookLoginBtn: document.getElementById('facebook-login'),
    appleLoginBtn: document.getElementById('apple-login'),
    emailVerificationContainer: document.getElementById('email-verification-container'),
    recoveryContainer: document.getElementById('recovery-container'),
    resendVerificationBtn: document.getElementById('resend-verification'),
    continueToDashboardBtn: document.getElementById('continue-to-dashboard'),
    cancelRecoveryBtn: document.getElementById('cancel-recovery'),
    sendRecoveryEmailBtn: document.getElementById('send-recovery-email')
};

// Variables
let currentUser = null;

// Overlay
const overlay = document.createElement('div');
overlay.className = 'overlay';
document.body.appendChild(overlay);

// Mensajes de error Firebase
const firebaseErrors = {
    'auth/email-already-in-use': 'Correo ya en uso',
    'auth/invalid-email': 'Correo no válido',
    'auth/weak-password': 'Contraseña débil',
    'auth/user-not-found': 'Usuario no encontrado',
    'auth/wrong-password': 'Contraseña incorrecta'
};

// Funciones auxiliares
function showNotification(msg, isError = false) {
    if (!DOM.notification) return;
    DOM.notification.textContent = msg;
    DOM.notification.className = 'notification';
    if (isError) DOM.notification.classList.add('error');
    DOM.notification.classList.add('show');
    setTimeout(() => DOM.notification.classList.remove('show'), 3000);
}

function handleFirebaseError(error, defaultMsg) {
    showNotification(firebaseErrors[error.code] || defaultMsg, true);
}

function setButtonState(btn, text, disabled = false) {
    btn.disabled = disabled;
    btn.textContent = text;
}

function toggleModal(modal, show = true) {
    if (!modal) return;
    overlay.style.display = show ? 'block' : 'none';
    if (show) modal.classList.add('show');
    modal.style.opacity = show ? '1' : '0';
    modal.style.transform = show ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -50%) scale(0.9)';
    if (!show) setTimeout(() => modal.classList.remove('show'), 300);
}

// Enviar email de verificación
function sendEmailVerification(user) {
    user.sendEmailVerification()
        .then(() => {
            showNotification('Email de verificación enviado. Revisa tu bandeja de entrada.');
            toggleModal(DOM.emailVerificationContainer, true);
        })
        .catch(error => handleFirebaseError(error, 'Error al enviar email de verificación'));
}

// Comprobar verificación de email (MODIFICADA)
function checkEmailVerification(user, targetUrl = 'dashboard.html') {
    user.reload().then(() => {
        if (user.emailVerified) {
            toggleModal(DOM.emailVerificationContainer, false);
            // Redirigir a la URL objetivo
            window.location.href = targetUrl;
            // Limpiar el storage
            sessionStorage.removeItem('redirectAfterVerification');
        } else {
            showNotification('Por favor, verifica tu email antes de continuar');
        }
    }).catch(error => handleFirebaseError(error, 'Error al verificar el email'));
}

// Registro (MODIFICADO)
DOM.registerBtn.addEventListener('click', async () => {
    const username = DOM.usernameInput.value.trim();
    const email = DOM.emailInput.value.trim();
    const password = DOM.passwordInput.value;
    const confirmPassword = DOM.confirmPasswordInput.value;
    const termsAccepted = document.getElementById('terms').checked;

    if (!username || !email || !password || !confirmPassword) return showNotification('Completa todos los campos', true);
    if (password !== confirmPassword) return showNotification('Las contraseñas no coinciden', true);
    if (password.length < 8) return showNotification('La contraseña debe tener al menos 8 caracteres', true);
    if (!termsAccepted) return showNotification('Debes aceptar los términos', true);

    // OBTENER EL PARÁMETRO REDIRECT (NUEVO)
    const urlParams = new URLSearchParams(window.location.search);
    const redirectParam = urlParams.get('redirect');
    let targetUrl = redirectParam || 'dashboard.html';

    setButtonState(DOM.registerBtn, 'Creando cuenta...', true);

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        currentUser = user;

        await user.updateProfile({displayName: username});
        await db.collection('users').doc(user.uid).set({
            username, email, points: 100, level: 1, experience: 0,
            nextLevel: 200, joinDate: new Date(), lastLogin: new Date(), emailVerified: false
        });

        sendEmailVerification(user);
        showNotification('¡Cuenta creada con éxito!');
        
        // GUARDAR REDIRECCIÓN PARA DESPUÉS DE VERIFICACIÓN (NUEVO)
        sessionStorage.setItem('redirectAfterVerification', targetUrl);
    } catch (e) {
        handleFirebaseError(e, 'Error al crear la cuenta');
    } finally {
        setButtonState(DOM.registerBtn, 'Crear cuenta');
    }
});

// Login (MODIFICADO)
DOM.loginBtn.addEventListener('click', async () => {
    const email = DOM.loginEmailInput.value.trim();
    const password = DOM.loginPasswordInput.value;

    if (!email || !password) return showNotification('Completa todos los campos', true);

    // OBTENER EL PARÁMETRO REDIRECT (NUEVO)
    const urlParams = new URLSearchParams(window.location.search);
    const redirectParam = urlParams.get('redirect');
    let targetUrl = redirectParam || 'dashboard.html';

    setButtonState(DOM.loginBtn, 'Iniciando sesión...', true);

    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        currentUser = user;

        if (!user.emailVerified) {
            showNotification('Por favor, verifica tu email antes de iniciar sesión', true);
            sendEmailVerification(user);
            throw new Error('Email no verificado');
        }

        await db.collection('users').doc(user.uid).update({lastLogin: new Date()});
        
        // REDIRIGIR A LA URL OBJETIVO (NUEVO)
        window.location.href = targetUrl;
    } catch (e) {
        if (e.message !== 'Email no verificado') handleFirebaseError(e, 'Error al iniciar sesión');
    } finally {
        setButtonState(DOM.loginBtn, 'Iniciar sesión');
    }
});

// Reenviar verificación
DOM.resendVerificationBtn.addEventListener('click', () => {
    if (!currentUser) return;
    setButtonState(DOM.resendVerificationBtn, 'Enviando...', true);
    sendEmailVerification(currentUser);
    setTimeout(() => setButtonState(DOM.resendVerificationBtn, 'Reenviar verificación'), 3000);
});

// Continuar al dashboard (MODIFICADO)
DOM.continueToDashboardBtn.addEventListener('click', () => {
    if (!currentUser) return;
    
    // Obtener la URL de redirección guardada o usar dashboard por defecto
    const targetUrl = sessionStorage.getItem('redirectAfterVerification') || 'dashboard.html';
    
    checkEmailVerification(currentUser, targetUrl);
});

// Recuperar contraseña
function recoverPassword() {
    const email = document.getElementById('recovery-email').value.trim();
    if (!email) return showNotification('Por favor, ingresa tu correo electrónico', true);

    setButtonState(DOM.sendRecoveryEmailBtn, 'Enviando...', true);

    auth.sendPasswordResetEmail(email)
        .then(() => {
            showNotification('Enlace de recuperación enviado');
            toggleModal(DOM.recoveryContainer, false);
        })
        .catch(e => handleFirebaseError(e, 'Error al enviar el email de recuperación'))
        .finally(() => setButtonState(DOM.sendRecoveryEmailBtn, 'Enviar enlace de recuperación'));
}

// Tabs
DOM.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const tabId = tab.dataset.tab;
        DOM.tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.form-container').forEach(f => f.classList.remove('active'));
        document.getElementById(`${tabId}-form`).classList.add('active');
    });
});

// Forgot password
DOM.forgotPasswordLink.addEventListener('click', e => { e.preventDefault(); toggleModal(DOM.recoveryContainer, true); });
DOM.cancelRecoveryBtn.addEventListener('click', () => toggleModal(DOM.recoveryContainer, false));
DOM.sendRecoveryEmailBtn.addEventListener('click', recoverPassword);

// Social logins (pendientes)
[DOM.googleLoginBtn, DOM.facebookLoginBtn, DOM.appleLoginBtn].forEach(btn => 
    btn.addEventListener('click', () => showNotification(`Login con ${btn.id.split('-')[0]} (pendiente)`))
);

// Password strength
if (DOM.passwordInput) {
    DOM.passwordInput.addEventListener('input', function () {
        const password = this.value;
        let strength = 0;
        if (password.length >= 8) strength += 25;
        if (password.match(/([a-z].*[A-Z])|([A-Z].*[a-z])/)) strength += 25;
        if (password.match(/([0-9])/)) strength += 25;
        if (password.match(/([!,@,#,$,%,^,&,*,?,_,~])/)) strength += 25;

        if (DOM.passwordStrengthBar) {
            DOM.passwordStrengthBar.style.width = strength + '%';
            DOM.passwordStrengthBar.style.backgroundColor = strength < 50 ? '#e74c3c' : strength < 75 ? '#f39c12' : '#2ecc71';
        }
    });
}

// Auth state
auth.onAuthStateChanged(user => {
    if (user && user.emailVerified && window.location.pathname.includes('index.html')) {
        // Redirigir a dashboard o a la página por defecto
        window.location.href = 'dashboard.html';
    }
    if (!user && DOM.userInfo) DOM.userInfo.classList.remove('active');
});

// Modales y overlay
overlay.addEventListener('click', () => {
    toggleModal(DOM.emailVerificationContainer, false);
    toggleModal(DOM.recoveryContainer, false);
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        toggleModal(DOM.emailVerificationContainer, false);
        toggleModal(DOM.recoveryContainer, false);
    }
});

// FUNCIÓN PARA REDIRIGIR AL DASHBOARD DESDE OTRAS PÁGINAS (NUEVO)
function redirectToDashboard() {
    // Verificar si Firebase Auth está inicializado
    if (typeof auth === 'undefined') {
        console.error('Firebase Auth no está inicializado');
        window.location.href = 'index.html?redirect=dashboard.html';
        return;
    }
    
    const user = auth.currentUser;
    
    // Si ya está autenticado y verificado, va directo al dashboard
    if (user && user.emailVerified) {
        window.location.href = 'dashboard.html';
    } else {
        // Si no, va al login con redirección al dashboard
        window.location.href = 'index.html?redirect=dashboard.html';
    }
}