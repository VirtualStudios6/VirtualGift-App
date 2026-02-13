(() => {
  function $(id) { return document.getElementById(id); }

  window.withAppFlag = window.withAppFlag || function (url) {
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
      window.auth && window.db
    );
  }

  function waitForFirebase(callback, maxAttempts = 50) {
    let attempts = 0;
    const t = setInterval(() => {
      attempts++;
      if (isFirebaseReady()) {
        clearInterval(t);
        callback();
      } else if (attempts >= maxAttempts) {
        clearInterval(t);
        window.location.href = window.withAppFlag("index.html");
      }
    }, 100);
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

  function bindCounters() {
    const title = $("title");
    const subtitle = $("subtitle");
    const titleCount = $("titleCount");
    const subtitleCount = $("subtitleCount");

    function upd() {
      if (titleCount) titleCount.textContent = (title?.value || "").length;
      if (subtitleCount) subtitleCount.textContent = (subtitle?.value || "").length;
    }

    title?.addEventListener("input", upd);
    subtitle?.addEventListener("input", upd);
    upd();
  }

  async function loadRecent() {
    const list = $("recentList");
    if (!list) return;
    list.innerHTML = "";

    try {
      const snap = await window.db
        .collection("notifications")
        .orderBy("timestamp", "desc")
        .limit(20)
        .get();

      if (snap.empty) {
        list.innerHTML = `<div class="recent-item"><div class="recent-left"><div class="recent-title">No hay notificaciones</div><div class="recent-meta">Envía una desde arriba.</div></div><div class="recent-right">—</div></div>`;
        return;
      }

      snap.forEach((doc) => {
        const n = doc.data() || {};
        const el = document.createElement("div");
        el.className = "recent-item";
        el.innerHTML = `
          <div class="recent-left">
            <div class="recent-title">${(n.title || "Notificación").toString()}</div>
            <div class="recent-meta">
              <b>Sub:</b> ${(n.subtitle || "—").toString()} ·
              <b>Para:</b> ${(n.userId || "—").toString()}
              ${n.imageUrl ? ` · <b>Img:</b> ${(n.imageUrl || "").toString()}` : ""}
            </div>
          </div>
          <div class="recent-right">${fmtDate(n.timestamp)}</div>
        `;
        list.appendChild(el);
      });
    } catch (e) {
      console.error(e);
      list.innerHTML = `<div class="recent-item"><div class="recent-left"><div class="recent-title">Error</div><div class="recent-meta">${(e.message || e).toString()}</div></div><div class="recent-right">—</div></div>`;
    }
  }

  async function sendGlobal() {
    clearStatus();

    const title = ($("title")?.value || "").trim();
    const subtitle = ($("subtitle")?.value || "").trim();
    const imageUrl = ($("imageUrl")?.value || "").trim();

    if (!title) return setStatus("err", "Pon un título.");
    if (title.length > 20) return setStatus("err", "El título debe ser máx 20 caracteres.");
    if (!subtitle) return setStatus("err", "Pon un subtítulo.");
    if (subtitle.length > 30) return setStatus("err", "El subtítulo debe ser máx 30 caracteres.");
    if (imageUrl && !/^https:\/\//i.test(imageUrl)) return setStatus("err", "La imagen debe ser URL HTTPS.");

    const btn = $("sendBtn");
    if (btn) btn.disabled = true;

    try {
      const payload = {
        userId: "ALL",
        title,
        subtitle,
        imageUrl: imageUrl || null,
        read: false,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      };

      await window.db.collection("notifications").add(payload);

      setStatus("ok", "✅ Enviada a TODOS.");
      $("title").value = "";
      $("subtitle").value = "";
      $("imageUrl").value = "";
      bindCounters();
      await loadRecent();
    } catch (e) {
      console.error(e);
      setStatus("err", "❌ No se pudo enviar: " + (e.message || e));
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function checkAdminChip(user) {
    const chip = $("adminChip");
    if (!chip) return;
    window.db.collection("users").doc(user.uid).get()
      .then((doc) => {
        const data = doc.data() || {};
        chip.style.display = data.isAdmin === true ? "inline-flex" : "none";
      })
      .catch(() => { chip.style.display = "none"; });
  }

  function bindUI() {
    $("sendBtn")?.addEventListener("click", sendGlobal);

    $("clearBtn")?.addEventListener("click", () => {
      clearStatus();
      $("title").value = "";
      $("subtitle").value = "";
      $("imageUrl").value = "";
      bindCounters();
    });

    $("refreshBtn")?.addEventListener("click", loadRecent);
  }

  window.addEventListener("load", () => {
    bindUI();
    bindCounters();

    waitForFirebase(() => {
      window.auth.onAuthStateChanged(async (user) => {
        if (!user) return (window.location.href = window.withAppFlag("index.html"));
        checkAdminChip(user);
        await loadRecent();
      });
    });
  });
})();
