// Elementos DOM
const registerForm = document.getElementById('register-form');
const loginForm = document.getElementById('login-form');
const userInfo = document.getElementById('user-info');
const tabs = document.querySelectorAll('.tab');
const registerBtn = document.getElementById('register-btn');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirm-password');
const passwordStrengthBar = document.getElementById('password-strength-bar');
const notification = document.getElementById('notification');
const usernameInput = document.getElementById('username');
const emailInput = document.getElementById('email');
const loginEmailInput = document.getElementById('login-email');
const loginPasswordInput = document.getElementById('login-password');
const forgotPasswordLink = document.getElementById('forgot-password');
const googleLoginBtn = document.getElementById('google-login');
const facebookLoginBtn = document.getElementById('facebook-login');
const appleLoginBtn = document.getElementById('apple-login');
const emailVerificationContainer = document.getElementById('email-verification-container');
const recoveryContainer = document.getElementById('recovery-container');
const resendVerificationBtn = document.getElementById('resend-verification');
const continueToDashboardBtn = document.getElementById('continue-to-dashboard');
const cancelRecoveryBtn = document.getElementById('cancel-recovery');
const sendRecoveryEmailBtn = document.getElementById('send-recovery-email');

// Variables
let currentUser = null;

// Overlay
const overlay = document.createElement('div');
overlay.className = 'overlay';
document.body.appendChild(overlay);

// Funciones auxiliares
function showNotification(msg, isError = false) {
    if (!notification) return;
    
    notification.textContent = msg;
    notification.className = 'notification';
    if (isError) notification.classList.add('error');
    notification.classList.add('show');
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

function showModal(modal) {
    if (!modal) return;
    
    overlay.style.display = 'block';
    modal.classList.add('show');
    setTimeout(() => {
        modal.style.opacity = '1';
        modal.style.transform = 'translate(-50%, -50%) scale(1)';
    }, 10);
}

function hideModal(modal) {
    if (!modal) return;
    
    overlay.style.display = 'none';
    modal.style.opacity = '0';
    modal.style.transform = 'translate(-50%, -50%) scale(0.9)';
    setTimeout(() => {
        modal.classList.remove('show');
    }, 300);
}

// Enviar email de verificación
function sendEmailVerification(user) {
    user.sendEmailVerification()
        .then(() => {
            showNotification('Email de verificación enviado. Revisa tu bandeja de entrada.');
            showModal(emailVerificationContainer);
        })
        .catch(error => {
            console.error('Error al enviar email de verificación:', error);
            showNotification('Error al enviar email de verificación', true);
        });
}

// Verificar si el email está verificado
function checkEmailVerification(user) {
    user.reload().then(() => {
        if (user.emailVerified) {
            hideModal(emailVerificationContainer);
            window.location.href = 'dashboard.html';
        } else {
            showNotification('Por favor, verifica tu email antes de continuar');
        }
    }).catch(error => {
        console.error('Error al recargar usuario:', error);
        showNotification('Error al verificar el email', true);
    });
}

// Registro
registerBtn.addEventListener('click', () => {
    const username = usernameInput.value;
    const email = emailInput.value;
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    const termsAccepted = document.getElementById('terms').checked;

    if (!username || !email || !password || !confirmPassword) {
        showNotification('Completa todos los campos', true);
        return;
    }

    if (password !== confirmPassword) {
        showNotification('Las contraseñas no coinciden', true);
        return;
    }

    if (password.length < 8) {
        showNotification('La contraseña debe tener al menos 8 caracteres', true);
        return;
    }

    if (!termsAccepted) {
        showNotification('Debes aceptar los términos y condiciones', true);
        return;
    }

    registerBtn.disabled = true;
    registerBtn.textContent = 'Creando cuenta...';

    auth.createUserWithEmailAndPassword(email, password)
        .then(userCredential => {
            const user = userCredential.user;
            currentUser = user;
            
            // Actualizar perfil con el nombre de usuario
            return user.updateProfile({
                displayName: username
            }).then(() => {
                // Guardar usuario en Firestore
                return db.collection('users').doc(user.uid).set({
                    username: username,
                    email: email,
                    points: 100,
                    level: 1,
                    experience: 0,
                    nextLevel: 200,
                    joinDate: new Date(),
                    lastLogin: new Date(),
                    emailVerified: false
                });
            });
        })
        .then(() => {
            // Enviar email de verificación
            sendEmailVerification(currentUser);
            showNotification('¡Cuenta creada con éxito!');
        })
        .catch(error => {
            let msg = 'Error al crear la cuenta';
            if (error.code === 'auth/email-already-in-use') msg = 'Correo ya en uso';
            if (error.code === 'auth/invalid-email') msg = 'Correo no válido';
            if (error.code === 'auth/weak-password') msg = 'Contraseña débil';
            showNotification(msg, true);
        })
        .finally(() => {
            registerBtn.disabled = false;
            registerBtn.textContent = 'Crear cuenta';
        });
});

// Login
loginBtn.addEventListener('click', () => {
    const email = loginEmailInput.value;
    const password = loginPasswordInput.value;

    if (!email || !password) {
        showNotification('Completa todos los campos', true);
        return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = 'Iniciando sesión...';

    auth.signInWithEmailAndPassword(email, password)
        .then(userCredential => {
            const user = userCredential.user;
            
            // Verificar si el email está verificado
            if (!user.emailVerified) {
                showNotification('Por favor, verifica tu email antes de iniciar sesión', true);
                currentUser = user;
                sendEmailVerification(user);
                throw new Error('Email no verificado');
            }

            // Actualizar último login
            return db.collection('users').doc(user.uid).update({
                lastLogin: new Date()
            });
        })
        .then(() => {
            window.location.href = 'dashboard.html';
        })
        .catch(error => {
            let msg = 'Error al iniciar sesión';
            if (error.code === 'auth/user-not-found') msg = 'Usuario no encontrado';
            if (error.code === 'auth/wrong-password') msg = 'Contraseña incorrecta';
            if (error.message === 'Email no verificado') return; // Ya mostramos notificación
            
            showNotification(msg, true);
        })
        .finally(() => {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Iniciar sesión';
        });
});

// Reenviar verificación
resendVerificationBtn.addEventListener('click', () => {
    if (currentUser) {
        resendVerificationBtn.disabled = true;
        resendVerificationBtn.textContent = 'Enviando...';
        
        sendEmailVerification(currentUser);
        
        setTimeout(() => {
            resendVerificationBtn.disabled = false;
            resendVerificationBtn.textContent = 'Reenviar verificación';
        }, 3000);
    }
});

// Continuar al dashboard (para usuarios que ya verificaron)
continueToDashboardBtn.addEventListener('click', () => {
    if (currentUser) {
        checkEmailVerification(currentUser);
    }
});

// Recuperar contraseña
function recoverPassword() {
    const email = document.getElementById('recovery-email').value;
    if (!email) return showNotification('Por favor, ingresa tu correo electrónico', true);

    sendRecoveryEmailBtn.disabled = true;
    sendRecoveryEmailBtn.textContent = 'Enviando...';

    auth.sendPasswordResetEmail(email)
        .then(() => {
            showNotification('Enlace de recuperación enviado');
            hideModal(recoveryContainer);
        })
        .catch(error => {
            let msg = 'Error al enviar el email de recuperación';
            if (error.code === 'auth/user-not-found') msg = 'No existe una cuenta con este correo';
            showNotification(msg, true);
        })
        .finally(() => {
            sendRecoveryEmailBtn.disabled = false;
            sendRecoveryEmailBtn.textContent = 'Enviar enlace de recuperación';
        });
}

// Tabs
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const tabId = tab.getAttribute('data-tab');
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.form-container').forEach(f => f.classList.remove('active'));
        document.getElementById(`${tabId}-form`).classList.add('active');
    });
});

