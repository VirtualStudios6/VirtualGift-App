/* =========================================================
   NOTIFICACIONES - VirtualGift (DEBUG + FIX)
   - Minimal (sin tabs)
   - Fallback si falta índice / permisos
   ========================================================= */

(() => {
  let currentUserId = null;
  let allNotifications = [];

  // Pull to refresh
  let touchStartY = 0;
  let touchEndY = 0;
  let pullRefreshEl = null;

  // ---------- Utils ----------
  window.withAppFlag = function withAppFlag(url) {
    const isAndroidApp =
      document.documentElement.classList.contains("android-app") ||
      document.body.classList.contains("android-app");

    if (!isAndroidApp) return url;
    if (url.includes("app=android")) return url;

    const parts = url.split("#");
    const base = parts[0];
    const hash = parts[1] ? "#" + parts[1] : "";

    const fixed = base.includes("?") ? base + "&app=android" : base + "?app=android";
    return fixed + hash;
  };

  function isFirebaseReady() {
    return (
      typeof firebase !== "undefined" &&
      typeof firebase.auth === "function" &&
      typeof firebase.firestore === "function" &&
      window.auth &&
      window.db
    );
  }

  function waitForFirebase(callback, maxAttempts = 40) {
    let attempts = 0;
    const check = setInterval(() => {
      attempts++;
      if (isFirebaseReady()) {
        clearInterval(check);
        callback();
      } else if (attempts >= maxAttempts) {
        clearInterval(check);
        window.location.href = window.withAppFlag("index.html");
      }
    }, 100);
  }

  function $(id) {
    return document.getElementById(id);
  }

  function getTimeAgo(timestamp) {
    if (!timestamp) return "Ahora";

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return "Ahora";
    if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Hace ${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `Hace ${Math.floor(diff / 86400)} días`;

    return date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
  }

  function tsToMillis(ts) {
    if (!ts) return 0;
    if (typeof ts.toMillis === "function") return ts.toMillis();
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d instanceof Date ? d.getTime() : 0;
  }

  function showErrorBox(message) {
    const container = $("notificationsContainer");
    const loading = $("loadingContainer");
    if (loading) loading.style.display = "none";
    if (!container) return;

    container.style.display = "block";
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <div style="font-weight:900; margin-bottom:6px;">No se pudieron cargar las notificaciones</div>
        <div style="opacity:.9; word-break:break-word;">${message}</div>
      </div>
    `;
  }

  // ---------- UI ----------
  function updateBadgeCount() {
    const unreadCount = allNotifications.filter((n) => !n.read).length;
    const badge = $("badgeCount");
    if (!badge) return;

    badge.textContent = unreadCount;
    badge.style.display = unreadCount > 0 ? "flex" : "none";
  }

  function showEmptyState(message) {
    const container = $("notificationsContainer");
    const loading = $("loadingContainer");

    if (loading) loading.style.display = "none";
    if (!container) return;

    container.style.display = "block";
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔔</div>
        <div>${message}</div>
      </div>
    `;
  }

  function createNotificationItem(notification) {
    const div = document.createElement("div");
    div.className = `notification-item ${notification.read ? "" : "unread"}`;
    div.onclick = () => markAsRead(notification.id);

    const iconMap = {
      info: "📢",
      success: "✅",
      warning: "⚠️",
      gift: "🎁",
      system: "⚙️",
    };

    const icon = iconMap[notification.type] || "🔔";
    const timeAgo = getTimeAgo(notification.timestamp);

    div.innerHTML = `
      <div class="notification-icon ${notification.type || ""}">
        ${icon}
      </div>
      <div class="notification-content">
        <div class="notification-title">${notification.title || "Notificación"}</div>
        <div class="notification-message">${notification.message || ""}</div>
        <div class="notification-footer">
          <div class="notification-time">${timeAgo}</div>
          ${
            notification.actionUrl
              ? `
                <div class="notification-actions">
                  <button class="action-btn primary" data-action-url="${notification.actionUrl}">
                    ${notification.actionText || "Ver más"}
                  </button>
                  <button class="action-btn secondary" data-delete-id="${notification.id}">
                    Eliminar
                  </button>
                </div>
              `
              : ""
          }
        </div>
      </div>
    `;

    const primaryBtn = div.querySelector('[data-action-url]');
    if (primaryBtn) {
      primaryBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        handleAction(primaryBtn.getAttribute("data-action-url"));
      });
    }

    const deleteBtn = div.querySelector("[data-delete-id]");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteNotification(deleteBtn.getAttribute("data-delete-id"));
      });
    }

    return div;
  }

  function displayNotifications() {
    const container = $("notificationsContainer");
    const loading = $("loadingContainer");

    if (loading) loading.style.display = "none";
    if (!container) return;

    container.style.display = "block";
    container.innerHTML = "";

    const filtered = allNotifications; // ✅ minimal: siempre todo

    if (!filtered || filtered.length === 0) {
      showEmptyState("No hay notificaciones");
      return;
    }

    filtered.forEach((notification) => {
      container.appendChild(createNotificationItem(notification));
    });
  }

  // ---------- Firestore ----------
  async function fetchNotifications(userId) {
    // Intento #1: query “bonita” con orderBy (puede pedir índice)
    try {
      const snapshot = await window.db
        .collection("notifications")
        .where("userId", "==", userId)
        .orderBy("timestamp", "desc")
        .limit(50)
        .get();

      const arr = [];
      snapshot.forEach((doc) => arr.push({ id: doc.id, ...doc.data() }));
      return arr;
    } catch (e) {
      console.error("Query con orderBy falló:", e);

      // Intento #2: fallback SIN orderBy (no pide índice)
      const snapshot2 = await window.db
        .collection("notifications")
        .where("userId", "==", userId)
        .limit(50)
        .get();

      const arr2 = [];
      snapshot2.forEach((doc) => arr2.push({ id: doc.id, ...doc.data() }));

      // Ordena en el cliente
      arr2.sort((a, b) => tsToMillis(b.timestamp) - tsToMillis(a.timestamp));
      return arr2;
    }
  }

  async function loadNotifications(userId) {
    if (!window.db) return;

    try {
      const arr = await fetchNotifications(userId);

      allNotifications = arr;
      updateBadgeCount();
      displayNotifications();

      console.log("UID LOGUEADO:", userId);
      console.log("NOTIFICATIONS LOADED:", allNotifications.length, allNotifications);

    } catch (error) {
      console.error("Error al cargar notificaciones:", error);

      const msg = String(error && (error.message || error)) || "Error desconocido";

      // Mensajes típicos:
      // - Missing or insufficient permissions (reglas)
      // - The query requires an index (índice)
      showErrorBox(msg);
    }
  }

  async function markAsRead(notificationId) {
    if (!window.db) return;

    try {
      await window.db.collection("notifications").doc(notificationId).update({ read: true });

      const n = allNotifications.find((x) => x.id === notificationId);
      if (n) n.read = true;

      updateBadgeCount();
      displayNotifications();
    } catch (error) {
      console.error("Error al marcar como leída:", error);
    }
  }

  window.markAllAsRead = async function markAllAsRead() {
    if (!window.db || !currentUserId) return;

    try {
      const batch = window.db.batch();
      const unread = allNotifications.filter((n) => !n.read);

      unread.forEach((n) => {
        const ref = window.db.collection("notifications").doc(n.id);
        batch.update(ref, { read: true });
        n.read = true;
      });

      await batch.commit();
      updateBadgeCount();
      displayNotifications();
    } catch (error) {
      console.error("Error al marcar todas:", error);
    }
  };

  async function deleteNotification(notificationId) {
    if (!window.db) return;

    try {
      await window.db.collection("notifications").doc(notificationId).delete();
      allNotifications = allNotifications.filter((n) => n.id !== notificationId);
      updateBadgeCount();
      displayNotifications();
    } catch (error) {
      console.error("Error al eliminar:", error);
    }
  }

  function handleAction(url) {
    window.location.href = window.withAppFlag(url);
  }

  // ---------- Auth ----------
  function checkAuth() {
    waitForFirebase(() => {
      window.auth.onAuthStateChanged((user) => {
        if (user) {
          currentUserId = user.uid;
          loadNotifications(user.uid);
        } else {
          window.location.href = window.withAppFlag("index.html");
        }
      });
    });
  }

  // ---------- Pull to refresh ----------
  function setupPullToRefresh() {
    pullRefreshEl = $("pullRefresh");
    if (!pullRefreshEl) return;

    document.addEventListener("touchstart", (e) => {
      touchStartY = e.changedTouches[0].screenY;
    });

    document.addEventListener("touchmove", (e) => {
      if (window.scrollY === 0) {
        const currentY = e.changedTouches[0].screenY;
        const diff = currentY - touchStartY;

        if (diff > 0 && diff < 100) {
          pullRefreshEl.classList.add("pulling");
        }
      }
    });

    document.addEventListener("touchend", (e) => {
      touchEndY = e.changedTouches[0].screenY;
      const diff = touchEndY - touchStartY;

      if (diff > 80 && window.scrollY === 0 && currentUserId) {
        pullRefreshEl.classList.remove("pulling");
        pullRefreshEl.classList.add("refreshing");

        loadNotifications(currentUserId).then(() => {
          setTimeout(() => {
            pullRefreshEl.classList.remove("refreshing");
          }, 500);
        });
      } else {
        pullRefreshEl.classList.remove("pulling");
      }
    });
  }

  // ---------- Init ----------
  window.addEventListener("load", () => {
    setupPullToRefresh();
    checkAuth();
  });
})();
