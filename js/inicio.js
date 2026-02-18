/* ============================================ */
/* CONSTANTES Y CONFIGURACIÓN */
/* ============================================ */
const NOTIF_CACHE_KEY = 'vg_notif_count';
const NOTIF_CACHE_DURATION = 2 * 60 * 1000; // 2 minutos

/* ============================================ */
/* GESTIÓN DE CACHÉ DE NOTIFICACIONES */
/* ============================================ */

/**
 * Obtiene el contador de notificaciones desde el caché local
 * @returns {number|null} El número de notificaciones o null si no hay caché válido
 */
function getCachedNotifCount() {
  try {
    const cached = localStorage.getItem(NOTIF_CACHE_KEY);
    if (!cached) return null;

    const data = JSON.parse(cached);
    const age = Date.now() - data.timestamp;

    if (age < NOTIF_CACHE_DURATION) {
      console.log('✅ Usando contador de notificaciones en caché');
      return data.count;
    }

    localStorage.removeItem(NOTIF_CACHE_KEY);
    return null;
  } catch (e) {
    console.warn('Error leyendo caché de notificaciones:', e);
    return null;
  }
}

/**
 * Guarda el contador de notificaciones en el caché local
 * @param {number} count - Número de notificaciones
 */
function setCachedNotifCount(count) {
  try {
    localStorage.setItem(NOTIF_CACHE_KEY, JSON.stringify({
      count: count,
      timestamp: Date.now()
    }));
  } catch (e) {
    console.warn('Error al cachear notificaciones:', e);
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
    && typeof firebase.firestore === 'function';
}

/**
 * Espera a que Firebase esté listo antes de ejecutar el callback
 * @param {Function} callback - Función a ejecutar cuando Firebase esté listo
 * @param {number} maxAttempts - Número máximo de intentos (default: 30)
 */
function waitForFirebase(callback, maxAttempts = 30) {
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

/* ============================================ */
/* GESTIÓN DE NOTIFICACIONES */
/* ============================================ */

/**
 * Actualiza el badge visual de notificaciones
 * @param {number} count - Número de notificaciones
 */
function updateBadge(count) {
  const badge = document.getElementById('notificationBadge');
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  }
}

/**
 * Obtiene el contador de notificaciones desde Firestore
 * @param {Object} user - Usuario autenticado de Firebase
 */
async function fetchNotificationCount(user) {
  try {
    const snapshot = await firebase.firestore()
      .collection('notifications')
      .where('userId', '==', user.uid)
      .where('read', '==', false)
      .get(); // Llamada única, NO listener

    const count = snapshot.size;
    updateBadge(count);
    setCachedNotifCount(count);

    console.log('✅ Notificaciones actualizadas:', count);
  } catch (err) {
    console.error("Error cargando notificaciones:", err);
  }
}

/**
 * Carga el contador de notificaciones (primero desde caché, luego desde Firestore)
 * @param {Object} user - Usuario autenticado de Firebase
 */
async function loadNotificationCount(user) {
  if (!isFirebaseReady()) return;

  // Primero intentar usar caché
  const cachedCount = getCachedNotifCount();
  if (cachedCount !== null) {
    updateBadge(cachedCount);
    // Actualizar en segundo plano
    fetchNotificationCount(user);
    return;
  }

  // Si no hay caché, cargar de Firestore
  await fetchNotificationCount(user);
}

/**
 * Configura el refresco de notificaciones al hacer click en el icono
 * @param {Object} user - Usuario autenticado de Firebase
 */
function setupNotificationRefresh(user) {
  const notifIcon = document.querySelector('.icon-notification');
  if (notifIcon) {
    notifIcon.addEventListener('click', () => {
      // Limpiar caché para forzar actualización en la próxima carga
      localStorage.removeItem(NOTIF_CACHE_KEY);
    });
  }
}

/* ============================================ */
/* AUTENTICACIÓN */
/* ============================================ */

/**
 * Verifica la autenticación del usuario y carga datos iniciales
 */
function checkAuth() {
  waitForFirebase(() => {
    firebase.auth().onAuthStateChanged((user) => {
      if (!user) {
        // No hay usuario autenticado, redirigir a login
        window.location.href = withAppFlag('index.html');
      } else {
        // Usuario autenticado, cargar notificaciones
        loadNotificationCount(user);
        setupNotificationRefresh(user);
      }
    });
  });
}

/* ============================================ */
/* INICIALIZACIÓN */
/* ============================================ */

// Iniciar cuando la página esté completamente cargada
window.addEventListener('load', checkAuth);
function renderShop(items) {
  const skinsGrid = document.getElementById("shopSkinsGrid");
  const emotesGrid = document.getElementById("shopEmotesGrid");
  if (!skinsGrid || !emotesGrid) return;

  const skins = items.filter((x) => x.kind === "skin").slice(0, 8);
  const emotes = items.filter((x) => x.kind === "emote").slice(0, 8);

  skinsGrid.innerHTML = skins
    .map(
      (it) => `
      <div class="skin-card">
        <div class="skin-badge">🔵 FORTNITE</div>
        <div class="skin-image">
          <img src="${it.imageUrl || ""}" alt="${it.name || "Skin"}" onerror="this.style.display='none'">
        </div>
        <p class="skin-name">${it.name || "Skin"}</p>
      </div>
    `
    )
    .join("");

  emotesGrid.innerHTML = emotes
    .map(
      (it) => `
      <div class="emote-card">
        <div class="emote-badge">🔵 FORTNITE</div>
        <div class="emote-image">
          <img src="${it.imageUrl || ""}" alt="${it.name || "Emote"}" onerror="this.style.display='none'">
        </div>
        <p class="emote-name">${it.name || "Emote"}</p>
        <div class="rating">⭐</div>
      </div>
    `
    )
    .join("");
}

function startShopRealtime() {
  // Espera a firebase-config.js (window.db)
  const wait = setInterval(() => {
    if (window.db && typeof window.db.collection === "function") {
      clearInterval(wait);

      window.db
        .collection("shopDailyItems")
        .orderBy("sort", "asc")
        .onSnapshot((snap) => {
          const items = [];
          snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
          renderShop(items);
        }, (err) => {
          console.error("shopDailyItems snapshot error:", err);
        });
    }
  }, 100);
}

window.addEventListener("load", startShopRealtime);
