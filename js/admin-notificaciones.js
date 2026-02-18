/* ============================================ */
/* ADMIN-NOTIFICACIONES.JS - VirtualGift        */
/* ✅ Guarda real: redirige si isAdmin !== true  */
/* ✅ Usa window.waitForFirebase global          */
/* ✅ sin funciones Firebase duplicadas         */
/* ============================================ */

(() => {
  function $(id) { return document.getElementById(id); }

  /* ============================================ */
  /* UTILS                                        */
  /* ============================================ */

  // withAppFlag definida en el <head>, este es el fallback
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

  function setStatus(kind, msg) {
    const box = $("statusBox");
    if (!box) return;
    box.className = "status " + (kind === "ok" ? "ok" : "err");
    box.textContent = msg;
    box.style.display = "block";
  }

  function clearStatus() {
    const box = $("statusBox");
    if (!box) return;
    box.style.display = "none";
    box.textContent = "";
  }

  function fmtDate(ts) {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString("es-DO", { dateStyle: "medium", timeStyle: "short" });
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  /* ============================================ */
  /* ESTADOS DE PANTALLA                          */
  /* ============================================ */

  function showLoading() {
    $("loadingState").style.display  = "flex";
    $("deniedState").style.display   = "none";
    $("adminContent").style.display  = "none";
  }

  function showDenied() {
    $("loadingState").style.display  = "none";
    $("deniedState").style.display   = "flex";
    $("adminContent").style.display  = "none";
  }

  function showAdmin() {
    $("loadingState").style.display  = "none";
    $("deniedState").style.display   = "none";
    $("adminContent").style.display  = "block";
  }

  /* ============================================ */
  /* CONTADORES DE CARACTERES                     */
  /* ============================================ */

  function bindCounters() {
    const title    = $("title");
    const subtitle = $("subtitle");
    const tc = $("titleCount");
    const sc = $("subtitleCount");

    function upd() {
      if (tc) tc.textContent = (title?.value    || "").length;
      if (sc) sc.textContent = (subtitle?.value || "").length;
    }

    title?.addEventListener("input", upd);
    subtitle?.addEventListener("input", upd);
    upd();
  }

  /* ============================================ */
  /* HISTORIAL RECIENTE                           */
  /* ============================================ */

  async function loadRecent() {
    const list = $("recentList");
    if (!list) return;

    list.innerHTML = `<div class="recent-loading"><div class="recent-spinner"></div></div>`;

    try {
      const snap = await window.db
        .collection("notifications")
        .orderBy("timestamp", "desc")
        .limit(20)
        .get();

      if (snap.empty) {
        list.innerHTML = `
          <div class="recent-item">
            <div class="recent-left">
              <div class="recent-title">Sin notificaciones aún</div>
              <div class="recent-meta">Envía una desde el formulario de arriba.</div>
            </div>
          </div>`;
        return;
      }

      list.innerHTML = "";

      snap.forEach((doc) => {
        const n  = doc.data() || {};
        const el = document.createElement("div");
        el.className = "recent-item";

        el.innerHTML = `
          <div class="recent-left">
            <div class="recent-title">${escapeHtml(n.title || "Sin título")}</div>
            <div class="recent-meta">
              <b>Sub:</b> ${escapeHtml(n.subtitle || "—")} ·
              <b>Para:</b> ${escapeHtml(n.userId  || "—")}
              ${n.imageUrl ? ` · <b>Img:</b> ✓` : ""}
            </div>
          </div>
          <div class="recent-right">${escapeHtml(fmtDate(n.timestamp))}</div>
        `;

        list.appendChild(el);
      });
    } catch (e) {
      console.error("loadRecent error:", e);
      list.innerHTML = `
        <div class="recent-item">
          <div class="recent-left">
            <div class="recent-title">Error cargando historial</div>
            <div class="recent-meta">${escapeHtml(e.message || String(e))}</div>
          </div>
        </div>`;
    }
  }

  /* ============================================ */
  /* ENVIAR NOTIFICACIÓN                          */
  /* ============================================ */

  async function sendGlobal() {
    clearStatus();

    const title    = ($("title")?.value    || "").trim();
    const subtitle = ($("subtitle")?.value || "").trim();
    const imageUrl = ($("imageUrl")?.value || "").trim();

    if (!title)               return setStatus("err", "⚠️ El título es obligatorio.");
    if (title.length > 20)   return setStatus("err", "⚠️ El título debe tener máximo 20 caracteres.");
    if (!subtitle)            return setStatus("err", "⚠️ El subtítulo es obligatorio.");
    if (subtitle.length > 30) return setStatus("err", "⚠️ El subtítulo debe tener máximo 30 caracteres.");
    if (imageUrl && !/^https:\/\//i.test(imageUrl)) return setStatus("err", "⚠️ La imagen debe ser una URL HTTPS válida.");

    const btn = $("sendBtn");
    if (btn) btn.disabled = true;

    try {
      await window.db.collection("notifications").add({
        userId:    "ALL",
        title,
        subtitle,
        imageUrl:  imageUrl || null,
        read:      false,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      });

      setStatus("ok", "✅ Notificación enviada a todos los usuarios.");

      // Limpiar formulario
      $("title").value    = "";
      $("subtitle").value = "";
      $("imageUrl").value = "";
      bindCounters();

      await loadRecent();
    } catch (e) {
      console.error("sendGlobal error:", e);
      setStatus("err", "❌ No se pudo enviar: " + escapeHtml(e.message || String(e)));
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  /* ============================================ */
  /* GUARD DE ADMIN                               */
  /* ✅ Verifica isAdmin en Firestore antes de    */
  /* mostrar cualquier contenido.                 */
  /* ============================================ */

  async function checkAdmin(user) {
    try {
      const doc  = await window.db.collection("users").doc(user.uid).get();
      const data = doc.data() || {};

      if (data.isAdmin !== true) {
        console.warn("Acceso denegado: isAdmin !== true");
        showDenied();
        return;
      }

      // ✅ Es admin — mostrar panel
      showAdmin();
      await loadRecent();
    } catch (e) {
      console.error("checkAdmin error:", e);
      showDenied();
    }
  }

  /* ============================================ */
  /* UI BINDINGS                                  */
  /* ============================================ */

  function bindUI() {
    $("sendBtn")?.addEventListener("click", sendGlobal);

    $("clearBtn")?.addEventListener("click", () => {
      clearStatus();
      if ($("title"))    $("title").value    = "";
      if ($("subtitle")) $("subtitle").value = "";
      if ($("imageUrl")) $("imageUrl").value = "";
      bindCounters();
    });

    $("refreshBtn")?.addEventListener("click", loadRecent);

    // Enter en los inputs envía el formulario
    [$("title"), $("subtitle"), $("imageUrl")].forEach(el => {
      el?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); sendGlobal(); }
      });
    });
  }

  /* ============================================ */
  /* AUTENTICACIÓN                                */
  /* ============================================ */

  function initAuth() {
    // Usa el waitForFirebase global del firebase-config.js
    // No necesita storage, así que waitForFirebase (sin storage) es suficiente
    window.waitForFirebase((err) => {
      if (err) {
        console.error("Firebase timeout en admin:", err);
        showDenied();
        return;
      }

      window.auth.onAuthStateChanged(async (user) => {
        if (!user) {
          window.location.href = window.withAppFlag("index.html");
          return;
        }

        // Verificar admin en Firestore
        await checkAdmin(user);
      });
    });
  }

  /* ============================================ */
  /* INIT                                         */
  /* ============================================ */

  window.addEventListener("load", () => {
    showLoading();
    bindUI();
    bindCounters();
    initAuth();
  });

})();
