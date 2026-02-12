/* ============================================ */
/* CONSTANTES Y CONFIGURACIÓN */
/* ============================================ */
const POINTS_CACHE_KEY = "vg_points_cache";
const POINTS_CACHE_DURATION = 2 * 60 * 1000; // 2 minutos
const POINTS_TO_USD_RATE = 1000; // 1000 VirtualCoins = $1 USD
const MIN_REDEEM_POINTS = 20000; // $20 USD mínimo

/* ============================================ */
/* VARIABLES GLOBALES */
/* ============================================ */
let currentUserPoints = 0;
let currentUserId = null;

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
      console.log("✅ Usando puntos en caché");
      return data.points;
    }

    localStorage.removeItem(POINTS_CACHE_KEY);
    return null;
  } catch (e) {
    console.warn("Error leyendo caché de puntos:", e);
    return null;
  }
}

/**
 * Guarda los puntos en el caché local
 * @param {number} points - Cantidad de puntos
 */
function setCachedPoints(points) {
  try {
    localStorage.setItem(
      POINTS_CACHE_KEY,
      JSON.stringify({
        points: points,
        timestamp: Date.now(),
      })
    );
  } catch (e) {
    console.warn("Error al cachear puntos:", e);
  }
}

/* ============================================ */
/* CONVERSIÓN DE PUNTOS A USD */
/* ============================================ */

/**
 * Convierte puntos a dólares
 * @param {number} points - Cantidad de puntos
 * @returns {string} Cantidad en USD (2 decimales)
 */
function pointsToUSD(points) {
  return (points / POINTS_TO_USD_RATE).toFixed(2);
}

/**
 * Actualiza el valor en dólares mostrado en el header
 */
function updateDollarValue() {
  const dollarEl = document.getElementById("dollarValue");
  if (dollarEl) {
    dollarEl.textContent = pointsToUSD(currentUserPoints);
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
  return (
    typeof firebase !== "undefined" &&
    typeof firebase.auth === "function" &&
    typeof firebase.firestore === "function" &&
    window.auth &&
    window.db
  );
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
      console.error("Firebase timeout - redirigiendo a login");
      window.location.href = withAppFlag("index.html");
    }
  }, 100);
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
    window.db
      .collection("notifications")
      .where("userId", "==", uid)
      .where("read", "==", false)
      .get()
      .then((snapshot) => {
        const count = snapshot.size;
        const badge = document.getElementById("notificationBadge");
        if (badge) {
          badge.textContent = count;
          badge.style.display = count > 0 ? "flex" : "none";
        }
      });
  } catch (e) {
    console.error("Error cargando badge de notificaciones:", e);
  }
}

/* ============================================ */
/* GESTIÓN DE PUNTOS DEL USUARIO */
/* ============================================ */

/**
 * Carga los puntos del usuario desde Firestore
 * @param {string} userId - ID del usuario
 */
