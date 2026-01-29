// ==================== WELCOME PAGE ====================
// Página de bienvenida con mensajes personalizados
// =====================================================

document.addEventListener('DOMContentLoaded', function () {
  const userNameElem = document.getElementById('userName');
  const userPointsElem = document.getElementById('userPoints');
  const welcomeTitle = document.querySelector('.welcome-title');
  const welcomeMessage = document.getElementById('welcome-message');
  const continueBtn = document.getElementById('continue-btn');
  const container = document.querySelector('.welcome-container');

  // Mensajes aleatorios de bienvenida
  const mensajes = [
    "😊 Nos alegra verte. Continúa tu aventura y gana más recompensas 🎁",
    "🚀 Prepárate para jugar, ganar y llevarte grandes recompensas.",
    "🎁 Hoy tenemos muchas recompensas para ti. ¿Qué esperas para entrar? 🤩",
    "👾 Nos alegra verte de nuevo. ¡La suerte y las recompensas te esperan! 🍀",
    "🔥 ¿Listo para otra ronda? Sigue explorando y consigue más recompensas 🏆"
  ];

  function isFirebaseReady() {
  return typeof firebase !== 'undefined' &&
         typeof firebase.auth === 'function' &&
         typeof firebase.firestore === 'function';
}

  function waitForFirebase(callback, maxAttempts = 60) {
  let attempts = 0;
  const check = setInterval(() => {
    attempts++;
    if (isFirebaseReady()) {
      clearInterval(check);
      callback();
    } else if (attempts >= maxAttempts) {
      clearInterval(check);
      console.error('Firebase no se cargó correctamente');
    }
  }, 100);
}

  waitForFirebase(() => {
    firebase.auth().onAuthStateChanged(async (user) => {
      if (!user) {
        window.location.href = 'index.html';
        return;
      }

      // Verificar email si es login por password
      if (!user.emailVerified && user.providerData[0]?.providerId === 'password') {
        alert('Por favor, verifica tu email para acceder.');
        await firebase.auth().signOut();
        window.location.href = 'index.html';
        return;
      }

      const userRef = firebase.firestore().collection('users').doc(user.uid);

      try {
        const snap = await userRef.get();

        // Determinar provider
        const providerId = user.providerData?.[0]?.providerId || 'email';
        const provider = providerId === 'password' ? 'email' : providerId;

        // Si no existe el usuario, crearlo
        if (!snap.exists) {
          await userRef.set({
            uid: user.uid,
            username: user.displayName || 'Usuario',
            email: user.email || '',
            provider,
            photoURL: user.photoURL || '',
            points: 100,
            level: 1,
            experience: 0,
            nextLevel: 200,
            gamesPlayed: 0,
            achievements: 0,
            sorteosParticipados: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });

          // Mensaje para usuario nuevo
          if (welcomeTitle) welcomeTitle.textContent = '¡Bienvenido!';
          if (welcomeMessage) welcomeMessage.textContent =
            '¡Bienvenido por primera vez! Estás a punto de comenzar una increíble aventura llena de recompensas y diversión.';
        } else {
          // Usuario existente - actualizar lastLogin
          await userRef.update({
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
          });

          // Mensaje aleatorio
          const mensajeAleatorio = mensajes[Math.floor(Math.random() * mensajes.length)];
          if (welcomeMessage) welcomeMessage.textContent = mensajeAleatorio;
        }

        // Leer datos actuales
        const finalSnap = await userRef.get();
        const data = finalSnap.data() || {};

        // Mostrar datos
        if (userNameElem) userNameElem.textContent = data.username || user.displayName || 'Usuario';
        animatePoints(typeof data.points === 'number' ? data.points : 100);

      } catch (err) {
        console.error('Error en welcome:', err);

        // Fallback: mostrar datos básicos
        if (userNameElem) userNameElem.textContent = user.displayName || 'Usuario';
        const msg = mensajes[Math.floor(Math.random() * mensajes.length)];
        if (welcomeMessage) welcomeMessage.textContent = msg;
        animatePoints(100);
      }
    });
  });

  // Animación de puntos
  function animatePoints(finalPoints) {
    if (!userPointsElem) return;

    const duration = 1200;
    const steps = 48;
    const increment = finalPoints / steps;
    let current = 0;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      current += increment;
      if (step >= steps) {
        current = finalPoints;
        clearInterval(timer);
      }
      userPointsElem.textContent = Math.floor(current).toLocaleString();
    }, duration / steps);
  }

  // Botón continuar
  if (continueBtn) {
    continueBtn.addEventListener('click', () => {
      continueBtn.classList.add('loading');
      continueBtn.innerHTML = 'Cargando... <i class="fas fa-spinner fa-spin"></i>';
      setTimeout(() => window.location.href = 'inicio.html', 800);
    });

    continueBtn.addEventListener('mouseenter', createParticles);
  }

  // Efectos hover en container
  if (container) {
    container.addEventListener('mouseenter', () => container.style.transform = 'scale(1.02)');
    container.addEventListener('mouseleave', () => container.style.transform = 'scale(1)');
  }

  // Partículas decorativas
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

  // Agregar animación CSS si no existe
  if (!document.getElementById('particle-float-style')) {
    const style = document.createElement('style');
    style.id = 'particle-float-style';
    style.textContent = `
      @keyframes particleFloat {
        0% { opacity: 1; transform: translateY(0) scale(1); }
        100% { opacity: 0; transform: translateY(-48px) scale(0); }
      }
    `;
    document.head.appendChild(style);
  }
});
