document.addEventListener('DOMContentLoaded', function() {
    // Referencias a elementos del DOM
    const userNameElem    = document.getElementById('userName');
    const userPointsElem  = document.getElementById('userPoints');
    const welcomeTitle    = document.querySelector('.welcome-title');
    const welcomeMessage  = document.getElementById('welcome-message');
    const continueBtn     = document.getElementById('continue-btn');
    const container       = document.querySelector('.welcome-container');

    // Lista de mensajes aleatorios
    const mensajes = [
        "😊 Nos alegra verte. Continúa tu aventura y gana más recompensas 🎁",
        "🚀 Prepárate para jugar, ganar y llevarte grandes recompensas.",
        "🎁 Hoy tenemos muchas recompensas para ti. ¿Qué esperas para entrar? 🤩",
        "👾 Nos alegra verte de nuevo. ¡La suerte y las recompensas te esperan! 🍀",
        "🔥 ¿Listo para otra ronda? Sigue explorando y consigue más recompensas 🏆"
    ];

    // Verificar que Firebase esté disponible
    function isFirebaseReady() {
        return typeof firebase !== 'undefined' && firebase.auth && firebase.firestore;
    }

    // Esperar a que Firebase esté listo
    function waitForFirebase(callback) {
        if (isFirebaseReady()) {
            callback();
        } else {
            setTimeout(() => waitForFirebase(callback), 100);
        }
    }

    // Inicializar
    waitForFirebase(() => {
        // Verifica sesión de usuario
        firebase.auth().onAuthStateChanged(async function(user) {
            if (!user) {
                window.location.href = 'index.html';
                return;
            }

            if (!user.emailVerified && user.providerData[0]?.providerId === 'password') {
                alert('Por favor, verifica tu email para acceder.');
                await firebase.auth().signOut();
                window.location.href = 'index.html';
                return;
            }

            // Buscar datos en Firestore
            firebase.firestore().collection('users').doc(user.uid).get()
                .then(doc => {
                    let isNewUser = false;
                    let userData;

                    if (doc.exists) {
                        userData = doc.data();
                    } else {
                        // Usuario nuevo
                        isNewUser = true;
                        userData = {
                            username: user.displayName || 'Usuario',
                            email: user.email,
                            points: 100,
                            level: 1,
                            experience: 0,
                            nextLevel: 200,
                            joinDate: firebase.firestore.FieldValue.serverTimestamp(),
                            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                        };
                        firebase.firestore().collection('users').doc(user.uid).set(userData);
                    }

                    // Mostrar nombre
                    if (userNameElem) {
                        userNameElem.textContent = userData.username || user.displayName || 'Usuario';
                    }

                    // Mensaje si es nuevo
                    if (isNewUser) {
                        if (welcomeTitle) welcomeTitle.textContent = '¡Bienvenido!';
                        if (welcomeMessage) welcomeMessage.textContent = '¡Bienvenido por primera vez! Estás a punto de comenzar una increíble aventura llena de recompensas y diversión.';
                    } else {
                        // Si no es nuevo → mensaje aleatorio
                        const mensajeAleatorio = mensajes[Math.floor(Math.random() * mensajes.length)];
                        if (welcomeMessage) welcomeMessage.textContent = mensajeAleatorio;
                    }

                    // Animar puntos
                    animatePoints(userData.points || 100);
                })
                .catch(error => {
                    console.error('Error al recuperar datos:', error);
                    if (userNameElem) userNameElem.textContent = user.displayName || 'Usuario';
                    animatePoints(100);

                    // En caso de error, también mostramos un mensaje aleatorio
                    const mensajeAleatorio = mensajes[Math.floor(Math.random() * mensajes.length)];
                    if (welcomeMessage) welcomeMessage.textContent = mensajeAleatorio;
                });
        });
    });

    // Animar puntos
    function animatePoints(finalPoints) {
        if (!userPointsElem) return;

        const duration = 1200;
        const steps = 48;
        const increment = finalPoints / steps;
        let currentPoints = 0, step = 0;

        const timer = setInterval(() => {
            step++;
            currentPoints += increment;
            if (step >= steps) {
                currentPoints = finalPoints;
                clearInterval(timer);
            }
            userPointsElem.textContent = Math.floor(currentPoints).toLocaleString();
        }, duration / steps);
    }

    // Botón continuar
    if (continueBtn) {
        continueBtn.addEventListener('click', () => {
            continueBtn.classList.add('loading');
            continueBtn.innerHTML = 'Cargando... <i class="fas fa-spinner fa-spin"></i>';

            setTimeout(() => {
                // Redirigir a inicio.html
                window.location.href = 'inicio.html';
            }, 800);
        });

        // Efecto hover de partículas
        continueBtn.addEventListener('mouseenter', createParticles);
    }

    // Escalado container
    if (container) {
        container.addEventListener('mouseenter', () => container.style.transform = 'scale(1.02)');
        container.addEventListener('mouseleave', () => container.style.transform = 'scale(1)');
    }

    // Partículas animadas
    function createParticles() {
        if (!container) return;

        for (let i = 0; i < 6; i++) {
            setTimeout(() => {
                const particle = document.createElement('div');
                particle.style.cssText = `
                    position: absolute;
                    width: 4px;
                    height: 4px;
                    background: var(--warning-color, #fbbf24);
                    border-radius: 50%;
                    pointer-events: none;
                    top: ${Math.random() * 100}%;
                    left: ${Math.random() * 100}%;
                    animation: particleFloat 1s ease-out forwards;
                    z-index: -1;
                `;
                container.appendChild(particle);
                setTimeout(() => particle.remove(), 1000);
            }, i * 70);
        }
    }

    // Animación partículas (solo si no existe ya el estilo)
    if (!document.getElementById('particle-float-style')) {
        const style = document.createElement('style');
        style.id = 'particle-float-style';
        style.textContent = `
        @keyframes particleFloat {
            0% { opacity: 1; transform: translateY(0) scale(1);}
            100% { opacity: 0; transform: translateY(-48px) scale(0);}
        }`;
        document.head.appendChild(style);
    }
});
