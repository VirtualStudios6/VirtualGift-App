// ==================== WELCOME PAGE (FIXED) ====================
// - Lee points SIEMPRE desde users/{uid}.points
// - Usa cache vg_points_cache (mismo que puntos.js)
// - Nombre: displayName || username || auth.displayName
// - Nunca vuelve a “caer” a 100 por errores
// =============================================================

const POINTS_CACHE_KEY = 'vg_points_cache';
const POINTS_CACHE_DURATION = 2 * 60 * 1000; // 2 minutos

document.addEventListener('DOMContentLoaded', () => {
  const userNameElem = document.getElementById('userName');
  const userPointsElem = document.getElementById('userPoints');
  const welcomeTitle = document.querySelector('.welcome-title');
  const welcomeMessage = document.getElementById('welcome-message');
  const continueBtn = document.getElementById('continue-btn');
  const container = document.querySelector('.welcome-container');

  const mensajes = [
    "😊 Nos alegra verte. Continúa tu aventura y gana más recompensas 🎁",
    "🚀 Prepárate para jugar, ganar y llevarte grandes recompensas.",
    "🎁 Hoy tenemos muchas recompensas para ti. ¿Qué esperas para entrar? 🤩",
    "👾 Nos alegra verte de nuevo. ¡La suerte y las recompensas te esperan! 🍀",
    "🔥 ¿Listo para otra ronda? Sigue explorando y consigue más recompensas 🏆"
  ];

  function safeNumber(n, fallback = 0) {
    const x = Number(n);
    return Number.isFinite(x) ? x : fallback;
  }

  function getCachedPoints() {
    try {
      const cached = localStorage.getItem(POINTS_CACHE_KEY);
      if (!cached) return null;
      const data = JSON.parse(cached);
      const age = Date.now() - data.timestamp;
      if (age < POINTS_CACHE_DURATION) return safeNumber(data.points, 0);
      return null;
    } catch {
      return null;
    }
  }

  function setCachedPoints(points) {
    try {
      localStorage.setItem(POINTS_CACHE_KEY, JSON.stringify({
        points: safeNumber(points, 0),
        timestamp: Date.now()
      }));
    } catch {}
  }

  function isFirebaseReady() {
    return typeof firebase !== 'undefined'
      && typeof firebase.auth === 'function'
      && typeof firebase.firestore === 'function';
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

  // Animación de puntos
  function animatePoints(finalPoints) {
    if (!userPointsElem) return;

    const final = safeNumber(finalPoints, 0);
    const duration = 900;
    const steps = 45;
    const increment = final / steps;

    let current = 0;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      current += increment;
      if (step >= steps) {
        current = final;
        clearInterval(timer);
      }
      userPointsElem.textContent = Math.floor(current).toLocaleString();
    }, duration / steps);
  }

  // Mostrar cache de inmediato (para evitar “100” por fallback)
  const cached = getCachedPoints();
  if (cached !== null) animatePoints(cached);

  waitForFirebase(() => {
    firebase.auth().onAuthStateChanged(async (user) => {
      if (!user) {
        window.location.href = 'index.html';
        return;
      }

      // (Opcional) Verificación de email para password
      if (!user.emailVerified && user.providerData?.[0]?.providerId === 'password') {
        alert('Por favor, verifica tu email para acceder.');
        await firebase.auth().signOut();
        window.location.href = 'index.html';
        return;
      }

      const db = firebase.firestore();
      const userRef = db.collection('users').doc(user.uid);

      try {
        const snap = await userRef.get();

        // provider
        const providerId = user.providerData?.[0]?.providerId || 'email';
        const provider = providerId === 'password' ? 'email' : providerId;

        // Si no existe el usuario, crearlo (solo primera vez)
        if (!snap.exists) {
          await userRef.set({
            uid: user.uid,
            // ✅ Guardamos ambos para compatibilidad: displayName y username
            displayName: user.displayName || 'Usuario',
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

          if (welcomeTitle) welcomeTitle.textContent = '¡Bienvenido!';
          if (welcomeMessage) welcomeMessage.textContent =
            '¡Bienvenido por primera vez! Estás a punto de comenzar una increíble aventura llena de recompensas y diversión.';
        } else {
          // Usuario existente - actualizar lastLogin
          await userRef.set({
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });

          const msg = mensajes[Math.floor(Math.random() * mensajes.length)];
          if (welcomeMessage) welcomeMessage.textContent = msg;
        }

        // ✅ Leer datos finales
        const finalSnap = await userRef.get();
        const data = finalSnap.data() || {};

        const displayName = data.displayName || data.username || user.displayName || 'Usuario';
        if (userNameElem) userNameElem.textContent = displayName;

        // ✅ Points robusto (acepta number o string)
        const points = safeNumber(data.points, 0);
        setCachedPoints(points);
        animatePoints(points);

      } catch (err) {
        console.error('Error en welcome:', err);

        // Fallback: auth + cache (NO 100)
        if (userNameElem) userNameElem.textContent = user.displayName || 'Usuario';
        const msg = mensajes[Math.floor(Math.random() * mensajes.length)];
        if (welcomeMessage) welcomeMessage.textContent = msg;

        const fallbackPoints = cached !== null ? cached : 0;
        animatePoints(fallbackPoints);
      }
    });
  });

  // Botón continuar
  if (continueBtn) {
    continueBtn.addEventListener('click', () => {
      continueBtn.classList.add('loading');
      continueBtn.innerHTML = 'Cargando... <i class="fas fa-spinner fa-spin"></i>';
      setTimeout(() => window.location.href = 'inicio.html', 600);
    });

    continueBtn.addEventListener('mouseenter', createParticles);
  }

  if (container) {
    container.addEventListener('mouseenter', () => container.style.transform = 'scale(1.02)');
    container.addEventListener('mouseleave', () => container.style.transform = 'scale(1)');
  }

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
