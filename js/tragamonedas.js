/* -----------------------------------------------
   TRAGAMONEDAS.JS — VirtualGift
   5 tiradas gratis diarias
----------------------------------------------- */
'use strict';

// -- Constantes --
const SYMBOLS          = ['CH','DI','GR','BE','LE','OR'];
const SYMBOL_DISPLAY   = { CH:'🍒', DI:'💎', GR:'🍇', BE:'🔔', LE:'🍋', OR:'🍊' };
const PAYOUTS          = { CH:150, DI:100, GR:75, BE:50, LE:30, OR:20 };
const FREE_PLAYS       = 5;
const MAX_EXTRA        = 3;
const SPIN_MS          = [900, 1150, 1400];

// -- Estado --
let currentUser  = null;
let userCoins    = 0;
let playsUsed    = 0;
let extraUsed    = 0;
let isSpinning   = false;

// -- Helpers --
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
function symbolText(index) {
  const code = SYMBOLS[index] || SYMBOLS[0];
  return SYMBOL_DISPLAY[code] || code;
}

// -- UI --
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

async function grantExtraPlayFromAd() {
  if (!currentUser || isSpinning) return;
  const adBtn = document.getElementById('adPlayBtn');
  if (adBtn) adBtn.disabled = true;

  try {
    if (!window.VGUnityAds) throw new Error('Unity Ads no esta cargado');
    await window.VGUnityAds.showRewarded({ serverId: currentUser.uid });

    const fn = firebase.functions().httpsCallable('grantUnityAdReward');
    const res = await fn({
      rewardType: 'slot_extra',
      placementId: window.VGUnityAds.config.placements[window.VGUnityAds.getPlatform() === 'ios' ? 'ios' : 'android'].rewarded,
    });

    const data = res.data || {};
    extraUsed = data.extraUsed ?? (extraUsed + 1);
    toast(data.message || '+1 tirada desbloqueada');
    updatePlaysUI();
  } catch (e) {
    console.error('[slot] unity rewarded error', e);
    toast(e.message || 'No se pudo completar el anuncio');
  } finally {
    if (adBtn) adBtn.disabled = false;
  }
}

function setResult(html) {
  const el = document.getElementById('resultDisplay');
  if (el) el.innerHTML = html;
}

// -- Carga de datos --
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

// -- Lógica de juego --
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
      reelEl.textContent = symbolText(rand(SYMBOLS.length));
    }, 80);

    setTimeout(() => {
      clearInterval(iv);
      reelEl.textContent = symbolText(finalIdx);
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
  setResult('<span class="result-miss">Girando...</span>');

  let data;
  try {
    const fn = firebase.functions().httpsCallable('spinSlot');
    const serverResult = await fn();
    data = serverResult.data || {};
  } catch(e) {
    console.error('[slot] spin error', e);
    toast(e.message || 'No se pudo guardar la tirada');
    isSpinning = false;
    updatePlaysUI();
    return;
  }

  const reels = [
    document.getElementById('reel0'),
    document.getElementById('reel1'),
    document.getElementById('reel2'),
  ];
  const resultReels = Array.isArray(data.reels) ? data.reels : [0, 0, 0];

  await Promise.all([
    spinReel(reels[0], resultReels[0], SPIN_MS[0]),
    spinReel(reels[1], resultReels[1], SPIN_MS[1]),
    spinReel(reels[2], resultReels[2], SPIN_MS[2]),
  ]);

  const s = resultReels;
  reels.forEach(r => r.classList.remove('win'));
  if (s[0] === s[1] && s[1] === s[2]) {
    reels.forEach(r => r.classList.add('win'));
  } else {
    [[0,1],[1,2],[0,2]].forEach(([a,b]) => {
      if (s[a] === s[b]) { reels[a].classList.add('win'); reels[b].classList.add('win'); }
    });
  }

  const win = data.win || 0;
  if (win > 0) {
    setResult('<span class="result-win">+' + win + ' VC</span>');
    if (window.VGSounds) VGSounds.prize();
  } else {
    setResult('<span class="result-miss">Sin suerte esta vez</span>');
  }

  playsUsed = data.playsUsed ?? (playsUsed + 1);
  userCoins = data.points ?? (userCoins + win);
  updateBalanceUI();
  isSpinning = false;
  updatePlaysUI();
};

// -- Auth + Init --
window.addEventListener('load', () => {
  window.waitForFirebase(() => {
    firebase.auth().onAuthStateChanged(async user => {
      if (!user) {
        window.location.href = typeof withAppFlag === 'function'
          ? withAppFlag('login.html') : 'login.html';
        return;
      }
      if (!user.emailVerified && user.providerData?.[0]?.providerId === 'password') {
        window.location.href = typeof withAppFlag === 'function'
          ? withAppFlag('verify-pending.html') : 'verify-pending.html';
        return;
      }
      currentUser = user;
      await loadUserData();
      document.getElementById('adPlayBtn')?.addEventListener('click', grantExtraPlayFromAd);
    });
  });
});
