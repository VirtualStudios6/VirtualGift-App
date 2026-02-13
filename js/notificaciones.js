/* =========================================================
   NOTIFICACIONES - VirtualGift (REALTIME)
   - Realtime (onSnapshot) para uid + ALL
   - title (<=20), subtitle (<=30), imageUrl opcional
   - Read/Delete para ALL: por usuario (localStorage)
   - Fallback si falta índice / permisos
   ========================================================= */

(() => {
  let currentUserId = null;
  let allNotifications = [];

  // Pull to refresh
  let touchStartY = 0;
  let touchEndY = 0;
  let pullRefreshEl = null;

  // Realtime unsubscribe
  let unsubscribeNotifs = null;

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

  // ---------- Local state for ALL (per-user) ----------
  function storageKey(uid) {
    return `vg_notifs_hidden_${uid}`;
  }

  function getHiddenSet(uid) {
    try {
      const raw = localStorage.getItem(storageKey(uid));
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  }

  function saveHiddenSet(uid, set) {
    try {
      localStorage.setItem(storageKey(uid), JSON.stringify([...set]));
    } catch {}
  }

  function hideForThisUser(notificationId) {
    if (!currentUserId) return;
    const set = getHiddenSet(currentUserId);
    set.add(notificationId);
    saveHiddenSet(currentUserId, set);
  }

  function isHiddenForThisUser(notificationId) {
    if (!currentUserId) return false;
    const set = getHiddenSet(currentUserId);
    return set.has(notificationId);
  }

  // ---------- UI ----------
  function updateBadgeCount() {
    const unreadCount = allNotifications.filter((n) => {
      if (isHiddenForThisUser(n.id)) return false;
      return !n.read;
    }).length;

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

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function createNotificationItem(notification) {
    const div = document.createElement("div");

    const isUnread = !notification.read;
    div.className = `notification-item ${isUnread ? "unread" : ""}`;
    div.onclick = () => markAsRead(notification);

    const timeAgo = getTimeAgo(notification.timestamp);

    const title = escapeHtml(notification.title || "Notificación");
    const subtitle = escapeHtml(notification.subtitle || "");
    const img = notification.imageUrl ? String(notification.imageUrl) : "";

    div.innerHTML = `
      <div class="notification-icon">🔔</div>
      <div class="notification-content">
        <div class="notification-title">${title}</div>
        <div class="notification-message">${subtitle}</div>

        ${
          img
            ? `
            <div class="notif-image-wrap">
              <img class="notif-image" src="${escapeHtml(img)}" alt="Notificación" loading="lazy">
            </div>
          `
            : ""
        }

        <div class="notification-footer">
          <div class="notification-time">${timeAgo}</div>
          <div class="notification-actions">
            <button class="action-btn secondary" data-delete-id="${notification.id}">
              Eliminar
            </button>
          </div>
        </div>
      </div>
    `;

    const deleteBtn = div.querySelector("[data-delete-id]");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteNotification(notification);
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

    const filtered = allNotifications.filter((n) => !isHiddenForThisUser(n.id));

    if (!filtered || filtered.length === 0) {
      showEmptyState("No hay notificaciones");
      return;
    }

    filtered.forEach((notification) => {
      container.appendChild(createNotificationItem(notification));
    });
  }

  function normalizeNotifications(arr) {
    // Normaliza campos (por si quedó alguna doc vieja)
    const normalized = (arr || []).map((n) => ({
      id: n.id,
      userId: n.userId,
      title: n.title || "",
      subtitle: n.subtitle || n.message || "",
      imageUrl: n.imageUrl || null,
      read: Boolean(n.read),
      timestamp: n.timestamp || null,
    }));

    // orden en cliente por si timestamp viene null en alguno
    normalized.sort((a, b) => tsToMillis(b.timestamp) - tsToMillis(a.timestamp));

    allNotifications = normalized;
    updateBadgeCount();
    displayNotifications();
  }

  // ---------- Firestore (REALTIME) ----------
  async function fallbackGet(uid, originalError) {
    try {
      const snapshot2 = await window.db
        .collection("notifications")
        .where("userId", "in", [uid, "ALL"])
        .limit(50)
        .get();

      const arr2 = [];
      snapshot2.forEach((doc) => arr2.push({ id: doc.id, ...doc.data() }));

      normalizeNotifications(arr2);
    } catch (e2) {
      console.error("Fallback get falló:", e2);
      const msg = String(originalError?.message || originalError || e2?.message || e2);
      showErrorBox(msg);
    }
  }

  function stopRealtime() {
    if (typeof unsubscribeNotifs === "function") {
      unsubscribeNotifs();
      unsubscribeNotifs = null;
    }
  }

  function startRealtimeNotifications(uid) {
    if (!window.db) return;

    stopRealtime();

    // Query realtime (puede pedir índice)
    const q = window.db
      .collection("notifications")
      .where("userId", "in", [uid, "ALL"])
      .orderBy("timestamp", "desc")
      .limit(50);

    unsubscribeNotifs = q.onSnapshot(
      (snapshot) => {
        const arr = [];
        snapshot.forEach((doc) => arr.push({ id: doc.id, ...doc.data() }));

        // no dependemos del orderBy: ordenamos igual en cliente
        normalizeNotifications(arr);

        console.log("UID LOGUEADO:", uid);
        console.log("NOTIFICATIONS REALTIME:", allNotifications.length);
      },
      (err) => {
        console.error("Realtime onSnapshot error:", err);
        // fallback: get sin orderBy
        fallbackGet(uid, err);
      }
    );
  }

  // ---------- Actions ----------
  async function markAsRead(notification) {
    if (!window.db) return;

    // Si es ALL, no la marcamos en Firestore (sería global para todos).
    if (notification.userId === "ALL") {
      hideForThisUser(notification.id);
      updateBadgeCount();
      displayNotifications();
      return;
    }

    try {
      await window.db.collection("notifications").doc(notification.id).update({ read: true });

      const n = allNotifications.find((x) => x.id === notification.id);
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

      // 1) personales
      const personalUnread = allNotifications.filter(
        (n) => n.userId === currentUserId && !n.read && !isHiddenForThisUser(n.id)
      );

      personalUnread.forEach((n) => {
        const ref = window.db.collection("notifications").doc(n.id);
        batch.update(ref, { read: true });
        n.read = true;
      });

      // 2) ALL: ocultarlas localmente
      const globalVisible = allNotifications.filter(
        (n) => n.userId === "ALL" && !isHiddenForThisUser(n.id)
      );
      globalVisible.forEach((n) => hideForThisUser(n.id));

      await batch.commit();

      updateBadgeCount();
      displayNotifications();
    } catch (error) {
      console.error("Error al marcar todas:", error);
    }
  };

  async function deleteNotification(notification) {
    if (!window.db) return;

    // Si es ALL, solo ocultamos localmente
    if (notification.userId === "ALL") {
      hideForThisUser(notification.id);
      updateBadgeCount();
      displayNotifications();
      return;
    }

    try {
      await window.db.collection("notifications").doc(notification.id).delete();
      allNotifications = allNotifications.filter((n) => n.id !== notification.id);
      updateBadgeCount();
      displayNotifications();
    } catch (error) {
      console.error("Error al eliminar:", error);
    }
  }

  // ---------- Auth ----------
  function checkAuth() {
    waitForFirebase(() => {
      window.auth.onAuthStateChanged((user) => {
        if (user) {
          currentUserId = user.uid;
          startRealtimeNotifications(user.uid); // ✅ realtime
        } else {
          stopRealtime();
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

        // Con realtime no hace falta recargar,
        // pero lo dejamos como “feedback” visual
        setTimeout(() => pullRefreshEl.classList.remove("refreshing"), 500);
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
