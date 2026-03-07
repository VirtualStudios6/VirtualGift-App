// ═══════════════════════════════════════════════════════
//  VIRTUALGIFT — SORTEOS.JS
//  Usa window.db / window.auth / window.waitForFirebase
//  Campo de coins: data.points (igual que puntos.js)
// ═══════════════════════════════════════════════════════

// ── MOCK (fallback si Firestore no tiene sorteos aún) ──
const MOCK_RAFFLES = [
  {
    id: "raffle_amazon_50",
    title: "Amazon", value: "$50", image: "amazon.png",
    cost: 800, participants: 1247, maxParticipants: 2000,
    endDate: new Date(Date.now() + 2 * 86400000),
    color: "#FF9900", colorDark: "#7a4800",
    tag: "🔥 Popular", tagColor: "#f43f8c", active: true,
  },
  {
    id: "raffle_ps_25",
    title: "PlayStation", value: "$25", image: "psn.png",
    cost: 400, participants: 683, maxParticipants: 1000,
    endDate: new Date(Date.now() + 5 * 86400000),
    color: "#0070d1", colorDark: "#003566",
    tag: "⚡ Fácil de ganar", tagColor: "#8b5cf6", active: true,
  },
  {
    id: "raffle_gplay_10",
    title: "Google Play", value: "$10", image: "google.png",
    cost: 150, participants: 312, maxParticipants: 500,
    endDate: new Date(Date.now() + 1 * 86400000 + 3 * 3600000),
    color: "#34A853", colorDark: "#0d5c26",
    tag: "⏳ Termina pronto", tagColor: "#f5c842", active: true,
  },

  {
    id: "raffle_steam_20",
    title: "Steam", value: "$20", image: "steam.png",
    cost: 320, participants: 198, maxParticipants: 600,
    endDate: new Date(Date.now() + 7 * 86400000),
    color: "#4a8fc1", colorDark: "#0e2a42",
    tag: null, tagColor: null, active: true,
  },

  {
    id: "raffle_xbox_25",
    title: "Xbox", value: "$25", image: "xbox.png",
    cost: 380, participants: 290, maxParticipants: 600,
    endDate: new Date(Date.now() + 6 * 86400000),
    color: "#107C10", colorDark: "#053305",
    tag: null, tagColor: null, active: true,
  },
  {
    id: "raffle_paypal_20",
    title: "PayPal", value: "$20", image: "paypal.png",
    cost: 300, participants: 600, maxParticipants: 900,
    endDate: new Date(Date.now() + 3 * 86400000),
    color: "#003087", colorDark: "#001240",
    tag: "💳 Efectivo", tagColor: "#34d399", active: true,
  },
];

const REQUIREMENTS = [
  { id: "req_follow", icon: "📲", title: "Seguir en Instagram", desc: "@VirtualGift.app — Activa notificaciones", cta: "Seguir ahora", link: "https://instagram.com/", points: 50 },
  { id: "req_ad",     icon: "📺", title: "Ver anuncio",         desc: "Mira el video completo (30 seg)",            cta: "Ver anuncio", link: null, points: 30, waitSeconds: 5 },
  { id: "req_share",  icon: "🔗", title: "Compartir sorteo",    desc: "Comparte en tus redes sociales",             cta: "Compartir",   link: null, points: 20 },
];

// ── ESTADO ──
let currentUser    = null;
let userCoins      = 0;
let allRaffles     = [];
let selectedRaffle = null;
let reqCompleted   = {};
let adTimers       = {};