async function loadUserPoints(userId) {
  try {
    currentUserId = userId;

    // Mostrar caché primero si existe
    const cachedPoints = getCachedPoints();
    if (cachedPoints !== null) {
      currentUserPoints = cachedPoints;
      document.getElementById("totalPoints").textContent =
        cachedPoints.toLocaleString();
      updateDollarValue();
    }

    // Actualizar desde Firestore
    const doc = await window.db.collection("users").doc(userId).get();

    if (doc.exists) {
      const data = doc.data();
      const points = data.points || 0;

      currentUserPoints = points;
      document.getElementById("totalPoints").textContent = points.toLocaleString();
      setCachedPoints(points);
      updateDollarValue();

      checkDailyReward(userId, data.lastDailyReward);
    }
  } catch (error) {
    console.error("Error al cargar puntos:", error);
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
  const today = new Date().toDateString();
  const lastRewardDate = lastReward ? new Date(lastReward.toDate()).toDateString() : null;

  const btn = document.getElementById("dailyRewardBtn");
  if (!btn) return;

  if (lastRewardDate === today) {
    btn.textContent = "✓ Ya reclamado hoy";
    btn.disabled = true;
    btn.style.opacity = "0.55";
    btn.style.pointerEvents = "none";
  } else {
    btn.onclick = () => claimDailyReward(userId);
  }
}

/**
 * Reclama la recompensa diaria del usuario
 * @param {string} userId - ID del usuario
 */
async function claimDailyReward(userId) {
  try {
    const btn = document.getElementById("dailyRewardBtn");
    if (!btn) return;

    btn.textContent = "Reclamando...";
    btn.disabled = true;

    const userRef = window.db.collection("users").doc(userId);
    const doc = await userRef.get();
    const currentPoints = doc.data() && doc.data().points ? doc.data().points : 0;
    const newPoints = currentPoints + 500;

    await userRef.update({
      points: newPoints,
      lastDailyReward: firebase.firestore.FieldValue.serverTimestamp(),
    });

    await window.db.collection("pointsHistory").add({
      userId: userId,
      action: "Recompensa diaria",
      points: 25,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    });

    currentUserPoints = newPoints;
    document.getElementById("totalPoints").textContent = newPoints.toLocaleString();
    setCachedPoints(newPoints);
    updateDollarValue();

    btn.textContent = "✓ ¡Reclamado!";
    btn.style.background = "#10b981";

    setTimeout(() => location.reload(), 2000);
  } catch (error) {
    console.error("Error al reclamar recompensa:", error);
    alert("Error al reclamar la recompensa. Por favor, intenta de nuevo.");
  }
}

/* ============================================ */
/* MODAL DE CANJE */
/* ============================================ */

/**
 * Abre el modal de canje por PayPal
 */
function openPaypalModal() {
  if (currentUserPoints < MIN_REDEEM_POINTS) {
    alert(
      `Necesitas al menos ${MIN_REDEEM_POINTS.toLocaleString()} VirtualCoins para canjear por PayPal.\n\nTus VirtualCoins: ${currentUserPoints.toLocaleString()}`
    );
    return;
  }

  const modal = document.getElementById("paypalModal");
  const modalPoints = document.getElementById("modalPoints");
  if (!modal || !modalPoints) return;

  modalPoints.textContent = currentUserPoints.toLocaleString();
  modal.classList.add("active");
  document.body.style.overflow = "hidden";
}

/**
 * Cierra el modal de canje
 */
function closePaypalModal() {
  const modal = document.getElementById("paypalModal");
  if (!modal) return;

  modal.classList.remove("active");
  document.body.style.overflow = "";

  // Limpiar formulario
  const form = document.getElementById("paypalForm");
  if (form) form.reset();

  const usdEl = document.getElementById("usdAmount");
  if (usdEl) usdEl.textContent = "0.00";
}

/**
 * Actualiza el monto en USD mientras el usuario escribe
 */
function updateUSDAmount() {
  const pointsInput = document.getElementById("pointsAmount");
  const usdEl = document.getElementById("usdAmount");
  if (!pointsInput || !usdEl) return;

  const points = parseInt(pointsInput.value, 10) || 0;
  usdEl.textContent = pointsToUSD(points);
}

/**
 * Procesa el canje por PayPal
 * @param {Event} e - Evento del formulario
 */
async function processPaypalRedeem(e) {
  e.preventDefault();

  const fullName = document.getElementById("fullName").value.trim();
  const paypalEmail = document.getElementById("paypalEmail").value.trim();
  const pointsAmount = parseInt(document.getElementById("pointsAmount").value, 10);

  // Validaciones
  if (!fullName || fullName.length < 3) {
    alert("Por favor, ingresa tu nombre completo.");
    return;
  }

  if (!paypalEmail || !validateEmail(paypalEmail)) {
    alert("Por favor, ingresa un correo válido.");
    return;
  }

  if (!pointsAmount || pointsAmount < MIN_REDEEM_POINTS) {
    alert(`La cantidad mínima para canjear es ${MIN_REDEEM_POINTS.toLocaleString()} VirtualCoins.`);
    return;
  }

  if (pointsAmount > currentUserPoints) {
    alert(
      `No tienes suficientes VirtualCoins.\n\nTus VirtualCoins: ${currentUserPoints.toLocaleString()}\nIntentando canjear: ${pointsAmount.toLocaleString()}`
    );
    return;
  }

if (pointsAmount % 1000 !== 0) {
  alert('La cantidad debe ser múltiplo de 1000 VirtualCoins.');
  return;
}

  // Confirmar
  const usdAmount = pointsToUSD(pointsAmount);
  const confirmed = confirm(
    `¿Confirmas el canje?\n\n` +
      `VirtualCoins: ${pointsAmount.toLocaleString()}\n` +
      `Recibirás: $${usdAmount} USD\n` +
      `PayPal: ${paypalEmail}\n\n` +
      `Esta acción no se puede deshacer.`
  );

  if (!confirmed) return;

  try {
    const btn = document.getElementById("confirmRedeemBtn");
    if (!btn) return;

    btn.textContent = "Procesando...";
    btn.disabled = true;

    // Descontar puntos del usuario
    const newPoints = currentUserPoints - pointsAmount;
    await window.db.collection("users").doc(currentUserId).update({
      points: newPoints,
    });

    // Registrar en historial
    await window.db.collection("pointsHistory").add({
      userId: currentUserId,
      action: `Canje PayPal - $${usdAmount} USD`,
      points: -pointsAmount,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    });

    // Guardar solicitud de canje
    await window.db.collection("redeemRequests").add({
      userId: currentUserId,
      type: "paypal",
      fullName: fullName,
      paypalEmail: paypalEmail,
      pointsAmount: pointsAmount,
      usdAmount: parseFloat(usdAmount),
      status: "pending",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    // Actualizar UI
    currentUserPoints = newPoints;
    document.getElementById("totalPoints").textContent = newPoints.toLocaleString();
    setCachedPoints(newPoints);
    updateDollarValue();

    alert(
      `✅ ¡Solicitud de canje enviada!\n\n` +
        `Recibirás $${usdAmount} USD en tu cuenta PayPal (${paypalEmail}) en las próximas 24-48 horas.\n\n` +
        `VirtualCoins restantes: ${newPoints.toLocaleString()}`
    );

    closePaypalModal();
  } catch (error) {
    console.error("Error procesando canje:", error);
    alert("❌ Error al procesar el canje. Por favor, intenta de nuevo.");

    const btn = document.getElementById("confirmRedeemBtn");
    if (btn) {
      btn.textContent = "Confirmar Canje";
      btn.disabled = false;
    }
  }
}

/**
 * Valida un correo electrónico
 * @param {string} email - Email a validar
 * @returns {boolean} True si es válido
 */
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/* ============================================ */
/* AUTENTICACIÓN */
/* ============================================ */

/**
 * Verifica la autenticación del usuario y carga datos iniciales
 */
function checkAuth() {
  waitForFirebase(() => {
    window.auth.onAuthStateChanged((user) => {
      if (user) {
        loadUserPoints(user.uid);
        loadNotificationCount(user.uid);
      } else {
        window.location.href = withAppFlag("index.html");
      }
    });
  });
}

/* ============================================ */
/* EVENT LISTENERS */
/* ============================================ */

/**
 * Configura todos los event listeners
 */
function setupEventListeners() {
  // Botón de canje PayPal
  const redeemBtn = document.getElementById("redeemPaypalBtn");
  if (redeemBtn) {
    redeemBtn.addEventListener("click", openPaypalModal);
  }

  // Cerrar modal
  const closeBtn = document.getElementById("closeModalBtn");
  const cancelBtn = document.getElementById("cancelBtn");
  const backdrop = document.querySelector(".modal-backdrop");

  if (closeBtn) closeBtn.addEventListener("click", closePaypalModal);
  if (cancelBtn) cancelBtn.addEventListener("click", closePaypalModal);
  if (backdrop) backdrop.addEventListener("click", closePaypalModal);

  // Actualizar USD mientras escribe
  const pointsInput = document.getElementById("pointsAmount");
  if (pointsInput) {
    pointsInput.addEventListener("input", updateUSDAmount);
  }

  // Formulario de canje
  const form = document.getElementById("paypalForm");
  if (form) {
    form.addEventListener("submit", processPaypalRedeem);
  }

  // Cerrar modal con ESC
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const modal = document.getElementById("paypalModal");
      if (modal && modal.classList.contains("active")) {
        closePaypalModal();
      }
    }
  });
}

/* ============================================ */
/* INICIALIZACIÓN */
/* ============================================ */

// Iniciar cuando la página esté completamente cargada
window.addEventListener("load", () => {
  setupEventListeners();
  checkAuth();
});
