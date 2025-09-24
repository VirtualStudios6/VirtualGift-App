// Asegúrate de que el script de Firebase y firebase-config.js están cargados antes de este archivo

document.addEventListener('DOMContentLoaded', function() {
    // Referencias a elementos del DOM
    const userNameElem    = document.getElementById('userName');
    const userPointsElem  = document.getElementById('userPoints');
    const welcomeTitle    = document.querySelector('.welcome-title');
    const welcomeMessage  = document.getElementById('welcome-message');
    const continueBtn     = document.getElementById('continue-btn');
    const container       = document.querySelector('.welcome-container');

    // Verifica sesión de usuario
    auth.onAuthStateChanged(async function(user) {
        if (!user) {
            // No autenticado, redirige al login
            window.location.href = 'index.html';
            return;
        }
        if (!user.emailVerified) {
            // No verificado, redirige y cierra sesión
            alert('Por favor, verifica tu email para acceder.');
            await auth.signOut();
            window.location.href = 'index.html';
            return;
        }

        // Buscar datos en Firestore
        db.collection('users').doc(user.uid).get()
            .then(doc => {
                let isNewUser = false;
                let userData;

                if (doc.exists) {
                    userData = doc.data();
                } else {
                    // Usuario nuevo, crea documento inicial
                    isNewUser = true;
                    userData = {
                        username: user.displayName || 'Usuario',
                        email: user.email,
                        points: 0,
                        level: 1,
                        experience: 0,
                        nextLevel: 100,
                        joined: firebase.firestore.FieldValue.serverTimestamp(),
                        lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                    };
                    db.collection('users').doc(user.uid).set(userData);
                }

                // Mostrar nombre
                userNameElem.textContent = userData.username || user.displayName || 'Usuario';

                // Mensaje y título si es nuevo
                if (isNewUser) {
                    welcomeTitle.textContent = '¡Bienvenido!';
                    welcomeMessage.textContent = '¡Bienvenido por primera vez! Estás a punto de comenzar una increíble aventura llena de recompensas y diversión.';
                }

                // Animar puntos
                animatePoints(userData.points || 0);

            })
            .catch(error => {
                console.error('Error al recuperar datos:', error);
                userNameElem.textContent = user.displayName || 'Usuario';
                animatePoints(0);
            });
    });

    // Animar puntos
    function animatePoints(finalPoints) {
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
    continueBtn.addEventListener('click', continueToDashboard);

    function continueToDashboard() {
        continueBtn.classList.add('loading');
        continueBtn.innerHTML = 'Cargando...';
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1000);
    }

    // Efecto hover de partículas
    continueBtn.addEventListener('mouseenter', createParticles);

    // Enter para continuar
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && document.activeElement !== continueBtn) {
            continueToDashboard();
        }
    });

    // Escalado container
    container.addEventListener('mouseenter', () => container.style.transform = 'scale(1.02)');
    container.addEventListener('mouseleave', () => container.style.transform = 'scale(1)');

    // Partículas animadas
    function createParticles() {
        for (let i = 0; i < 6; i++) {
            setTimeout(() => {
                const particle = document.createElement('div');
                particle.style.cssText = `
                    position: absolute;
                    width: 4px;
                    height: 4px;
                    background: var(--warning-color);
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