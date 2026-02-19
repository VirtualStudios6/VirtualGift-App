// js/news-detail.js
document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(location.search);
  const id     = params.get("id");

  const loading   = document.getElementById("loading");
  const article   = document.getElementById("article");
  const errorEl   = document.getElementById("error");

  const titleEl   = document.getElementById("title");
  const dateEl    = document.getElementById("date");
  const imgEl     = document.getElementById("image");
  const contentEl = document.getElementById("content");
  const readingEl = document.getElementById("readingTime");

  const galleryWrap = document.getElementById("galleryWrap");
  const galleryEl   = document.getElementById("gallery");

  const btnShare  = document.getElementById("btnShare");
  const btnShare2 = document.getElementById("btnShare2");
  const btnSave   = document.getElementById("btnSave");

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
  /* Toast (reemplaza alert para clipboard/save) */
  /* ------------------------------------------ */
  function showToast(msg, duration = 2600) {
    // Busca un toast existente en la página, si no, lo crea
    let toastEl = document.getElementById("vg-detail-toast");
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.id = "vg-detail-toast";
      Object.assign(toastEl.style, {
        position:     "fixed",
        left:         "50%",
        bottom:       "calc(18px + env(safe-area-inset-bottom))",
        transform:    "translateX(-50%)",
        background:   "rgba(28,31,47,.95)",
        border:       "1px solid rgba(255,255,255,.10)",
        padding:      "10px 16px",
        borderRadius: "999px",
        color:        "#dcefff",
        zIndex:       "9999",
        fontWeight:   "700",
        fontSize:     "14px",
        maxWidth:     "92vw",
        display:      "none",
        boxShadow:    "0 10px 35px rgba(0,0,0,.45)",
      });
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.style.display = "block";
    clearTimeout(window.__vgDetailToast);
    window.__vgDetailToast = setTimeout(() => (toastEl.style.display = "none"), duration);
  }

  /* ------------------------------------------ */
  /* Utils                                        */
  /* ------------------------------------------ */

  function showError() {
    if (loading)  loading.style.display  = "none";
    if (article)  article.style.display  = "none";
    if (errorEl)  errorEl.style.display  = "block";
  }

  function fmtDate(ts) {
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
    } catch { return ""; }
  }

  function getCover(data) {
    const url = (data.coverImageUrl || data.imageUrl || "").trim();
    return url || "images/news-placeholder-wide.png";
  }

  function calcReadingMinutes(text) {
    const words = String(text || "").trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
  }

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (m) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[m]));
  }

  function renderContent(text) {
    const raw   = String(text || "").replace(/\r\n/g, "\n").trim();
    if (!raw) return "<p></p>";

    const lines  = raw.split("\n");
    let html     = "";
    let buffer   = [];

    const flushParagraph = () => {
      const t = buffer.join("\n").trim();
      if (t) html += `<p>${escapeHtml(t)}</p>`;
      buffer = [];
    };

    lines.forEach((line) => {
      const l = line.trim();
      if (l.startsWith("## "))  { flushParagraph(); html += `<div class="h2">${escapeHtml(l.slice(3))}</div>`; return; }
      if (l.startsWith("### ")) { flushParagraph(); html += `<div class="h3">${escapeHtml(l.slice(4))}</div>`; return; }
      if (l === "")             { flushParagraph(); return; }
      buffer.push(line);
    });

    flushParagraph();
    return html;
  }

  function renderGallery(gallery) {
    if (!galleryWrap || !galleryEl) return;
    if (!Array.isArray(gallery) || gallery.length === 0) {
      galleryWrap.style.display = "none";
      return;
    }

    galleryEl.innerHTML = "";
    galleryWrap.style.display = "block";

    gallery.forEach((item) => {
      const [urlRaw, capRaw] = String(item || "").split("|");
      const url = (urlRaw || "").trim();
      const cap = (capRaw || "").trim();
      if (!url) return;

      const div       = document.createElement("div");
      div.className   = "g-item";
      div.innerHTML   = `
        <img src="${escapeHtml(url)}" alt="" loading="lazy" onerror="this.style.display='none'">
        ${cap ? `<div class="g-cap">${escapeHtml(cap)}</div>` : ""}
      `;
      galleryEl.appendChild(div);
    });

    if (!galleryEl.children.length) galleryWrap.style.display = "none";
  }

  /* ------------------------------------------ */
  /* Share (sin alert nativo)                     */
  /* ------------------------------------------ */
  async function share(title) {
    const shareData = { title: title || "VirtualGift News", url: location.href };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(location.href);
        showToast("✅ Link copiado al portapapeles");
      }
    } catch (e) {
      // El usuario canceló el share nativo — no es error
      if (e?.name !== "AbortError") {
        try {
          await navigator.clipboard.writeText(location.href);
          showToast("✅ Link copiado");
        } catch {
          showToast("No se pudo copiar el link");
        }
      }
    }
  }

  /* ------------------------------------------ */
  /* Guardar local (sin alert nativo)             */
  /* ------------------------------------------ */
  function saveLocal(newsId) {
    try {
      const key  = "vg_saved_news";
      const list = JSON.parse(localStorage.getItem(key) || "[]");
      if (!list.includes(newsId)) list.unshift(newsId);
      localStorage.setItem(key, JSON.stringify(list.slice(0, 100)));
      showToast("✅ Guardado en tu lista");
    } catch {
      showToast("😕 No se pudo guardar");
    }
  }

  /* ------------------------------------------ */
  /* Carga                                        */
  /* ------------------------------------------ */

  async function load() {
    if (!id) return showError();

    try {
      const doc = await window.db.collection("news").doc(id).get();
      if (!doc.exists) return showError();

      const data = doc.data() || {};
      if (data.published !== true) return showError();

      const title = data.title || "Noticia";

      if (titleEl) titleEl.textContent = title;
      if (dateEl)  dateEl.textContent  = data.date ? fmtDate(data.date) : "";
      if (imgEl)   {
        imgEl.src = getCover(data);
        imgEl.onerror = () => { imgEl.src = "images/news-placeholder-wide.png"; };
      }

      document.title = `${title} · VirtualGift`;

      const bodyText = data.content || data.description || "";
      if (readingEl) readingEl.textContent = String(calcReadingMinutes(bodyText));
      if (contentEl) contentEl.innerHTML   = renderContent(bodyText);

      renderGallery(data.gallery || []);

      btnShare?.addEventListener("click",  () => share(title));
      btnShare2?.addEventListener("click", () => share(title));
      btnSave?.addEventListener("click",   () => saveLocal(id));

      if (loading) loading.style.display = "none";
      if (article) article.style.display = "block";

    } catch (e) {
      console.error("[news-detail] Error:", e);
      showError();
    }
  }

  /* ------------------------------------------ */
  /* Init: usa el waitForFirebase global          */
  /* ------------------------------------------ */

  function startWait() {
    if (typeof window.waitForFirebase === "function") {
      window.waitForFirebase((err) => {
        if (err) { showError(); return; }
        load();
      });
      return;
    }

    let i = 0;
    const t = setInterval(() => {
      i++;
      if (window.db && typeof window.db.collection === "function") {
        clearInterval(t);
        load();
      } else if (i >= 80) {
        clearInterval(t);
        showError();
      }
    }, 100);
  }

  startWait();
});