// ── UTILIDADES ──
function formatTimeLeft(endDate) {
  const diff = endDate - Date.now();
  if (diff <= 0) return "Terminado";
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function getWinChance(participants) {
  const c = (1 / Math.max(participants, 1)) * 100;
  return c < 0.1 ? "<0.1" : c.toFixed(1);
}

function imgPath(filename) {
  return `images/giftcards/${filename}`;
}

function guessImage(title = "") {
  const t = title.toLowerCase();
  if (t.includes("amazon"))                       return "amazon.png";
  if (t.includes("playstation") || t.includes("psn")) return "psn.png";
  if (t.includes("google") || t.includes("play")) return "google.png";
  if (t.includes("steam"))                        return "steam.png";
  if (t.includes("xbox"))                         return "xbox.png";
  if (t.includes("paypal"))                       return "paypal.png";
  return null;
}

// ── UPDATE UI ──
function updateBalanceUI() {
  const el = document.getElementById("balAmount");
  if (el) el.textContent = userCoins.toLocaleString('en-US');
}

function loadNotificationCount(uid) {
  window.db.collection("notifications")
    .where("userId", "==", uid)
    .where("read", "==", false)
    .get()
    .then(snap => {
      const badge = document.getElementById("notificationBadge");
      if (!badge) return;
      badge.textContent = snap.size;
      badge.style.display = snap.size > 0 ? "flex" : "none";
    }).catch(() => {});
}

// ── INIT (usando window.waitForFirebase igual que puntos.js) ──
window.addEventListener("load", () => {
  window.waitForFirebase(() => {
    window.auth.onAuthStateChanged(async (fbUser) => {
      if (!fbUser) {
        window.location.href = typeof withAppFlag === "function"
          ? withAppFlag("index.html") : "index.html";
        return;
      }

      try {
        const snap = await window.db.collection("users").doc(fbUser.uid).get();
        const data = snap.data() || {};

        currentUser = {
          uid:   fbUser.uid,
          name:  data.user || data.displayName || fbUser.displayName || "Usuario",
          // ✅ campo correcto igual que puntos.js
          coins: typeof data.points === "number" ? data.points : 0,
        };
        userCoins = currentUser.coins;
      } catch (e) {
        currentUser = { uid: fbUser.uid, name: "Usuario", coins: 0 };
        userCoins = 0;
      }

      updateBalanceUI();
      loadNotificationCount(fbUser.uid);
      loadRaffles();
    });
  });
});

// ── CARGAR SORTEOS ──
async function loadRaffles() {
  try {
    const snap = await window.db.collection("raffles")
      .where("active", "==", true)
      .get();

    if (!snap.empty) {
      allRaffles = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id, ...data,
          endDate: data.endDate?.toDate ? data.endDate.toDate() : new Date(data.endDate),
          image: data.image || guessImage(data.title),
        };
      });
    } else {
      // No hay sorteos en Firestore aún → usar mock
      allRaffles = MOCK_RAFFLES;
    }
  } catch (e) {
    console.warn("Firestore error, usando mock:", e);
    allRaffles = MOCK_RAFFLES;
  }

  renderRaffles();
}

// ── RENDER CARDS ──
function renderRaffles() {
  const list    = document.getElementById("sgList");
  const countEl = document.getElementById("sgCount");

  countEl.textContent =
    `${allRaffles.length} sorteo${allRaffles.length !== 1 ? "s" : ""} disponible${allRaffles.length !== 1 ? "s" : ""}`;

  if (!allRaffles.length) {
    list.innerHTML = `<div class="sg-loading"><span style="font-size:2.5rem">😔</span><p>No hay sorteos disponibles</p></div>`;
    return;
  }

  list.innerHTML = allRaffles.map((r, i) => buildCard(r, i)).join("");

  list.querySelectorAll(".sg-card").forEach(card => {
    card.addEventListener("click", () => {
      const raffle = allRaffles.find(r => r.id === card.dataset.id);
      if (raffle) openModal(raffle);
    });
    card.querySelector(".sg-card-btn")?.addEventListener("click", e => {
      e.stopPropagation();
      const raffle = allRaffles.find(r => r.id === card.dataset.id);
      if (raffle) openModal(raffle);
    });
  });
}

