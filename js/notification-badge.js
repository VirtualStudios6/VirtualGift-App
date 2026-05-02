// notification-badge.js
// Actualiza el #badgeCount del header en cualquier página que tenga el icono de notificaciones.

(function () {
  function storageKey(uid) { return `vg_notifs_hidden_${uid}`; }

  function getHiddenSet(uid) {
    try {
      const raw = localStorage.getItem(storageKey(uid));
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch { return new Set(); }
  }

  function updateBadge(uid, notifications) {
    const hidden = getHiddenSet(uid);
    const unread = notifications.filter(n => !hidden.has(n.id) && !n.read).length;
    const badge  = document.getElementById("badgeCount");
    if (badge) {
      badge.textContent   = unread;
      badge.style.display = unread > 0 ? "flex" : "none";
    }
    if (window.VGSounds) VGSounds.checkNotifBadge(unread);
  }

  let _unsubBadge = null;

  function stopBadge() {
    if (_unsubBadge) { _unsubBadge(); _unsubBadge = null; }
  }

  function start(uid) {
    if (!window.db) return;
    stopBadge();
    _unsubBadge = window.db
      .collection("notifications")
      .where("userId", "in", [uid, "ALL"])
      .orderBy("timestamp", "desc")
      .limit(50)
      .onSnapshot(
        (snap) => {
          const arr = [];
          snap.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
          updateBadge(uid, arr);
        },
        (err) => { console.warn("[notification-badge] onSnapshot error:", err); }
      );
  }

  function init() {
    if (!window.auth || !window.db) return;
    window.auth.onAuthStateChanged((user) => {
      if (user) { start(user.uid); } else { stopBadge(); }
    });
  }

  window.addEventListener('beforeunload', stopBadge);
  window.addEventListener('pagehide', stopBadge);

  if (typeof window.waitForFirebase === "function") {
    window.waitForFirebase((err) => { if (!err) init(); });
  } else {
    let i = 0;
    const t = setInterval(() => {
      i++;
      if (window.db && window.auth) { clearInterval(t); init(); }
      else if (i >= 80)             { clearInterval(t); }
    }, 100);
  }
})();
