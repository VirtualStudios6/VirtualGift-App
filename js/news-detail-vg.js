// js/news-detail-vg.js
document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(location.search);
  const id     = params.get("id");

  const titleEl       = document.getElementById("titleText");
  const dateEl        = document.getElementById("dateText");
  const categoryEl    = document.getElementById("categoryText");
  const statusBadge   = document.getElementById("statusBadge");
  const statusTextEl  = document.getElementById("statusText");
  const blocksContainer = document.getElementById("blocksContainer");
  const headerImageEl   = document.getElementById("headerImage");
  const headerFallbackEl = document.getElementById("headerFallback");
  const galleryContainer = document.getElementById("galleryContainer");

  /* ------------------------------------------ */
  /* withAppFlag fallback                         */
  /* ------------------------------------------ */
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

  /* ------------------------------------------ */
  /* Utils                                        */
  /* ------------------------------------------ */

  function showError(msg) {
    console.error("[news-detail-vg]", msg || "Error");
    if (titleEl) titleEl.textContent = "No se pudo cargar la noticia.";
    if (blocksContainer) {
      clearNode(blocksContainer);
      const p = document.createElement("p");
      p.style.opacity = ".85";
      p.textContent = msg || "Error cargando noticia";
      blocksContainer.appendChild(p);
    }
  }

  function fmtDate(ts) {
    if (!ts) return "—";
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
    } catch { return "—"; }
  }

  function clearNode(el) {
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function setHeaderImage(url) {
    const clean = (url && String(url).trim()) ? String(url).trim() : "";

    if (!clean) {
      if (headerImageEl)   headerImageEl.style.display   = "none";
      if (headerFallbackEl) headerFallbackEl.style.display = "flex";
      return;
    }

    if (headerImageEl) {
      headerImageEl.style.display = "block";
      headerImageEl.src = clean;
      headerImageEl.onerror = () => {
        headerImageEl.style.display = "none";
        if (headerFallbackEl) headerFallbackEl.style.display = "flex";
      };
    }

    if (headerFallbackEl) headerFallbackEl.style.display = "none";
  }

  function renderBlocks(blocks) {
    if (!blocksContainer) return;
    clearNode(blocksContainer);

    if (!Array.isArray(blocks) || blocks.length === 0) {
      const p = document.createElement("p");
      p.style.opacity = ".85";
      p.textContent = "Esta noticia no tiene contenido todavía.";
      blocksContainer.appendChild(p);
      return;
    }

    blocks.forEach((b) => {
      const type = String(b?.type || "").trim();

      if (type === "p") {
        const p = document.createElement("p");
        p.textContent = String(b.text || "");
        blocksContainer.appendChild(p);
        return;
      }

      if (type === "h2") {
        const h2 = document.createElement("h2");
        h2.textContent = String(b.text || "");
        blocksContainer.appendChild(h2);
        return;
      }

      if (type === "highlight") {
        const box = document.createElement("div");
        box.className = "highlight-box";
        const p = document.createElement("p");
        p.textContent = String(b.text || "");
        box.appendChild(p);
        blocksContainer.appendChild(box);
        return;
      }

      if (type === "img") {
        const url = String(b.url || "").trim();
        if (!url) return;

        const wrap = document.createElement("div");
        wrap.className = "image-section";

        const img = document.createElement("img");
        img.src     = url;
        img.alt     = "Imagen de la noticia";
        img.loading = "lazy";
        img.onerror = () => { wrap.style.display = "none"; };
        wrap.appendChild(img);

        const cap = String(b.caption || "").trim();
        if (cap) {
          const caption = document.createElement("div");
          caption.className   = "image-caption";
          caption.textContent = cap;
          wrap.appendChild(caption);
        }

        blocksContainer.appendChild(wrap);
      }
    });
  }

  function renderGallery(gallery) {
    if (!galleryContainer) return;

    if (!Array.isArray(gallery) || gallery.length === 0) {
      galleryContainer.style.display = "none";
      clearNode(galleryContainer);
      return;
    }

    galleryContainer.style.display = "block";
    clearNode(galleryContainer);

    gallery.forEach((url) => {
      const clean = String(url || "").trim();
      if (!clean) return;

      const img    = document.createElement("img");
      img.src      = clean;
      img.loading  = "lazy";
      img.alt      = "Imagen de galería";
      img.onerror  = () => { img.style.display = "none"; };
      galleryContainer.appendChild(img);
    });
  }

  /* ------------------------------------------ */
  /* Carga                                        */
  /* ------------------------------------------ */

  async function load() {
    if (!id) return showError("Falta el id en la URL.");

    try {
      const doc = await window.db.collection("news").doc(id).get();
      if (!doc.exists) return showError("La noticia no existe.");

      const data = doc.data() || {};
      if (data.published !== true) return showError("Esta noticia no está publicada.");

      const title = String(data.title || "Noticia");
      if (titleEl)     titleEl.textContent    = title;
      if (dateEl)      dateEl.textContent     = fmtDate(data.date || data.updatedAt || data.createdAt);
      if (categoryEl)  categoryEl.textContent = String(data.category || "Gaming");

      document.title = `${title} · VirtualGift`;

      const st = String(data.statusText || "").trim();
      if (st && statusBadge && statusTextEl) {
        statusTextEl.textContent = st;
        statusBadge.style.display = "inline-flex";
      } else if (statusBadge) {
        statusBadge.style.display = "none";
      }

      setHeaderImage(data.headerImageUrl || data.coverImageUrl || "");
      renderBlocks(data.blocks);
      renderGallery(data.gallery);

    } catch (e) {
      console.error("[news-detail-vg] Error:", e);
      showError(e.message || "Error cargando noticia.");
    }
  }

  /* ------------------------------------------ */
  /* Init: usa el waitForFirebase global          */
  /* ------------------------------------------ */

  function startWait() {
    // Si ya está disponible la global del config, úsala
    if (typeof window.waitForFirebase === "function") {
      window.waitForFirebase((err) => {
        if (err) { showError("Firebase no cargó a tiempo."); return; }
        load();
      });
      return;
    }

    // Fallback mínimo si el config aún no cargó
    let i = 0;
    const t = setInterval(() => {
      i++;
      if (window.db && typeof window.db.collection === "function") {
        clearInterval(t);
        load();
      } else if (i >= 80) {
        clearInterval(t);
        showError("Firebase no cargó a tiempo.");
      }
    }, 100);
  }

  startWait();
});