function buildCard(r, i) {
  const timeLeft  = formatTimeLeft(r.endDate);
  const fillPct   = Math.round((r.participants / r.maxParticipants) * 100);
  const winChance = getWinChance(r.participants);
  const isUrgent  = r.endDate - Date.now() < 86400000;

  const tagHTML = r.tag
    ? `<span class="sg-card-tag" style="color:${r.tagColor};border-color:${r.tagColor}44;background:${r.tagColor}14">${r.tag}</span>`
    : "";

  const imgHTML = r.image
    ? `<div class="sg-card-img-wrap"><img src="${imgPath(r.image)}" alt="${r.title}"></div>`
    : `<div class="sg-card-img-wrap" style="font-size:1.8rem;text-align:center">🎁</div>`;

  return `
  <div class="sg-card" data-id="${r.id}" style="animation-delay:${i * 0.07}s">
    <div class="sg-card-glow" style="background:${r.color}"></div>
    <div class="sg-card-header">
      ${imgHTML}
      <div class="sg-card-titles">
        <p class="sg-card-brand">${r.title}</p>
        <p class="sg-card-value" style="color:${r.color}">Gift Card ${r.value}</p>
      </div>
      ${tagHTML}
    </div>
    <div class="sg-card-stats">
      <div class="sg-card-stat">
        <span class="sg-stat-label">Participantes</span>
        <span class="sg-stat-val">${r.participants.toLocaleString()}</span>
      </div>
      <div class="sg-stat-div"></div>
      <div class="sg-card-stat">
        <span class="sg-stat-label">Tu chance</span>
        <span class="sg-stat-val">${winChance}%</span>
      </div>
      <div class="sg-stat-div"></div>
      <div class="sg-card-stat">
        <span class="sg-stat-label ${isUrgent ? "urgent" : ""}">Termina en</span>
        <span class="sg-stat-val ${isUrgent ? "urgent" : ""}">${timeLeft}</span>
      </div>
    </div>
    <div class="sg-card-progress">
      <div class="sg-prog-track">
        <div class="sg-prog-fill" style="width:${fillPct}%;background:linear-gradient(90deg,${r.colorDark},${r.color})"></div>
      </div>
      <span class="sg-prog-label">${fillPct}% lleno</span>
    </div>
    <div class="sg-card-footer">
      <div class="sg-card-cost">
        <span class="sg-cost-label">Entrada</span>
        <span class="sg-coins">${r.cost.toLocaleString()}</span>
      </div>
      <button class="sg-card-btn" style="background:linear-gradient(135deg,${r.colorDark},${r.color})">
        Participar
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </button>
    </div>
  </div>`;
}

// ── MODAL ──
function openModal(raffle) {
  selectedRaffle = raffle;
  const canAfford = userCoins >= raffle.cost;

  const winChance = getWinChance(raffle.participants + 1);

  const hero = document.getElementById("modalHero");
  hero.style.background  = `linear-gradient(145deg, ${raffle.colorDark}cc, ${raffle.color}22)`;
  hero.style.borderColor = `${raffle.color}33`;
  document.getElementById("modalGlow").style.background = raffle.color;

  const imgEl = document.getElementById("modalImg");
  if (raffle.image) { imgEl.src = imgPath(raffle.image); imgEl.alt = raffle.title; }

  document.getElementById("modalBrand").textContent = `${raffle.title} Gift Card`;
  document.getElementById("modalValue").textContent  = raffle.value;
  document.getElementById("modalValue").style.color  = raffle.color;

  const tagEl = document.getElementById("modalTag");
  if (raffle.tag) {
    tagEl.textContent = raffle.tag;
    tagEl.style.color = raffle.tagColor;
    tagEl.style.borderColor = `${raffle.tagColor}44`;
    tagEl.style.background  = `${raffle.tagColor}18`;
    tagEl.style.display = "inline-block";
  } else {
    tagEl.style.display = "none";
  }

  document.getElementById("mRowSorteo").textContent   = `${raffle.title} ${raffle.value}`;
  document.getElementById("mRowCosto").textContent    = raffle.cost.toLocaleString();
document.getElementById("mRowBalance").textContent  = userCoins.toLocaleString('en-US');


  document.getElementById("mRowPart").textContent     = raffle.participants.toLocaleString();
  document.getElementById("mRowChance").textContent   = `${winChance}%`;
  document.getElementById("mRowTime").textContent     = formatTimeLeft(raffle.endDate);
  document.getElementById("mNoteCost").textContent    = raffle.cost.toLocaleString();

  document.getElementById("mNoticeInfo").style.display = canAfford ? "flex" : "none";
  const warnEl = document.getElementById("mNoticeWarn");
  if (!canAfford) {
    document.getElementById("mWarnText").innerHTML =
      `No tienes suficientes coins. Necesitas <strong>${(raffle.cost - userCoins).toLocaleString()}</strong> más.`;
    warnEl.style.display = "flex";
  } else {
    warnEl.style.display = "none";
  }

  const btn = document.getElementById("mConfirmBtn");
  btn.disabled = !canAfford;
  btn.style.background = canAfford
    ? `linear-gradient(135deg, ${raffle.colorDark}, ${raffle.color})`
    : "";

  document.getElementById("sgOverlay").classList.add("open");
  document.getElementById("sgModal").classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  document.getElementById("sgOverlay").classList.remove("open");
  document.getElementById("sgModal").classList.remove("open");
  document.body.style.overflow = "";
  selectedRaffle = null;
}

