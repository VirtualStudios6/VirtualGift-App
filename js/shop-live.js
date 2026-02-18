/* =========================================================
   SHOP LIVE - VirtualGift
   - Colores por rareza
   - Icono V-Bucks real
   - Sin badge de tipo arriba
   ========================================================= */

(() => {
  let unsubShop = null;
  let firstPaintDone = false;

  const RARITY_COLORS = {
    "common":    { bg: "linear-gradient(160deg, #4a4a4a 0%, #2a2a2a 100%)", border: "rgba(150,150,150,0.3)" },
    "uncommon":  { bg: "linear-gradient(160deg, #2d6a2d 0%, #1a3d1a 100%)", border: "rgba(80,180,80,0.3)" },
    "rare":      { bg: "linear-gradient(160deg, #1a4a8a 0%, #0d2a55 100%)", border: "rgba(80,140,255,0.4)" },
    "epic":      { bg: "linear-gradient(160deg, #5a1a9a 0%, #2d0d55 100%)", border: "rgba(160,80,255,0.4)" },
    "legendary": { bg: "linear-gradient(160deg, #9a5a1a 0%, #552d0d 100%)", border: "rgba(255,160,60,0.4)" },
    "mythic":    { bg: "linear-gradient(160deg, #9a8a0d 0%, #55490d 100%)", border: "rgba(255,220,40,0.4)" },
    "icon":      { bg: "linear-gradient(160deg, #0d7a7a 0%, #0d3d4a 100%)", border: "rgba(80,240,240,0.4)" },
    "marvel":    { bg: "linear-gradient(160deg, #8a1a1a 0%, #4a0d0d 100%)", border: "rgba(220,60,60,0.4)" },
    "dc":        { bg: "linear-gradient(160deg, #1a1a6a 0%, #0d0d3a 100%)", border: "rgba(80,80,220,0.4)" },
    "default":   { bg: "linear-gradient(160deg, #1a1a2e 0%, #0d0d1a 100%)", border: "rgba(255,255,255,0.07)" },
  };

function getRarityStyle(rarity) {
  const key = String(rarity || "").toLowerCase().trim();
  const map = {
    // Inglés
    "common":    { bg: "linear-gradient(160deg, #4a4a4a 0%, #2a2a2a 100%)", border: "rgba(150,150,150,0.3)" },
    "uncommon":  { bg: "linear-gradient(160deg, #2d6a2d 0%, #1a3d1a 100%)", border: "rgba(80,180,80,0.3)" },
    "rare":      { bg: "linear-gradient(160deg, #1a4a8a 0%, #0d2a55 100%)", border: "rgba(80,140,255,0.4)" },
    "epic":      { bg: "linear-gradient(160deg, #5a1a9a 0%, #2d0d55 100%)", border: "rgba(160,80,255,0.4)" },
    "legendary": { bg: "linear-gradient(160deg, #9a5a1a 0%, #552d0d 100%)", border: "rgba(255,160,60,0.4)" },
    "mythic":    { bg: "linear-gradient(160deg, #9a8a0d 0%, #55490d 100%)", border: "rgba(255,220,40,0.4)" },
    "icon":      { bg: "linear-gradient(160deg, #0d7a7a 0%, #0d3d4a 100%)", border: "rgba(80,240,240,0.4)" },
    "marvel":    { bg: "linear-gradient(160deg, #8a1a1a 0%, #4a0d0d 100%)", border: "rgba(220,60,60,0.4)" },
    // Español
    "poco común": { bg: "linear-gradient(160deg, #4a4a4a 0%, #2a2a2a 100%)", border: "rgba(150,150,150,0.3)" },
    "poco comun": { bg: "linear-gradient(160deg, #4a4a4a 0%, #2a2a2a 100%)", border: "rgba(150,150,150,0.3)" },
    "infrecuente":{ bg: "linear-gradient(160deg, #2d6a2d 0%, #1a3d1a 100%)", border: "rgba(80,180,80,0.3)" },
    "raro":      { bg: "linear-gradient(160deg, #1a4a8a 0%, #0d2a55 100%)", border: "rgba(80,140,255,0.4)" },
    "épico":     { bg: "linear-gradient(160deg, #5a1a9a 0%, #2d0d55 100%)", border: "rgba(160,80,255,0.4)" },
    "epico":     { bg: "linear-gradient(160deg, #5a1a9a 0%, #2d0d55 100%)", border: "rgba(160,80,255,0.4)" },
    "legendario":{ bg: "linear-gradient(160deg, #9a5a1a 0%, #552d0d 100%)", border: "rgba(255,160,60,0.4)" },
    "mítico":    { bg: "linear-gradient(160deg, #9a8a0d 0%, #55490d 100%)", border: "rgba(255,220,40,0.4)" },
    "serie icon":{ bg: "linear-gradient(160deg, #0d7a7a 0%, #0d3d4a 100%)", border: "rgba(80,240,240,0.4)" },
    "serie marvel":{ bg: "linear-gradient(160deg, #8a1a1a 0%, #4a0d0d 100%)", border: "rgba(220,60,60,0.4)" },
  };
  for (const [k, v] of Object.entries(map)) {
    if (key.includes(k)) return v;
  }
  return { bg: "linear-gradient(160deg, #1a1a2e 0%, #0d0d1a 100%)", border: "rgba(255,255,255,0.07)" };
}
  const VBUCK_ICON = "https://fortnite-api.com/images/vbuck.png";

  function isFirebaseReady() {
    return typeof firebase !== "undefined" &&
      typeof firebase.firestore === "function" &&
      window.db;
  }

  function waitForFirebase(callback, maxAttempts = 80) {
    let attempts = 0;
    const check = setInterval(() => {
      attempts++;
      if (isFirebaseReady()) { clearInterval(check); callback(); }
      else if (attempts >= maxAttempts) { clearInterval(check); console.warn("ShopLive: Firebase no listo."); }
    }, 100);
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;").replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function safeImg(url) {
    const u = String(url || "").trim();
    return u ? escapeHtml(u) : "";
  }

  function normalizeType(item) {
    const t = String(item.type || item.itemType || item.category || "").toLowerCase().trim();
    if (t.includes("emote") || t.includes("dance") || t.includes("sprays") || t.includes("toy")) return "emote";
    if (t.includes("outfit") || t.includes("skin") || t.includes("character") || t.includes("traje")) return "skin";
    return "other";
  }

  function renderSkeletons() {
    const sg = document.getElementById("skinsGrid");
    const eg = document.getElementById("emotesGrid");
    const skel = (cls) => `
      <div class="${cls} skeleton-news">
        <div class="card-image"></div>
        <div class="card-info">
          <p style="height:13px;width:70%;background:rgba(255,255,255,0.1);border-radius:4px;margin-bottom:6px;"></p>
          <p style="height:11px;width:50%;background:rgba(255,255,255,0.07);border-radius:4px;"></p>
        </div>
      </div>`;
    if (sg) sg.innerHTML = Array.from({length: 8}).map(() => skel("skin-card")).join("");
    if (eg) eg.innerHTML = Array.from({length: 6}).map(() => skel("emote-card")).join("");
  }

  function renderSkins(items) {
    const container = document.getElementById("skinsGrid");
    if (!container) return;
    if (!items.length) {
      container.innerHTML = `<div class="skin-card"><p class="skin-name" style="padding:20px;opacity:.5;text-align:center">No hay skins hoy</p></div>`;
      return;
    }
    container.innerHTML = items.map((item) => {
      const name = escapeHtml(item.name || "Skin");
      const img = safeImg(item.imageUrl);
      const price = item.price || 0;
      const style = getRarityStyle(item.rarity);
      return `
        <div class="skin-card" style="background:${style.bg};border-color:${style.border}">
          <div class="card-image">
            ${img ? `<img src="${img}" alt="${name}" loading="lazy" onerror="this.style.display='none'">` : ""}
          </div>
          <div class="card-info">
            <p class="skin-name">${name}</p>
            ${price ? `<div class="vbucks-price">
              <img src="${VBUCK_ICON}" alt="V" class="vbuck-icon" onerror="this.style.display='none'">
              <span>${price}</span>
            </div>` : ""}
          </div>
        </div>`;
    }).join("");
  }

  function renderEmotes(items) {
    const container = document.getElementById("emotesGrid");
    if (!container) return;
    if (!items.length) {
      container.innerHTML = `<div class="emote-card"><p class="emote-name" style="padding:20px;opacity:.5;text-align:center">No hay emotes hoy</p></div>`;
      return;
    }
    container.innerHTML = items.map((item) => {
      const name = escapeHtml(item.name || "Emote");
      const img = safeImg(item.imageUrl);
      const price = item.price || 0;
      const style = getRarityStyle(item.rarity);
      return `
        <div class="emote-card" style="background:${style.bg};border-color:${style.border}">
          <div class="card-image">
            ${img ? `<img src="${img}" alt="${name}" loading="lazy" onerror="this.style.display='none'">` : ""}
          </div>
          <div class="card-info">
            <p class="emote-name">${name}</p>
            ${price ? `<div class="vbucks-price">
              <img src="${VBUCK_ICON}" alt="V" class="vbuck-icon" onerror="this.style.display='none'">
              <span>${price}</span>
            </div>` : ""}
          </div>
        </div>`;
    }).join("");
  }

  function startRealtimeShop() {
    if (!window.db) return;
    if (typeof unsubShop === "function") { try { unsubShop(); } catch (_) {} unsubShop = null; }
    if (!firstPaintDone) renderSkeletons();

    unsubShop = window.db
      .collection("shopDailyItems")
      .orderBy("sort", "asc")
      .onSnapshot(
        (snap) => {
          firstPaintDone = true;
          const skins = [], emotes = [];
          snap.forEach((doc) => {
            const item = { id: doc.id, ...doc.data() };
            const type = normalizeType(item);
            if (type === "skin") skins.push(item);
            else if (type === "emote") emotes.push(item);
          });
          console.log(`ShopLive: ${skins.length} skins, ${emotes.length} emotes`);
          renderSkins(skins.slice(0, 15));
          renderEmotes(emotes.slice(0, 15));
        },
        (err) => {
          console.error("ShopLive onSnapshot error:", err);
          const sg = document.getElementById("skinsGrid");
          const eg = document.getElementById("emotesGrid");
          if (sg) sg.innerHTML = `<p style="color:#ef4444;padding:16px">Error cargando tienda</p>`;
          if (eg) eg.innerHTML = "";
        }
      );
  }

  window.addEventListener("load", () => waitForFirebase(() => startRealtimeShop()));
})();
