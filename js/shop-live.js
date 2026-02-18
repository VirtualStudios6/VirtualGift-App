/* =========================================================
   SHOP LIVE - VirtualGift
   - Colores por rareza (oficiales Fortnite)
   - Icono V-Bucks real
   - Sin badge de tipo arriba
   ========================================================= */

(() => {
  let unsubShop = null;
  let firstPaintDone = false;

  function getRarityStyle(rarity) {
    const key = String(rarity || "").toLowerCase().trim();
    const map = {
      // Común — gris
      "poco común":  { bg: "linear-gradient(160deg,#818181,#3a3a3a)", border: "rgba(129,129,129,0.5)" },
      "poco comun":  { bg: "linear-gradient(160deg,#818181,#3a3a3a)", border: "rgba(129,129,129,0.5)" },
      "común":       { bg: "linear-gradient(160deg,#818181,#3a3a3a)", border: "rgba(129,129,129,0.5)" },
      "comun":       { bg: "linear-gradient(160deg,#818181,#3a3a3a)", border: "rgba(129,129,129,0.5)" },
      "common":      { bg: "linear-gradient(160deg,#818181,#3a3a3a)", border: "rgba(129,129,129,0.5)" },
      // Infrecuente — verde
      "infrecuente": { bg: "linear-gradient(160deg,#60a32e,#2a4d10)", border: "rgba(96,163,46,0.5)" },
      "uncommon":    { bg: "linear-gradient(160deg,#60a32e,#2a4d10)", border: "rgba(96,163,46,0.5)" },
      // Raro — azul
      "raro":        { bg: "linear-gradient(160deg,#4f6fa8,#1f3a6a)", border: "rgba(79,111,168,0.6)" },
      "rare":        { bg: "linear-gradient(160deg,#4f6fa8,#1f3a6a)", border: "rgba(79,111,168,0.6)" },
      // Épico — morado
      "épico":       { bg: "linear-gradient(160deg,#8b38cc,#4a1575)", border: "rgba(139,56,204,0.6)" },
      "epico":       { bg: "linear-gradient(160deg,#8b38cc,#4a1575)", border: "rgba(139,56,204,0.6)" },
      "epic":        { bg: "linear-gradient(160deg,#8b38cc,#4a1575)", border: "rgba(139,56,204,0.6)" },
      // Legendario — naranja dorado
      "legendario":  { bg: "linear-gradient(160deg,#e8a224,#7a4d08)", border: "rgba(232,162,36,0.6)" },
      "legendary":   { bg: "linear-gradient(160deg,#e8a224,#7a4d08)", border: "rgba(232,162,36,0.6)" },
      // Mítico — amarillo dorado
      "mítico":      { bg: "linear-gradient(160deg,#f0e13c,#7a6e0a)", border: "rgba(240,225,60,0.6)" },
      "mitico":      { bg: "linear-gradient(160deg,#f0e13c,#7a6e0a)", border: "rgba(240,225,60,0.6)" },
      "mythic":      { bg: "linear-gradient(160deg,#f0e13c,#7a6e0a)", border: "rgba(240,225,60,0.6)" },
      // Serie Icon — cyan
      "serie icon":  { bg: "linear-gradient(160deg,#21c9c3,#0a5a57)", border: "rgba(33,201,195,0.6)" },
      "icon":        { bg: "linear-gradient(160deg,#21c9c3,#0a5a57)", border: "rgba(33,201,195,0.6)" },
      // Serie Marvel — rojo
      "serie marvel":{ bg: "linear-gradient(160deg,#c1282d,#5a0a0d)", border: "rgba(193,40,45,0.6)" },
      "marvel":      { bg: "linear-gradient(160deg,#c1282d,#5a0a0d)", border: "rgba(193,40,45,0.6)" },
      // DC
      "dc":          { bg: "linear-gradient(160deg,#1c4fd4,#0a1f6a)", border: "rgba(28,79,212,0.6)" },
    };
    for (const [k, v] of Object.entries(map)) {
      if (key.includes(k)) return v;
    }
    return { bg: "linear-gradient(160deg,#1a1a2e,#0d0d1a)", border: "rgba(255,255,255,0.07)" };
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