// ── CONFIRMAR PARTICIPACIÓN ──
async function confirmParticipation() {
  if (!selectedRaffle || !currentUser) return;

  const btn     = document.getElementById("mConfirmBtn");
  const spinner = document.getElementById("mSpinner");
  const arrow   = document.getElementById("mBtnArrow");
  const text    = document.getElementById("mBtnText");

  btn.disabled          = true;
  spinner.style.display = "inline-block";
  arrow.style.display   = "none";
  text.textContent      = "Procesando…";

  try {
    const db         = window.db;
    const FieldValue = window.firebase.firestore.FieldValue;
    const uid        = currentUser.uid;
    const raffle     = selectedRaffle;

    // Verificar si ya participa
    const existing = await db.collection("raffleParticipants")
      .where("raffleId", "==", raffle.id)
      .where("userId",   "==", uid)
      .get();
    if (!existing.empty) throw new Error("Ya estás participando en este sorteo.");

    // Verificar coins en tiempo real — usa data.points igual que puntos.js
    const userSnap  = await db.collection("users").doc(uid).get();
    const freshCoins = (userSnap.data() || {}).points || 0;
    if (freshCoins < raffle.cost) throw new Error("No tienes suficientes coins.");

    const newCoins = freshCoins - raffle.cost;

    await db.collection("users").doc(uid).update({ points: newCoins });
    await db.collection("raffles").doc(raffle.id).update({
      participants: FieldValue.increment(1),
    });
    await db.collection("raffleParticipants").add({
      raffleId:  raffle.id,
      userId:    uid,
      enteredAt: FieldValue.serverTimestamp(),
      requirementsCompleted: false,
    });

    // Historial de puntos
    await db.collection("pointsHistory").add({
      userId:      uid,
      type:        "raffle_entry",
      points:      -raffle.cost,
      raffleId:    raffle.id,
      raffleTitle: `${raffle.title} ${raffle.value}`,
      createdAt:   FieldValue.serverTimestamp(),
    });

    userCoins = newCoins;
    updateBalanceUI();
    closeModal();
    openSuccess(raffle);

  } catch (err) {
    document.getElementById("mNoticeWarn").style.display = "flex";
    document.getElementById("mWarnText").textContent = err.message || "Ocurrió un error. Intenta de nuevo.";
    btn.disabled          = false;
    spinner.style.display = "none";
    arrow.style.display   = "inline";
    text.textContent      = "Participar en el sorteo";
  }
}

// ── REQUISITOS ──
function openRequirements(raffle) {
  reqCompleted   = {};
  selectedRaffle = raffle;

  const pill = document.getElementById("reqPill");
  if (raffle.image) {
    pill.innerHTML = `<img src="${imgPath(raffle.image)}" style="width:18px;height:18px;object-fit:contain"><span style="color:${raffle.color};font-weight:700">${raffle.title} ${raffle.value}</span>`;
  } else {
    pill.innerHTML = `<span style="color:${raffle.color};font-weight:700">${raffle.title} ${raffle.value}</span>`;
  }
  pill.style.borderColor = `${raffle.color}44`;
  pill.style.background  = `${raffle.color}14`;

  renderReqList();
  updateReqProgress();
  document.getElementById("sgReqScreen").style.display = "block";
  window.scrollTo(0, 0);
}