// Forgot password
forgotPasswordLink.addEventListener('click', e => {
    e.preventDefault();
    showModal(recoveryContainer);
});

cancelRecoveryBtn.addEventListener('click', () => hideModal(recoveryContainer));
sendRecoveryEmailBtn.addEventListener('click', recoverPassword);

// Login con redes sociales
googleLoginBtn.addEventListener('click', () => showNotification('Login con Google (pendiente)'));
facebookLoginBtn.addEventListener('click', () => showNotification('Login con Facebook (pendiente)'));
appleLoginBtn.addEventListener('click', () => showNotification('Login con Apple (pendiente)'));

// Verificar fortaleza de la contraseña
if (passwordInput) {
    passwordInput.addEventListener('input', function () {
        const password = this.value;
        let strength = 0;

        if (password.length >= 8) strength += 25;
        if (password.match(/([a-z].*[A-Z])|([A-Z].*[a-z])/)) strength += 25;
        if (password.match(/([0-9])/)) strength += 25;
        if (password.match(/([!,@,#,$,%,^,&,*,?,_,~])/)) strength += 25;

        if (passwordStrengthBar) {
            passwordStrengthBar.style.width = strength + '%';

            if (strength < 50) {
                passwordStrengthBar.style.backgroundColor = '#e74c3c';
            } else if (strength < 75) {
                passwordStrengthBar.style.backgroundColor = '#f39c12';
            } else {
                passwordStrengthBar.style.backgroundColor = '#2ecc71';
            }
        }
    });
}

// Verificar autenticación y redirigir
auth.onAuthStateChanged((user) => {
    if (user && user.emailVerified && window.location.pathname.includes('index.html')) {
        window.location.href = 'dashboard.html';
    }
    
    // Ocultar user-info si no hay usuario (para logout)
    if (!user && userInfo) {
        userInfo.classList.remove('active');
    }
});

// Cerrar modal al hacer clic en overlay
overlay.addEventListener('click', () => {
    hideModal(emailVerificationContainer);
    hideModal(recoveryContainer);
});

// Cerrar modales con ESC key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        hideModal(emailVerificationContainer);
        hideModal(recoveryContainer);
    }
});