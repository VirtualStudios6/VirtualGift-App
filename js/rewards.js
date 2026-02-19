// js/rewards.js
// ==================== REWARDS ====================
// Funciones de recompensas compartidas de VirtualGift
// ✅ Sin recursión infinita en showNotification
// ✅ serverTimestamp en lugar de new Date()
// ✅ auth y db accedidos de forma segura (window.auth / window.db)
// =================================================

/* ------------------------------------------------ */
/* TOAST / NOTIFICACIÓN                              */
/* ------------------------------------------------ */

/**
 * Muestra un toast en pantalla.
 * No depende de ninguna función global externa para evitar recursión.
 */
function showRewardToast(message, isError = false) {
  let el = document.getElementById("vg-reward-toast");

  if (!el) {
    el = document.createElement("div");
    el.id = "vg-reward-toast";
    Object.assign(el.style, {
      position:     "fixed",
      left:         "50%",
      bottom:       "calc(18px + env(safe-area-inset-bottom))",
      transform:    "translateX(-50%)",
      background:   isError ? "rgba(239,68,68,.92)" : "rgba(28,31,47,.95)",
      border:       `1px solid ${isError ? "rgba(239,68,68,.5)" : "rgba(255,255,255,.10)"}`,
      padding:      "10px 18px",
      borderRadius: "999px",
      color:        "#dcefff",
      fontWeight:   "700",
      fontSize:     "14px",
      zIndex:       "9999",
      maxWidth:     "92vw",
      display:      "none",
      boxShadow:    "0 10px 35px rgba(0,0,0,.45)",
      transition:   "background .2s ease, border-color .2s ease",
      fontFamily:   "Inter, Roboto, Arial, sans-serif",
    });
    document.body.appendChild(el);
  } else {
    // Actualizar colores si cambia tipo (ok ↔ error)
    el.style.background   = isError ? "rgba(239,68,68,.92)"        : "rgba(28,31,47,.95)";
    el.style.borderColor  = isError ? "rgba(239,68,68,.5)"         : "rgba(255,255,255,.10)";
  }

  el.textContent    = message;
  el.style.display  = "block";

  clearTimeout(window.__rewardToastT);
  window.__rewardToastT = setTimeout(() => { el.style.display = "none"; }, 3000);
}

// Alias público (otros archivos pueden llamar window.showNotification)
// ✅ Sin auto-referencia: delega a showRewardToast directamente
window.showNotification = function(message, isError = false) {
  showRewardToast(message, isError);
};

/* ------------------------------------------------ */
/* UTILS INTERNAS                                    */
/* ------------------------------------------------ */

function getAuth() { return window.auth || null; }
function getDb()   { return window.db   || null; }