function renderReqList() {
  document.getElementById("reqList").innerHTML = REQUIREMENTS.map((req, i) => `
    <div class="sg-req-card ${reqCompleted[req.id] ? "done" : ""}" id="reqCard_${req.id}" style="animation-delay:${i * 0.1}s">
      <div class="sg-req-card-icon" id="reqIcon_${req.id}">
        ${req.icon}
        ${reqCompleted[req.id] ? `<div class="sg-req-check"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>` : ""}
      </div>
      <div class="sg-req-card-body">
        <p class="sg-req-card-title">${req.title}</p>
        <p class="sg-req-card-desc">${req.desc}</p>
        <span class="sg-req-card-bonus">+${req.points} coins bonus</span>
      </div>
      <div class="sg-req-card-action" id="reqAction_${req.id}">
        ${reqCompleted[req.id]
          ? `<span class="sg-req-done-badge">✓ Listo</span>`
          : `<button class="sg-req-action-btn" onclick="handleReq('${req.id}')">${req.cta}</button>`}
      </div>
    </div>`
  ).join("");
}

function handleReq(reqId) {
  const req = REQUIREMENTS.find(r => r.id === reqId);
  if (!req || reqCompleted[reqId]) return;

  if (req.waitSeconds) {
    const actionDiv = document.getElementById(`reqAction_${reqId}`);
    let t = req.waitSeconds;
    actionDiv.innerHTML = `<div class="sg-req-countdown" id="countdown_${reqId}">${t}s</div>`;
    adTimers[reqId] = setInterval(() => {
      t--;
      const el = document.getElementById(`countdown_${reqId}`);
      if (el) el.textContent = `${t}s`;
      if (t <= 0) { clearInterval(adTimers[reqId]); markReqDone(reqId); }
    }, 1000);
    return;
  }

  if (req.link) window.open(req.link, "_blank");
  setTimeout(() => markReqDone(reqId), 800);
}

function markReqDone(reqId) {
  reqCompleted[reqId] = true;
  renderReqList();
  updateReqProgress();
}

function updateReqProgress() {
  const total   = REQUIREMENTS.length;
  const done    = Object.values(reqCompleted).filter(Boolean).length;
  const pct     = Math.round((done / total) * 100);
  const allDone = done === total;

  document.getElementById("reqProgressLabel").textContent = `${done} de ${total} completados`;
  document.getElementById("reqProgressPct").textContent   = `${pct}%`;
  document.getElementById("reqFill").style.width          = `${pct}%`;

  const btn = document.getElementById("reqFinishBtn");
  btn.textContent = allDone ? "🎉 Confirmar participación" : `Continuar sin completar todo (${done}/${total})`;
  btn.classList.toggle("ready", allDone);
}

function finishRequirements() {
  const done = Object.values(reqCompleted).filter(Boolean).length;
  if (done > 0 && currentUser && selectedRaffle) {
    window.db.collection("raffleParticipants")
      .where("raffleId", "==", selectedRaffle.id)
      .where("userId",   "==", currentUser.uid)
      .get()
      .then(snap => {
        if (!snap.empty) snap.docs[0].ref.update({ requirementsCompleted: true });
      });
  }
  document.getElementById("sgReqScreen").style.display = "none";
  openSuccess(selectedRaffle);
}

// ── ÉXITO ──
function openSuccess(raffle) {
  const chip = document.getElementById("successChip");
  if (raffle.image) {
    chip.innerHTML = `<img src="${imgPath(raffle.image)}" style="width:22px;height:22px;object-fit:contain"><span style="color:${raffle.color};font-weight:700">${raffle.title} ${raffle.value}</span>`;
  } else {
    chip.innerHTML = `<span style="color:${raffle.color};font-weight:700">${raffle.title} ${raffle.value}</span>`;
  }
  chip.style.borderColor = `${raffle.color}55`;
  chip.style.background  = `${raffle.color}14`;

  document.getElementById("successTime").textContent = formatTimeLeft(raffle.endDate);
  document.getElementById("sgSuccessScreen").style.display = "flex";
  window.scrollTo(0, 0);
}
