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
            window.location.href = 'index.html';
            return;
        }
        if (!user.emailVerified) {
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
                    // Usuario nuevo
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

                // Mensaje si es nuevo
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

    // Botón continuar (solo efecto visual, NO redirección forzada)
    continueBtn.addEventListener('click', () => {
        continueBtn.classList.add('loading');
        continueBtn.innerHTML = 'Cargando... <i class="fas fa-spinner fa-spin"></i>';
        setTimeout(() => {
            continueBtn.classList.remove('loading');
            continueBtn.innerHTML = 'Continuar <i class="fas fa-arrow-right"></i>';
            // ⚡ Importante: aquí NO redirigimos manualmente.
            // El botón ya tiene href="go:Inicio" en el HTML.
        }, 800);
    });

    // Efecto hover de partículas
    continueBtn.addEventListener('mouseenter', createParticles);

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
