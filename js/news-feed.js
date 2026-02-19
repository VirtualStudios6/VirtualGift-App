// js/news-feed.js
document.addEventListener("DOMContentLoaded", () => {
  const grid    = document.getElementById("newsGrid");
  const errorEl = document.getElementById("newsError");
  if (!grid) return;

  const FEED_LIMIT      = 12;
  const CACHE_KEY       = "vg_news_cache";
  const CACHE_DURATION  = 5 * 60 * 1000; // 5 min

  /* ------------------------------------------ */
  /* Utils                                        */
  /* ------------------------------------------ */

  function truncateText(text, max = 45) {
    const t = String(text || "");
    return t.length > max ? t.slice(0, max) + "…" : t;
  }

  function getFeedTitle(data) {
    const feedTitle = String(data?.feedTitle || "").trim();
    if (feedTitle) return feedTitle;
    return truncateText(String(data?.title || "Noticia").trim(), 45);
  }

  function localPlaceholder() {
    return "images/news-placeholder.png";
  }

  function getCover(data) {
    const url = String(data?.coverImageUrl || "").trim();
    return url || localPlaceholder();
  }

  function showError(msg) {
    if (!errorEl) return;
    errorEl.style.display = "block";
    if (msg) errorEl.textContent = msg;
    removeSkeleton();
  }

  /* ------------------------------------------ */
  /* Caché                                        */
  /* ------------------------------------------ */

  function getCachedNews() {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;
      const data = JSON.parse(cached);
      const age  = Date.now() - data.timestamp;
      if (age < CACHE_DURATION) return data.items;
      localStorage.removeItem(CACHE_KEY);
      return null;
    } catch (e) {
      console.warn("Error al leer caché de noticias:", e);
      return null;
    }
  }

  function setCachedNews(items) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ items, timestamp: Date.now() }));
    } catch (e) {
      console.warn("Error al guardar caché de noticias:", e);
    }
  }

  /* ------------------------------------------ */
  /* Skeleton                                     */
  /* ------------------------------------------ */

  function renderSkeleton() {
    grid.innerHTML = Array(6).fill(0).map(() => `
      <div class="news-card skeleton-news">
        <div class="news-image"></div>
        <p class="news-label"></p>
      </div>
    `).join("");
  }

  function removeSkeleton() {
    grid.querySelectorAll(".skeleton-news").forEach((s) => s.remove());
  }

  /* ------------------------------------------ */
  /* Render                                       */
  /* ------------------------------------------ */

  function renderEmpty() {
    grid.innerHTML = "";
    const div = document.createElement("div");
    div.style.cssText = "opacity:.85; padding:10px;";
    div.textContent = "No hay noticias publicadas todavía.";
    grid.appendChild(div);
  }

  function renderNews(items) {
    removeSkeleton();

    if (!items.length) { renderEmpty(); return; }

    items.forEach(({ id, data }) => {
      const fullTitle  = String(data?.title || "Noticia");
      const feedTitle  = getFeedTitle(data);
      const imageUrl   = getCover(data);

      const a      = document.createElement("a");
      a.className  = "news-card";
      a.href       = `news.html?id=${encodeURIComponent(id)}`;

      const imgWrap  = document.createElement("div");
      imgWrap.className = "news-image";

      const img    = document.createElement("img");
      img.loading  = "lazy";
      img.alt      = fullTitle;
      img.src      = imageUrl;
      img.onerror  = () => { img.src = localPlaceholder(); };

      const p      = document.createElement("p");
      p.className  = "news-label";
      p.textContent = feedTitle;

      imgWrap.appendChild(img);
      a.appendChild(imgWrap);
      a.appendChild(p);
      grid.appendChild(a);
    });
  }

  /* ------------------------------------------ */
  /* Firestore                                    */
  /* ------------------------------------------ */

  async function fetchAndUpdateNews(silent = false) {
    try {
      const snap = await window.db
        .collection("news")
        .where("published", "==", true)
        .orderBy("updatedAt", "desc")
        .limit(FEED_LIMIT)
        .get();

      const items = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
      setCachedNews(items);
      if (!silent) renderNews(items);
    } catch (e) {
      console.error("[news-feed] Error fetchAndUpdateNews:", e);
      if (!silent) showError("No se pudieron cargar las noticias.");
    }
  }

  async function loadNews() {
    try {
      const cachedItems = getCachedNews();
      if (cachedItems) {
        renderNews(cachedItems);
        // Actualizar en segundo plano sin bloquear
        fetchAndUpdateNews(true);
        return;
      }
      await fetchAndUpdateNews(false);
    } catch (e) {
      console.error("[news-feed] Error:", e);
      showError("No se pudieron cargar las noticias.");
    }
  }

  /* ------------------------------------------ */
  /* Init: usa el waitForFirebase global          */
  /* (o fallback mínimo si aún no está listo)    */
  /* ------------------------------------------ */

  renderSkeleton();

  function startWait() {
    if (typeof window.waitForFirebase === "function") {
      window.waitForFirebase((err) => {
        if (err) { showError("Firebase no cargó a tiempo."); return; }
        loadNews();
      });
      return;
    }

    // Fallback si firebase-config.js aún no definió waitForFirebase
    let i = 0;
    const t = setInterval(() => {
      i++;
      if (window.db && typeof window.db.collection === "function") {
        clearInterval(t);
        loadNews();
      } else if (i >= 30) {
        clearInterval(t);
        showError("Firebase no cargó a tiempo.");
      }
    }, 100);
  }

  startWait();
});
