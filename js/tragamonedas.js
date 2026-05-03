/* ═══════════════════════════════════════════════
   TRAGAMONEDAS.JS — VirtualGift
   5 tiradas gratis/día · +1 por anuncio (máx 3)
═══════════════════════════════════════════════ */
'use strict';

// ── Constantes ──
const SYMBOLS    = ['🎁','💎','⭐','🍀','🪙','🔥'];
const PAYOUTS    = { '🎁':150, '💎':100, '⭐':75, '🍀':50, '🪙':30, '🔥':20 };
const FREE_PLAYS = 5;
const MAX_EXTRA  = 3;    // extra tiradas por día via anuncio
const SPIN_MS    = [900, 1150, 1400]; // delay de parada por carrete

// ── Estado ──
let currentUser  = null;
let userCoins    = 0;
let playsUsed    = 0;
let extraUsed    = 0;
let isSpinning   = false;

// ── Helpers ──
function today() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}
function toast(msg) {
  const el = document.getElementById('gameToast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2800);
}
function rand(n) { return Math.floor(Math.random() * n); }

// ── UI ──
function updateBalanceUI() {
  const el = document.getElementById('balanceVal');
  if (el) el.textContent = userCoins.toLocaleString('en-US');
}

function updatePlaysUI() {
  const total    = FREE_PLAYS + extraUsed; // total tiradas disponibles
  const remaining = Math.max(total - playsUsed, 0);
  const label    = document.getElementById('playsLabel');
  const pips     = document.getElementById('playsPips');
  const spinBtn  = document.getElementById('spinBtn');
  const adRow    = document.getElementById('adPlayRow');
  const adBtn    = document.getElementById('adPlayBtn');

  if (label) label.textContent = `${remaining} tirada${remaining !== 1 ? 's' : ''} restante${remaining !== 1 ? 's' : ''}`;

  if (pips) {
    pips.innerHTML = '';
    for (let i = 0; i < FREE_PLAYS; i++) {
      const pip = document.createElement('div');
      pip.className = 'plays-pip' + (i < playsUsed ? ' used' : (i === playsUsed ? ' active' : ''));
      pips.appendChild(pip);
    }
  }

  const canPlay = remaining > 0 && !isSpinning;
  if (spinBtn) spinBtn.disabled = !canPlay;

  const canExtra = extraUsed < MAX_EXTRA && remaining === 0;
  if (adRow) adRow.style.display = canExtra ? 'flex' : 'none';
  if (adBtn) adBtn.disabled = false;
}

function setResult(html) {
  const el = document.getElementById('resultDisplay');
  if (el) el.innerHTML = html;
}

// ── Carga de datos ──
async function loadUserData() {
  if (!currentUser) return;
  try {
    const doc  = await window.db.collection('users').doc(currentUser.uid).get();
    const data = doc.data() || {};

    userCoins = data.points || 0;

    // Plays del día
    if (data.slotDate === today()) {
      playsUsed  = data.slotPlays  || 0;
      extraUsed  = data.slotExtra  || 0;
    } else {
      playsUsed = 0;
      extraUsed = 0;
    }

    updateBalanceUI();
    updatePlaysUI();
  } catch(e) {
    console.error('[slot] loadUserData', e);
  }
}

// ── Lógica de juego ──
function calcWin(s0, s1, s2) {
  if (s0 === s1 && s1 === s2) return PAYOUTS[SYMBOLS[s0]] || 20;
  if (s0 === s1 || s1 === s2 || s0 === s2) return 8;
  return 0;
}

function spinReel(reelEl, finalIdx, delayMs) {
  return new Promise(resolve => {
    reelEl.classList.add('spinning');
    reelEl.classList.remove('win');

    const iv = setInterval(() => {
      reelEl.textContent = SYMBOLS[rand(SYMBOLS.length)];
    }, 80);

    setTimeout(() => {
      clearInterval(iv);
      reelEl.textContent = SYMBOLS[finalIdx];
      reelEl.classList.remove('spinning');
      resolve();
    }, delayMs);
  });
}

window.doSpin = async function() {
  const total = FREE_PLAYS + extraUsed;
  if (playsUsed >= total || isSpinning) return;

  isSpinning = true;
  const spinBtn = document.getElementById('spinBtn');
  if (spinBtn) spinBtn.disabled = true;
  setResult('<span class="result-miss">Girando…</span>');

  // Determinar resultado
  const r0 = rand(SYMBOLS.length);
  const r1 = rand(SYMBOLS.length);
  const r2 = rand(SYMBOLS.length);
  const win = calcWin(r0, r1, r2);

  // Animar carretes (parada escalonada)
  const reels = [
    document.getElementById('reel0'),
    document.getElementById('reel1'),
    document.getElementById('reel2'),
  ];

  await Promise.all([
    spinReel(reels[0], r0, SPIN_MS[0]),
    spinReel(reels[1], r1, SPIN_MS[1]),
    spinReel(reels[2], r2, SPIN_MS[2]),
  ]);

  // Highlight ganancias
  const s = [r0, r1, r2];
  if (r0 === r1 && r1 === r2) {
    reels.forEach(r => r.classList.add('win'));
  } else {
    [[0,1],[1,2],[0,2]].forEach(([a,b]) => {
      if (s[a] === s[b]) { reels[a].classList.add('win'); reels[b].classList.add('win'); }
    });
  }

  // Mostrar resultado
  if (win > 0) {
    setResult(`<span class="result-win">+${win} 🪙</span>`);
    if (window.VGSounds) VGSounds.prize();
  } else {
    setResult('<span class="result-miss">Sin suerte esta vez 😅</span>');
  }

  // Guardar en Firestore
  playsUsed++;
  const newCoins = userCoins + win;
  try {
    const updateData = {
      slotDate:  today(),
      slotPlays: playsUsed,
      slotExtra: extraUsed,
    };
    if (win > 0) {
      updateData.points = firebase.firestore.FieldValue.increment(win);
    }
    await window.db.collection('users').doc(currentUser.uid).update(updateData);

    if (win > 0) {
      userCoins = newCoins;
      updateBalanceUI();
      await window.db.collection('pointsHistory').add({
        userId:    currentUser.uid,
        type:      'slot_win',
        points:    win,
        createdAt: firebase.firestore.Timestamp.now(),
      });
    }
  } catch(e) {
    console.error('[slot] save error', e);
    toast('Error al guardar resultado');
  }

  isSpinning = false;
  updatePlaysUI();
};

// ── Anuncio para tirada extra ──
let adTimer = null;

window.watchAd = function() {
  const overlay = document.getElementById('adOverlay');
  const timerEl = document.getElementById('adTimerVal');
  const closeBtn = document.getElementById('adCloseBtn');
  if (!overlay) return;

  overlay.style.display = 'flex';
  closeBtn.disabled = true;
  closeBtn.classList.remove('ready');

  let secs = 6;
  if (timerEl) timerEl.textContent = secs;

  clearInterval(adTimer);
  adTimer = setInterval(() => {
    secs--;
    if (timerEl) timerEl.textContent = secs;
    if (secs <= 0) {
      clearInterval(adTimer);
      closeBtn.disabled = false;
      closeBtn.classList.add('ready');
    }
  }, 1000);
};

window.closeAd = async function() {
  const overlay = document.getElementById('adOverlay');
  if (overlay) overlay.style.display = 'none';
  clearInterval(adTimer);

  extraUsed++;
  try {
    await window.db.collection('users').doc(currentUser.uid).update({
      slotDate:  today(),
      slotExtra: extraUsed,
    });
  } catch(e) { console.error('[slot] closeAd save', e); }

  toast('✅ +1 tirada desbloqueada');
  updatePlaysUI();
};

// ── Auth + Init ──
window.addEventListener('load', () => {
  window.waitForFirebase(() => {
    firebase.auth().onAuthStateChanged(async user => {
      if (!user) {
        window.location.href = typeof withAppFlag === 'function'
          ? withAppFlag('index.html') : 'index.html';
        return;
      }
      if (!user.emailVerified && user.providerData?.[0]?.providerId === 'password') {
        window.location.href = typeof withAppFlag === 'function'
          ? withAppFlag('verify-pending.html') : 'verify-pending.html';
        return;
      }
      currentUser = user;
      await loadUserData();
    });
  });
});
