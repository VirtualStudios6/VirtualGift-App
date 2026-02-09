/* ============================================ */
/* PUNTOS.JS (MEJORADO) - VirtualGift           */
/* - Evita crashes por elementos null           */
/* - Sin “race conditions” DOM vs Firebase      */
/* - Maneja índice faltante en pointsHistory    */
/* - UI helper + logs útiles                    */
/* ============================================ */

/* ============================================ */
/* CONSTANTES Y CONFIGURACIÓN */
/* ============================================ */
const POINTS_CACHE_KEY = 'vg_points_cache';
const POINTS_CACHE_DURATION = 2 * 60 * 1000; // 2 minutos
const DAILY_REWARD_AMOUNT = 25;

/* ============================================ */
/* HELPERS */
/* ============================================ */
function $(id) {
  return document.getElementById(id);
}

function setText(id, text) {
  // ✅ Evita romper si el elemento no existe aún
  const el = $(id);
  if (!el) return false;
  el.textContent = text;
  return true;
}

function safeNumber(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function logOnce(key, ...args) {
  const k = `__log_once_${key}`;
  if (window[k]) return;
  window[k] = true;
  console.log(...args);
}

/* ============================================ */
/* GESTIÓN DE CACHÉ DE PUNTOS */
/* ============================================ */

/**
 * Obtiene los puntos desde el caché local
 * @returns {number|null} Los puntos o null si no hay caché válido
 */
function getCachedPoints() {
  try {
    const cached = localStorage.getItem(POINTS_CACHE_KEY);
    if (!cached) return null;

    const data = JSON.parse(cached);
    const age = Date.now() - data.timestamp;

    if (age < POINTS_CACHE_DURATION) {
      console.log('✅ Usando puntos en caché');
      return safeNumber(data.points, 0);
    }

    localStorage.removeItem(POINTS_CACHE_KEY);
    return null;
  } catch (e) {
    console.warn('Error leyendo caché de puntos:', e);
    return null;
  }
}

/**
 * Guarda los puntos en el caché local
 * @param {number} points - Cantidad de puntos
 */
function setCachedPoints(points) {
  try {
    localStorage.setItem(POINTS_CACHE_KEY, JSON.stringify({
      points: safeNumber(points, 0),
      timestamp: Date.now()
    }));
  } catch (e) {
    console.warn('Error al cachear puntos:', e);
  }
}

/* ============================================ */
/* VERIFICACIÓN DE FIREBASE */
/* ============================================ */

/**
 * Verifica si Firebase está completamente inicializado
 * @returns {boolean} True si Firebase está listo
 */
function isFirebaseReady() {
  return typeof firebase !== 'undefined'
    && typeof firebase.auth === 'function'
    && typeof firebase.firestore === 'function'
    && window.auth && window.db;
}

/**
 * Espera a que Firebase esté listo antes de ejecutar el callback
 * @param {Function} callback - Función a ejecutar cuando Firebase esté listo
 * @param {number} maxAttempts - Número máximo de intentos (default: 30)
 */
function waitForFirebase(callback, maxAttempts = 60) {
  // ✅ Subimos intentos para que no falle en móviles lentos (6s)
  let attempts = 0;
  const check = setInterval(() => {
    attempts++;
    if (isFirebaseReady()) {
      clearInterval(check);
      callback();
    } else if (attempts >= maxAttempts) {
      clearInterval(check);
      console.error('Firebase timeout - redirigiendo a login');
      window.location.href = withAppFlag('index.html');
    }
  }, 100);
}

/**
 * Espera a que existan los elementos clave en el DOM
 * (evita que Firebase responda antes de que el HTML esté listo)
 */
function waitForDOMElements(ids, cb, maxAttempts = 60) {
  let attempts = 0;
  const check = setInterval(() => {
    attempts++;
    const ok = ids.every(id => !!$(id));
    if (ok) {
      clearInterval(check);
      cb();
    } else if (attempts >= maxAttempts) {
      clearInterval(check);
      // No rompemos, solo avisamos una vez
      logOnce('dom_missing', '⚠️ Algunos elementos no aparecieron en el DOM:', ids.filter(id => !$(id)));
      cb(); // seguimos para no dejar la app “muerta”
    }
  }, 50);
}

/* ============================================ */
/* GESTIÓN DE NOTIFICACIONES (BADGE) */
/* ============================================ */

/**
 * Carga y muestra el contador de notificaciones no leídas
 * @param {string} uid - ID del usuario
 */
function loadNotificationCount(uid) {
  try {
    window.db.collection('notifications')
      .where('userId', '==', uid)
      .where('read', '==', false)
      .get()
      .then(snapshot => {
        const count = snapshot.size;
        const badge = $('notificationBadge');
        if (badge) {
          badge.textContent = String(count);
          badge.style.display = count > 0 ? 'flex' : 'none';
        }
      })
      .catch(err => console.error("Error cargando badge de notificaciones:", err));
  } catch (e) {
    console.error("Error cargando badge de notificaciones:", e);
  }
}

/* ============================================ */
/* GESTIÓN DE PUNTOS DEL USUARIO */
/* ============================================ */

/**
 * Renderiza puntos (centralizado)
 */
function renderPoints(points) {
  const value = safeNumber(points, 0);
  // ✅ requestAnimationFrame reduce race conditions visuales
  requestAnimationFrame(() => {
    setText('totalPoints', value.toLocaleString());
  });
}

/**
 * Carga los puntos del usuario desde Firestore
 * @param {string} userId - ID del usuario
 */
async function loadUserPoints(userId) {
  try {
    // Mostrar caché primero si existe
    const cachedPoints = getCachedPoints();
    if (cachedPoints !== null) renderPoints(cachedPoints);

    // Actualizar desde Firestore
    const doc = await window.db.collection('users').doc(userId).get();

    if (!doc.exists) {
      console.warn('Usuario no existe en Firestore:', userId);
      renderPoints(cachedPoints ?? 0);
      return;
    }

    const data = doc.data() || {};
    const points = safeNumber(data.points, 0);

    renderPoints(points);
    setCachedPoints(points);

    checkDailyReward(userId, data.lastDailyReward);
  } catch (error) {
    console.error('Error al cargar puntos:', error);
  }
}

/* ============================================ */
/* RECOMPENSA DIARIA */
/* ============================================ */

/**
 * Verifica si el usuario ya reclamó la recompensa diaria hoy
 * @param {string} userId - ID del usuario
 * @param {Object} lastReward - Timestamp de la última recompensa
 */
function checkDailyReward(userId, lastReward) {
  const btn = $('dailyRewardBtn');
  if (!btn) return; // ✅ evita crash si falta el botón

  const today = new Date().toDateString();
  const lastRewardDate =
    lastReward && typeof lastReward.toDate === 'function'
      ? new Date(lastReward.toDate()).toDateString()
      : null;

  if (lastRewardDate === today) {
    btn.textContent = '✓ Ya reclamado hoy';
    btn.disabled = true;
    btn.style.background = '#374151';
    btn.style.cursor = 'not-allowed';
    btn.onclick = null;
  } else {
    btn.disabled = false;
    btn.style.cursor = 'pointer';
    btn.onclick = () => claimDailyReward(userId);
  }
}

/**
 * Reclama la recompensa diaria del usuario
 * @param {string} userId - ID del usuario
 */
async function claimDailyReward(userId) {
  const btn = $('dailyRewardBtn');
  if (!btn) return;

  try {
    btn.textContent = 'Reclamando...';
    btn.disabled = true;

    const userRef = window.db.collection('users').doc(userId);

    // ✅ Mejor práctica: transacción para evitar duplicados si se toca 2 veces o hay lag
    const newPoints = await window.db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const current = snap.exists ? safeNumber(snap.data()?.points, 0) : 0;

      const updated = current + DAILY_REWARD_AMOUNT;

      tx.set(userRef, {
        points: updated,
        lastDailyReward: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      return updated;
    });

    // Registrar en historial (fuera de la transacción, está bien)
    try {
      await window.db.collection('pointsHistory').add({
        userId,
        action: 'Recompensa diaria',
        points: DAILY_REWARD_AMOUNT,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) {
      console.warn('No se pudo registrar en pointsHistory (puede ser rules o índice):', e);
    }

    // Actualizar UI + cache
    renderPoints(newPoints);
    setCachedPoints(newPoints);

    btn.textContent = '✓ ¡Reclamado!';
    btn.style.background = '#10b981';

    setTimeout(() => location.reload(), 1200);
  } catch (error) {
    console.error('Error al reclamar recompensa:', error);
    btn.textContent = 'Reclamar Hoy';
    btn.disabled = false;
    alert('Error al reclamar la recompensa. Por favor, intenta de nuevo.');
  }
}

/* ============================================ */
/* HISTORIAL DE PUNTOS */
/* ============================================ */

/**
 * Carga el historial de movimientos de puntos del usuario
 * @param {string} userId - ID del usuario
 */
async function loadPointsHistory(userId) {
  const container = $('historyContainer');
  if (!container) return;

  try {
    const snapshot = await window.db.collection('pointsHistory')
      .where('userId', '==', userId)
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();

    if (snapshot.empty) {
      // dejar el empty-state del HTML
      return;
    }

    container.innerHTML = '';

    snapshot.forEach(d => {
      const data = d.data() || {};
      const item = document.createElement('div');
      item.className = 'history-item';

      const date = data.timestamp && typeof data.timestamp.toDate === 'function'
        ? data.timestamp.toDate()
        : new Date();

      const dateStr = date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });

      const delta = safeNumber(data.points, 0);

      item.innerHTML = `
        <div class="history-info">
          <div class="history-action">${String(data.action || 'Movimiento')}</div>
          <div class="history-date">${dateStr}</div>
        </div>
        <div class="history-points ${delta > 0 ? 'positive' : 'negative'}">
          ${delta > 0 ? '+' : ''}${delta}
        </div>
      `;

      container.appendChild(item);
    });
  } catch (error) {
    // ✅ Si falta el índice, Firestore lanza FAILED_PRECONDITION
    const msg = String(error?.message || '');
    if (msg.includes('FAILED_PRECONDITION') || msg.toLowerCase().includes('requires an index')) {
      logOnce('missing_index', '⚠️ Falta índice para pointsHistory (userId + timestamp). Crea el índice en Firestore.');
      return; // no spameamos el console
    }
    console.error('Error al cargar historial:', error);
  }
}

/* ============================================ */
/* AUTENTICACIÓN */
/* ============================================ */

/**
 * Verifica la autenticación del usuario y carga datos iniciales
 */
function checkAuth() {
  // ✅ Primero esperamos DOM clave, luego Firebase, luego auth
  waitForDOMElements(['totalPoints', 'historyContainer', 'dailyRewardBtn'], () => {
    waitForFirebase(() => {
      window.auth.onAuthStateChanged((user) => {
        if (user) {
          loadUserPoints(user.uid);
          loadPointsHistory(user.uid);
          loadNotificationCount(user.uid);
        } else {
          window.location.href = withAppFlag('index.html');
        }
      });
    });
  });
}

/* ============================================ */
/* INICIALIZACIÓN */
/* ============================================ */
window.addEventListener('load', checkAuth);
