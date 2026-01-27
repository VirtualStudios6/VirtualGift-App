// ==================== RULETA DE PREMIOS ====================
// Sistema de ruleta con costo de giro y premios
// ==========================================================

// ==================== CONFIGURACIÓN ====================
const SPIN_COST = 10; // Costo en puntos por cada giro

// ==================== ELEMENTOS DOM ====================
const backBtn = document.getElementById('back-btn');
const pointsDisplay = document.getElementById('points-display');
const spinBtn = document.getElementById('spin-btn');
const wheel = document.querySelector('.wheel-inner');
const spinsInfo = document.querySelector('.spins-info');

// ==================== ESTADO ====================
let currentUser = null;
let userData = {};
let spinning = false;

// ==================== NOTIFICACIONES ====================
function showNotification(msg, isError = false) {
  let notification = document.getElementById('notification');
  if (!notification) {
    notification = document.createElement('div');
    notification.id = 'notification';
    notification.className = 'notification';
    document.body.appendChild(notification);
  }
  notification.textContent = msg;
  notification.className = 'notification show';
  if (isError) notification.classList.add('error');
  setTimeout(() => notification.classList.remove('show'), 3000);
}

// ==================== CARGAR DATOS DE USUARIO ====================
async function loadUserData(user) {
  try {
    const doc = await db.collection('users').doc(user.uid).get();

    if (doc.exists) {
      userData = doc.data();
      updatePointsDisplay();
      console.log('✅ Datos de usuario cargados:', userData);
    } else {
      // Si no existe, crear usuario
      await createInitialUserData(user);
    }
  } catch (err) {
    console.error('❌ Error cargando datos:', err);
    showNotification('Error al cargar tus puntos', true);
  }
}

// ==================== CREAR USUARIO INICIAL ====================
async function createInitialUserData(user) {
  const initialData = {
    username: user.displayName || 'Usuario',
    email: user.email,
    points: 100,
    level: 1,
    experience: 0,
    nextLevel: 200,
    gamesPlayed: 0,
    achievements: 0,
    sorteosParticipados: 0,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    await db.collection('users').doc(user.uid).set(initialData);
    userData = initialData;
    updatePointsDisplay();
    console.log('✅ Usuario creado:', initialData);
  } catch (err) {
    console.error('❌ Error creando usuario:', err);
    showNotification('Error al crear perfil', true);
  }
}

// ==================== ACTUALIZAR DISPLAY ====================
function updatePointsDisplay() {
  if (pointsDisplay) {
    pointsDisplay.textContent = (userData.points || 0).toLocaleString();
  }
  if (spinsInfo) {
    spinsInfo.textContent = `Tienes ${userData.points || 0} puntos disponibles`;
  }

  // Actualizar estado del botón según puntos
  updateSpinButtonState();
}

// ==================== ACTUALIZAR ESTADO DEL BOTÓN ====================
function updateSpinButtonState() {
  if (!spinBtn) return;

  const hasEnoughPoints = (userData.points || 0) >= SPIN_COST;

  if (!hasEnoughPoints) {
    spinBtn.disabled = true;
    spinBtn.textContent = `Necesitas ${SPIN_COST} puntos`;
    spinBtn.style.opacity = '0.5';
    spinBtn.style.cursor = 'not-allowed';
  } else {
    spinBtn.disabled = false;
    spinBtn.textContent = `Girar (${SPIN_COST} puntos)`;
    spinBtn.style.opacity = '1';
    spinBtn.style.cursor = 'pointer';
  }
}