function safeNumber(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

/* ------------------------------------------------ */
/* REGISTRAR ACTIVIDAD                               */
/* ------------------------------------------------ */

/**
 * Guarda un evento en la colección `activities`.
 * @param {string} type  - 'points_earned' | 'reward_redeemed' | etc.
 * @param {number} points
 * @param {string} description
 */
function logRewardActivity(type, points, description) {
  const user = getAuth()?.currentUser;
  if (!user) return Promise.resolve();

  const db = getDb();
  if (!db) return Promise.resolve();

  return db.collection("activities").add({
    userId:      user.uid,
    type,
    points:      safeNumber(points, 0),
    description: String(description || ""),
    // ✅ serverTimestamp en lugar de new Date()
    timestamp:   firebase.firestore.FieldValue.serverTimestamp(),
  }).catch((err) => {
    console.error("[rewards] logRewardActivity error:", err);
  });
}

/* ------------------------------------------------ */
/* ACTUALIZAR UI DE PUNTOS                           */
/* ------------------------------------------------ */

/**
 * Lee los puntos del usuario desde Firestore y actualiza los elementos
 * con id "user-points", "level-progress" y "progress-text" si existen.
 */
function updateUserPointsUI() {
  const user = getAuth()?.currentUser;
  if (!user) return;

  const db = getDb();
  if (!db) return;

  db.collection("users").doc(user.uid).get()
    .then((doc) => {
      if (!doc.exists) return;
      const data = doc.data() || {};

      const pointsEl = document.getElementById("user-points");
      if (pointsEl) pointsEl.textContent = safeNumber(data.points, 0).toLocaleString();

      const levelProgress = document.getElementById("level-progress");
      const progressText  = document.getElementById("progress-text");

      if (levelProgress && progressText) {
        const exp       = safeNumber(data.experience, 0);
        const nextLevel = safeNumber(data.nextLevel, 200);
        const pct       = Math.min((exp / nextLevel) * 100, 100);

        levelProgress.style.width  = pct + "%";
        progressText.textContent   = `${exp}/${nextLevel} puntos`;
      }
    })
    .catch((err) => {
      console.error("[rewards] updateUserPointsUI error:", err);
    });
}

/* ------------------------------------------------ */
/* AGREGAR PUNTOS                                    */
/* ------------------------------------------------ */

/**
 * Suma `points` al usuario autenticado en Firestore.
 * @param {number} points
 * @param {string} activityDescription
 * @returns {Promise<number>} puntos sumados
 */
function addUserPoints(points, activityDescription = "") {
  const user = getAuth()?.currentUser;
  if (!user) {
    showRewardToast("Debes iniciar sesión para ganar puntos", true);
    return Promise.reject(new Error("Usuario no autenticado"));
  }

  const db = getDb();
  if (!db) {
    showRewardToast("Error de conexión", true);
    return Promise.reject(new Error("Firestore no disponible"));
  }

  const pts = safeNumber(points, 0);
  if (pts <= 0) return Promise.resolve(0);

  return db.collection("users").doc(user.uid).get()
    .then((doc) => {
      const now = firebase.firestore.FieldValue.serverTimestamp();

      if (doc.exists) {
        const d = doc.data() || {};
        return db.collection("users").doc(user.uid).update({
          points:     safeNumber(d.points, 0)     + pts,
          experience: safeNumber(d.experience, 0) + pts,
          updatedAt:  now,
        });
      }

      // Primera vez — crear documento mínimo
      return db.collection("users").doc(user.uid).set({
        uid:        user.uid,
        displayName: user.displayName || "Usuario",
        username:    user.displayName || "Usuario",
        email:       user.email || "",
        points:      pts,
        experience:  pts,
        level:       1,
        nextLevel:   200,
        createdAt:   now,
        updatedAt:   now,
      }, { merge: true });
    })
    .then(() => {
      if (activityDescription) {
        logRewardActivity("points_earned", pts, activityDescription);
      }
      showRewardToast(`🪙 +${pts} puntos`);
      updateUserPointsUI();
      checkLevelUp();
      return pts;
    })
    .catch((err) => {
      console.error("[rewards] addUserPoints error:", err);
      showRewardToast("Error al agregar puntos", true);
      throw err;
    });
}

/* ------------------------------------------------ */
/* CANJEAR RECOMPENSA                                */
/* ------------------------------------------------ */

/**
 * Descuenta `cost` puntos del usuario y registra la recompensa.
 * @param {string} rewardId
 * @param {number} cost
 * @param {string} rewardName
 * @returns {Promise<boolean>}
 */
function redeemReward(rewardId, cost, rewardName) {
  const user = getAuth()?.currentUser;
  if (!user) {
    showRewardToast("Debes iniciar sesión para canjear recompensas", true);
    return Promise.reject(new Error("Usuario no autenticado"));
  }

  const db = getDb();
  if (!db) {
    showRewardToast("Error de conexión", true);
    return Promise.reject(new Error("Firestore no disponible"));
  }

  const costNum = safeNumber(cost, 0);

  return db.collection("users").doc(user.uid).get()
    .then((doc) => {
      if (!doc.exists) throw new Error("Datos de usuario no encontrados");

      const d      = doc.data() || {};
      const points = safeNumber(d.points, 0);

      if (points < costNum) {
        throw new Error(`Necesitas ${costNum - points} puntos más para canjear esta recompensa`);
      }

      const now = firebase.firestore.FieldValue.serverTimestamp();

      return db.collection("users").doc(user.uid).update({
        points:    points - costNum,
        updatedAt: now,
      });
    })
    .then(() => {
      const now = firebase.firestore.FieldValue.serverTimestamp();
      return db.collection("user_rewards").add({
        userId:      user.uid,
        rewardId:    String(rewardId || ""),
        rewardName:  String(rewardName || ""),
        cost:        costNum,
        claimedDate: now,
        status:      "claimed",
      });
    })
    .then(() => {
      logRewardActivity("reward_redeemed", -costNum, `Canjeó: ${rewardName}`);
      showRewardToast(`✅ Canjeaste "${rewardName}" por ${costNum} puntos`);
      updateUserPointsUI();
      return true;
    })
    .catch((err) => {
      console.error("[rewards] redeemReward error:", err);
      showRewardToast(err.message || "Error al canjear recompensa", true);
      throw err;
    });
}

/* ------------------------------------------------ */
/* VERIFICAR NIVEL                                   */
/* ------------------------------------------------ */

/**
 * Verifica si el usuario debe subir de nivel y lo actualiza.
 */
function checkLevelUp() {
  const user = getAuth()?.currentUser;
  if (!user) return;

  const db = getDb();
  if (!db) return;

  db.collection("users").doc(user.uid).get()
    .then((doc) => {
      if (!doc.exists) return;
      const d = doc.data() || {};

      const exp       = safeNumber(d.experience, 0);
      const level     = safeNumber(d.level, 1);
      const nextLevel = safeNumber(d.nextLevel, 200);

      if (exp < nextLevel) return;

      const newLevel     = level + 1;
      const newNextLevel = nextLevel * 2;
      const bonusPoints  = 50;
      const now          = firebase.firestore.FieldValue.serverTimestamp();

      return db.collection("users").doc(user.uid).update({
        level:     newLevel,
        nextLevel: newNextLevel,
        points:    safeNumber(d.points, 0) + bonusPoints,
        updatedAt: now,
      }).then(() => {
        showRewardToast(`🏆 ¡Nivel ${newLevel}! +${bonusPoints} puntos bonus`);
        updateUserPointsUI();
        logRewardActivity("level_up", bonusPoints, `Subió al nivel ${newLevel}`);
      });
    })
    .catch((err) => {
      console.error("[rewards] checkLevelUp error:", err);
    });
}

/* ------------------------------------------------ */
/* EXPORTS                                           */
/* ------------------------------------------------ */

// Exponer para uso desde otros archivos
window.Rewards = {
  addPoints:       addUserPoints,
  redeemReward,
  updateUI:        updateUserPointsUI,
  checkLevelUp,
  logActivity:     logRewardActivity,
  showToast:       showRewardToast,
};
