/* =========================================================
   FORTNITE SHOP (REALTIME)
   - Lee Firestore: shopDailyItems
   - Renderiza en #shopSkinsGrid y #shopEmotesGrid
   ========================================================= */

(() => {
  function el(id) {
    return document.getElementById(id);
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function typeIsOutfit(t) {
    return String(t || "").toLowerCase().includes("outfit");
  }

  function typeIsEmote(t) {
    return String(t || "").toLowerCase().includes("emote");
  }

  function renderCards(container, items) {
    if (!container) return;

    if (!items || items.length === 0) {
      container.innerHTML = `
        <div class="skin-card">
          <div class="skin-badge">🔵 FORTNITE</div>
          <div class="skin-image"></div>
          <p class="skin-name">No hay items hoy</p>
        </div>
      `;
      return;
    }

    container.innerHTML = items
      .map((it) => {
        const name = escapeHtml(it.name || "Item");
        const img = escapeHtml(it.imageUrl || "");
        const price = Number(it.price || 0);
        const badge = "🛒 TIENDA";
        const showPrice = price > 0 ? `• ${price} V-Bucks` : "";

        return `
          <div class="skin-card">
            <div class="skin-badge">🔵 FORTNITE ${badge}</div>
            <div class="skin-image">
              ${
                img
                  ? `<img src="${img}" alt="${name}" loading="lazy" onerror="this.style.display='none'">`
                  : ``
              }
            </div>
            <p class="skin-name">${name} <span style="opacity:.7;font-weight:700">${showPrice}</span></p>
          </div>
        `;
      })
      .join("");
  }

  function initRealtimeShop() {
    if (!window.db) {
      console.warn("Firestore (window.db) no está listo aún.");
      return;
    }

    const skinsGrid = el("shopSkinsGrid");
    const emotesGrid = el("shopEmotesGrid");

    if (!skinsGrid || !emotesGrid) {
      console.warn("Faltan contenedores #shopSkinsGrid / #shopEmotesGrid en inicio.html");
      return;
    }

    // placeholders
    skinsGrid.innerHTML = `<div class="skin-card"><p class="skin-name">Cargando tienda...</p></div>`;
    emotesGrid.innerHTML = `<div class="emote-card"><p class="emote-name">Cargando tienda...</p></div>`;

    window.db
      .collection("shopDailyItems")
      .orderBy("sort", "asc")
      .onSnapshot(
        (snap) => {
          const all = [];
          snap.forEach((d) => all.push({ id: d.id, ...d.data() }));

          const skins = all.filter((x) => typeIsOutfit(x.type));
          const emotes = all.filter((x) => typeIsEmote(x.type));

          // reusamos cards de skins para ambos por consistencia visual
          renderCards(skinsGrid, skins);

          // emotes: usa el mismo render pero en emotesGrid
          // (tu CSS emote-card existe, pero skin-card se ve mejor)
          // Si quieres 100% emote-card después lo ajustamos.
          emotesGrid.classList.remove("emotes-grid"); // opcional, si quieres
          emotesGrid.classList.add("skins-grid");
          renderCards(emotesGrid, emotes);
        },
        (err) => {
          console.error("shopDailyItems snapshot error:", err);
          skinsGrid.innerHTML = `<div class="skin-card"><p class="skin-name" style="color:#ef4444">Error cargando tienda</p></div>`;
          emotesGrid.innerHTML = `<div class="skin-card"><p class="skin-name" style="color:#ef4444">Error cargando tienda</p></div>`;
        }
      );
  }

  // Espera a firebase-config.js
  function waitDb(max = 80) {
    let i = 0;
    const t = setInterval(() => {
      i++;
      if (window.db) {
        clearInterval(t);
        initRealtimeShop();
      } else if (i >= max) {
        clearInterval(t);
        console.warn("Timeout esperando window.db");
      }
    }, 100);
  }

  window.addEventListener("load", () => waitDb());
})();