// ==================== AGREGAR PUNTOS ====================
async function addUserPoints(points, activityDescription) {
  try {
    const newPoints = (userData.points || 0) + points;
    const newExperience = (userData.experience || 0) + points;

    let levelUp = false;
    let newLevel = userData.level || 1;
    let newNextLevel = userData.nextLevel || 200;

    // Verificar si sube de nivel
    if (newExperience >= newNextLevel) {
      levelUp = true;
      newLevel++;
      newNextLevel *= 2;
    }

    // Actualizar datos locales
    userData.points = newPoints;
    userData.experience = newExperience;
    userData.level = newLevel;
    userData.nextLevel = newNextLevel;

    // Actualizar en Firestore
    await db.collection('users').doc(currentUser.uid).update({
      points: newPoints,
      experience: newExperience,
      level: newLevel,
      nextLevel: newNextLevel,
      lastLogin: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Mostrar notificación
    showNotification(levelUp
      ? `🎉 ¡Subiste al nivel ${newLevel}!`
      : `✨ +${points} puntos! ${activityDescription}`
    );

    updatePointsDisplay();
    console.log('✅ Puntos agregados:', points);

  } catch (err) {
    console.error('❌ Error actualizando puntos:', err);
    showNotification('Error al actualizar puntos', true);
  }
}

// ==================== GIRAR RULETA ====================
async function spinWheel() {
  if (spinning) {
    console.log('⚠️ Ya está girando');
    return;
  }

  // ✅ VERIFICAR PUNTOS SUFICIENTES
  if ((userData.points || 0) < SPIN_COST) {
    showNotification(`Necesitas al menos ${SPIN_COST} puntos para girar`, true);
    return;
  }

  spinning = true;
  spinBtn.disabled = true;
  spinBtn.textContent = 'Girando...';

  try {
    // ✅ DESCONTAR PUNTOS ANTES DE GIRAR
    const newPoints = userData.points - SPIN_COST;
    await db.collection('users').doc(currentUser.uid).update({
      points: newPoints,
      lastLogin: firebase.firestore.FieldValue.serverTimestamp()
    });

    userData.points = newPoints;
    updatePointsDisplay();

    console.log(`💰 ${SPIN_COST} puntos descontados. Quedan: ${newPoints}`);

  } catch (err) {
    console.error('❌ Error al descontar puntos:', err);
    showNotification('Error al procesar giro', true);
    spinning = false;
    spinBtn.disabled = false;
    updateSpinButtonState();
    return;
  }

  // Definir ángulo final aleatorio
  const spins = Math.floor(Math.random() * 5) + 5; // 5-9 vueltas
  const degrees = Math.floor(Math.random() * 360);
  const totalDegrees = (spins * 360) + degrees;

  // Animar ruleta
  wheel.style.transition = 'transform 4s cubic-bezier(0.17, 0.67, 0.83, 0.67)';
  wheel.style.transform = `rotate(${totalDegrees}deg)`;

  // Secciones de la ruleta (60° cada una = 6 secciones)
  const sections = [
    { name: 'Rojo', points: 50 },
    { name: 'Naranja', points: 30 },
    { name: 'Morado', points: 70 },
    { name: 'Azul Claro', points: 20 },
    { name: 'Azul', points: 40 },
    { name: 'Violeta', points: 60 }
  ];

  // Después de 4 segundos, determinar resultado
  setTimeout(() => {
    const finalDeg = totalDegrees % 360;
    const index = Math.floor(finalDeg / 60);
    const prize = sections[index];

    console.log(`🎯 Resultado: ${prize.name} - ${prize.points} puntos`);

    // Agregar puntos ganados
    handleSpinWin(prize.points, prize.name);

    // Reset visual de la ruleta
    wheel.style.transition = 'none';
    wheel.style.transform = `rotate(${finalDeg}deg)`;

    // Habilitar siguiente giro
    spinning = false;
    updateSpinButtonState();
  }, 4000);
}

// ==================== MANEJAR RESULTADO ====================
function handleSpinWin(points, sectionName) {
  addUserPoints(points, `Ganaste en la ruleta (${sectionName})`);
}

// ==================== BOTÓN VOLVER ====================
if (backBtn) {
  backBtn.addEventListener('click', () => {
    window.location.href = 'inicio.html'; // ✅ CORREGIDO (antes decía dashboard.html)
  });
}

// ==================== BOTÓN GIRAR ====================
if (spinBtn) {
  spinBtn.addEventListener('click', spinWheel);
}

// ==================== INICIALIZACIÓN ====================
if (typeof auth !== 'undefined') {
  auth.onAuthStateChanged(user => {
    if (user) {
      currentUser = user;
      loadUserData(user);
      console.log('✅ Usuario autenticado en ruleta:', user.email);
    } else {
      console.log('❌ No hay usuario autenticado, redirigiendo...');
      window.location.href = 'index.html';
    }
  });
} else {
  console.error('❌ Firebase Auth no está disponible');
  showNotification('Error al cargar servicios', true);
}
