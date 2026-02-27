/* =========================================================
   NOTIFICACIONES.JS - VirtualGift (REALTIME)
   ========================================================= */

(() => {
  let currentUserId    = null;
  let allNotifications = [];
  let unsubscribeNotifs = null;

  let touchStartY = 0;
  let pullRefreshEl = null;

  /* ============================================ */
  /* UTILS                                        */
  /* ============================================ */
  if (typeof window.withAppFlag !== "function") {
    window.withAppFlag = function(url) {
      const isAndroidApp =
        document.documentElement.classList.contains("android-app") ||
        document.body.classList.contains("android-app");
      if (!isAndroidApp) return url;
      if (url.includes("app=android")) return url;
      const parts = url.split("#");
      const base  = parts[0];
      const hash  = parts[1] ? "#" + parts[1] : "";
      const fixed = base.includes("?") ? base + "&app=android" : base + "?app=android";
      return fixed + hash;
    };
  }

  function isFirebaseReady() {
    return (
      typeof firebase !== "undefined" &&
      typeof firebase.auth === "function" &&
      typeof firebase.firestore === "function" &&
      window.auth && window.db
    );
  }

  function waitForFirebase(callback, maxAttempts = 40) {
    let attempts = 0;
    const check = setInterval(() => {
      attempts++;
      if (isFirebaseReady()) { clearInterval(check); callback(); }
      else if (attempts >= maxAttempts) {
        clearInterval(check);
        window.location.href = window.withAppFlag("index.html");
      }
    }, 100);
  }

  function $(id) { return document.getElementById(id); }

  function getTimeAgo(timestamp) {
    if (!timestamp) return "Ahora";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diff = Math.floor((Date.now() - date) / 1000);
    if (diff < 60)     return "Ahora";
    if (diff < 3600)   return `Hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400)  return `Hace ${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `Hace ${Math.floor(diff / 86400)} días`;
    return date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
  }

  function tsToMillis(ts) {
    if (!ts) return 0;
    if (typeof ts.toMillis === "function") return ts.toMillis();
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d instanceof Date ? d.getTime() : 0;
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  /* ============================================ */
  /* VISIBILIDAD LOCAL (para notifs "ALL")        */
  /* ============================================ */
  function storageKey(uid) { return `vg_notifs_hidden_${uid}`; }

  function getHiddenSet(uid) {
    try {
      const raw = localStorage.getItem(storageKey(uid));
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch { return new Set(); }
  }

  function saveHiddenSet(uid, set) {
    try { localStorage.setItem(storageKey(uid), JSON.stringify([...set])); }
    catch {}
  }

  function hideForThisUser(notificationId) {
    if (!currentUserId) return;
    const set = getHiddenSet(currentUserId);
    set.add(notificationId);
    saveHiddenSet(currentUserId, set);
  }

  function isHiddenForThisUser(notificationId) {
    if (!currentUserId) return false;
    return getHiddenSet(currentUserId).has(notificationId);
  }

  /* ============================================ */
  /* UI                                           */
  /* ============================================ */

  function updateBadgeCount() {
    const unread = allNotifications.filter(n =>
      !isHiddenForThisUser(n.id) && !n.read
    ).length;

    // Badge del header
    const badge = $("badgeCount");
    if (badge) {
      badge.textContent   = unread;
      badge.style.display = unread > 0 ? "flex" : "none";
    }

    // ✅ Chip del sidebar desktop
    const chip      = $("sidebarUnreadChip");
    const chipCount = $("sidebarUnreadCount");
    if (chip && chipCount) {
      chipCount.textContent = unread;
      chip.style.display    = unread > 0 ? "inline-flex" : "none";
    }
  }

  function showEmptyState(message) {
    const container = $("notificationsContainer");
    const loading   = $("loadingContainer");
    if (loading)   loading.style.display = "none";
    if (!container) return;
    container.style.display = "block";
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">🔔</span>
        <div>${escapeHtml(message)}</div>
      </div>
    `;
  }

  function showErrorBox(message) {
    const container = $("notificationsContainer");
    const loading   = $("loadingContainer");
    if (loading)   loading.style.display = "none";
    if (!container) return;
    container.style.display = "block";
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">⚠️</span>
        <div style="font-weight:900; margin-bottom:6px;">No se pudieron cargar las notificaciones</div>
        <div style="opacity:.85; word-break:break-word; font-size:0.9em;">${escapeHtml(message)}</div>
      </div>
    `;
  }

  function createNotificationItem(notification) {
    const div    = document.createElement("div");
    const unread = !notification.read;

    div.className = `notification-item ${unread ? "unread" : ""}`;
    div.onclick   = () => markAsRead(notification);

    const title    = escapeHtml(notification.title    || "Notificación");
    const subtitle = escapeHtml(notification.subtitle || "");
    const imgSrc   = notification.imageUrl ? String(notification.imageUrl) : "";
    const timeAgo  = getTimeAgo(notification.timestamp);

    div.innerHTML = `
      <div class="notification-icon">🔔</div>
      <div class="notification-content">
        <div class="notification-title">${title}</div>
        ${subtitle ? `<div class="notification-message">${subtitle}</div>` : ""}
        ${imgSrc ? `
          <div class="notif-image-wrap">
            <img class="notif-image"
                 src="${escapeHtml(imgSrc)}"
                 alt="Notificación"
                 loading="lazy"
                 onerror="this.parentElement.style.display='none'">
          </div>
        ` : ""}
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
    const loading   = $("loadingContainer");

    if (loading)   loading.style.display = "none";
    if (!container) return;

    container.style.display = "block";
    container.innerHTML     = "";

    const visible = allNotifications.filter(n => !isHiddenForThisUser(n.id));

    if (visible.length === 0) {
      showEmptyState("No hay notificaciones");
      return;
    }

    visible.forEach(n => container.appendChild(createNotificationItem(n)));
  }

  function normalizeAndRender(arr) {
    const normalized = (arr || []).map(n => ({
      id:        n.id,
      userId:    n.userId,
      title:     n.title    || "",
      subtitle:  n.subtitle || n.message || "",
      imageUrl:  n.imageUrl || null,
      read:      Boolean(n.read),
      timestamp: n.timestamp || null,
    }));

    normalized.sort((a, b) => tsToMillis(b.timestamp) - tsToMillis(a.timestamp));

    allNotifications = normalized;
    updateBadgeCount();
    displayNotifications();
  }

  /* ============================================ */
  /* FIRESTORE REALTIME + FALLBACK               */
  /* ============================================ */
  async function fallbackGet(uid, originalError) {
    try {
      const snap = await window.db
        .collection("notifications")
        .where("userId", "in", [uid, "ALL"])
        .limit(50)
        .get();

      const arr = [];
      snap.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
      normalizeAndRender(arr);
    } catch (e2) {
      console.error("Fallback get falló:", e2);
      showErrorBox(String(originalError?.message || e2?.message || e2));
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

    const q = window.db
      .collection("notifications")
      .where("userId", "in", [uid, "ALL"])
      .orderBy("timestamp", "desc")
      .limit(50);

    unsubscribeNotifs = q.onSnapshot(
      (snapshot) => {
        const arr = [];
        snapshot.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
        normalizeAndRender(arr);
      },
      (err) => {
        console.error("Realtime onSnapshot error:", err);
        fallbackGet(uid, err);
      }
    );
  }

  /* ============================================ */
  /* ACCIONES                                     */
  /* ============================================ */
  async function markAsRead(notification) {
    if (!window.db) return;

    if (notification.userId === "ALL") {
      hideForThisUser(notification.id);
      updateBadgeCount();
      displayNotifications();
      return;
    }

    if (notification.read) return;

    try {
      await window.db.collection("notifications").doc(notification.id).update({ read: true });
      const n = allNotifications.find(x => x.id === notification.id);
      if (n) n.read = true;
      updateBadgeCount();
      displayNotifications();
    } catch (error) {
      console.error("Error al marcar como leída:", error);
    }
  }

  window.markAllAsRead = async function() {
    if (!window.db || !currentUserId) return;

    try {
      const batch = window.db.batch();

      const personalUnread = allNotifications.filter(
        n => n.userId === currentUserId && !n.read && !isHiddenForThisUser(n.id)
      );

      personalUnread.forEach(n => {
        batch.update(window.db.collection("notifications").doc(n.id), { read: true });
        n.read = true;
      });

      allNotifications
        .filter(n => n.userId === "ALL" && !isHiddenForThisUser(n.id))
        .forEach(n => hideForThisUser(n.id));

      await batch.commit();

      updateBadgeCount();
      displayNotifications();
    } catch (error) {
      console.error("Error al marcar todas:", error);
    }
  };

  async function deleteNotification(notification) {
    if (!window.db) return;

    if (notification.userId === "ALL") {
      hideForThisUser(notification.id);
      updateBadgeCount();
      displayNotifications();
      return;
    }

    try {
      await window.db.collection("notifications").doc(notification.id).delete();
      allNotifications = allNotifications.filter(n => n.id !== notification.id);
      updateBadgeCount();
      displayNotifications();
    } catch (error) {
      console.error("Error al eliminar:", error);
    }
  }

  /* ============================================ */
  /* AUTENTICACIÓN                                */
  /* ============================================ */
  function checkAuth() {
    waitForFirebase(() => {
      window.auth.onAuthStateChanged((user) => {
        if (user) {
          currentUserId = user.uid;
          startRealtimeNotifications(user.uid);
        } else {
          stopRealtime();
          window.location.href = window.withAppFlag("index.html");
        }
      });
    });
  }

  /* ============================================ */
  /* PULL TO REFRESH                              */
  /* ============================================ */
  function setupPullToRefresh() {
    pullRefreshEl = $("pullRefresh");
    if (!pullRefreshEl) return;

    document.addEventListener("touchstart", (e) => {
      touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    document.addEventListener("touchmove", (e) => {
      if (window.scrollY === 0) {
        const diff = e.changedTouches[0].screenY - touchStartY;
        if (diff > 0 && diff < 100) pullRefreshEl.classList.add("pulling");
      }
    }, { passive: true });

    document.addEventListener("touchend", (e) => {
      const diff = e.changedTouches[0].screenY - touchStartY;
      if (diff > 80 && window.scrollY === 0) {
        pullRefreshEl.classList.remove("pulling");
        pullRefreshEl.classList.add("refreshing");
        setTimeout(() => pullRefreshEl.classList.remove("refreshing"), 600);
      } else {
        pullRefreshEl.classList.remove("pulling");
      }
    }, { passive: true });
  }

  /* ============================================ */
  /* INIT                                         */
  /* ============================================ */
  window.addEventListener("load", () => {
    setupPullToRefresh();
    checkAuth();
  });

})();
