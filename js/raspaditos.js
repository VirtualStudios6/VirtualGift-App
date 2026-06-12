'use strict';

// ── Config ──────────────────────────────────────────────────────────────────
const FREE_CARDS = 3;

const PRIZE_SYMBOLS = {
  500: { icon: '💎', label: 'DIAMANTE' },
  250: { icon: '⭐', label: 'ESTRELLA' },
  100: { icon: '🪙', label: 'MONEDA'   },
   50: { icon: '🎮', label: 'GAMER'    },
};
const MISS_POOL = ['🍀','🌈','🎪','🌸','🎈','🎯'];

function generateSymbols(coins) {
  if (coins > 0) {
    const sym = PRIZE_SYMBOLS[coins] || PRIZE_SYMBOLS[50];
    return [sym, sym, sym];
  }
  // No match — pick 3 different icons
  const pool = [
    ...Object.values(PRIZE_SYMBOLS),
    ...MISS_POOL.map(ic => ({ icon: ic, label: '' })),
  ].sort(() => Math.random() - .5);
  const s = [pool[0], pool[1], pool[2]];
  // Guard against accidental triple
  if (s[0].icon === s[1].icon && s[1].icon === s[2].icon) {
    s[2] = pool[3] || { icon: '🌟', label: '' };
  }
  return s;
}

// ── State ───────────────────────────────────────────────────────────────────
let currentUser   = null;
let cardsUsed     = 0;
let cardsTotal    = FREE_CARDS;
let scratching    = false;
let cardRevealed  = false;
let currentPrize  = null;
let currentSyms   = null;
let canvas, ctx;
let sessionCoins  = 0;

// ── Utils ───────────────────────────────────────────────────────────────────
function $(id)  { return document.getElementById(id); }

function showToast(msg, dur) {
  const t = $('gameToast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), dur || 2500);
}

function setBalance(pts) {
  const el = $('balanceVal');
  if (el) el.textContent = Number(pts).toLocaleString();
}

function updatePlaysUI() {
  const label   = $('playsLabel');
  const pips    = $('playsPips');
  const sesCoins = $('sessionCoinsVal');
  const rem = Math.max(cardsTotal - cardsUsed, 0);

  if (label) label.textContent = `${rem} raspadito${rem !== 1 ? 's' : ''} disponible${rem !== 1 ? 's' : ''}`;

  if (pips) {
    pips.innerHTML = '';
    for (let i = 0; i < cardsTotal; i++) {
      const d = document.createElement('div');
      d.className = 'plays-pip' + (i < cardsUsed ? ' used' : '');
      pips.appendChild(d);
    }
  }

  if (sesCoins) sesCoins.textContent = `+${sessionCoins} 🪙`;
}

// ── Canvas helpers ───────────────────────────────────────────────────────────
function rrect(cx, x, y, w, h, r) {
  cx.beginPath();
  cx.moveTo(x + r, y);
  cx.arcTo(x + w, y,     x + w, y + h, r);
  cx.arcTo(x + w, y + h, x,     y + h, r);
  cx.arcTo(x,     y + h, x,     y,     r);
  cx.arcTo(x,     y,     x + w, y,     r);
  cx.closePath();
}

function initCanvas() {
  canvas = $('scratchCanvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  bindScratchEvents();
}

function resizeCanvas() {
  const zone = $('scScratchZone');
  if (!zone || !canvas) return;
  canvas.width  = zone.clientWidth  || 300;
  canvas.height = zone.clientHeight || 160;
}

function drawScratchLayer() {
  if (!ctx || !canvas || canvas.width === 0 || canvas.height === 0) return;
  const W = canvas.width, H = canvas.height;

  ctx.clearRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';

  // Silver metallic base
  const base = ctx.createLinearGradient(0, 0, W, H);
  base.addColorStop(0,   '#d6d6d6');
  base.addColorStop(0.3, '#f2f2f2');
  base.addColorStop(0.7, '#c4c4c4');
  base.addColorStop(1,   '#dcdcdc');
  ctx.fillStyle = base;
  rrect(ctx, 0, 0, W, H, 12);
  ctx.fill();

  // Sheen
  const sheen = ctx.createLinearGradient(0, 0, W * 0.7, 0);
  sheen.addColorStop(0,   'rgba(255,255,255,0)');
  sheen.addColorStop(0.4, 'rgba(255,255,255,0.32)');
  sheen.addColorStop(0.65,'rgba(255,255,255,0.08)');
  sheen.addColorStop(1,   'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  rrect(ctx, 0, 0, W, H, 12);
  ctx.fill();

  // Gold glitter dots
  for (let i = 0; i < 120; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = Math.random() * 1.8 + 0.4;
    const a = Math.random() * 0.55 + 0.1;
    ctx.fillStyle = `rgba(255,200,40,${a})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // VG watermark pattern
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = '#3d2000';
  ctx.font = 'bold 13px Inter, sans-serif';
  ctx.textAlign = 'center';
  for (let col = 0; col <= Math.ceil(W / 70); col++) {
    for (let row = 0; row <= Math.ceil(H / 24); row++) {
      ctx.fillText('VG', col * 70 + (row % 2 === 0 ? 0 : 35), row * 24 + 12);
    }
  }
  ctx.restore();

  // Center label
  const cx = W / 2, cy = H / 2;
  ctx.fillStyle = 'rgba(70,40,0,0.68)';
  ctx.font = 'bold 15px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🎴  RASPA AQUÍ', cx, cy - 9);
  ctx.font = '600 11px Inter, sans-serif';
  ctx.fillStyle = 'rgba(70,40,0,0.42)';
  ctx.fillText('Usa el dedo o el cursor', cx, cy + 11);
}

function bindScratchEvents() {
  if (!canvas) return;
  const setScr  = (v) => () => { scratching = v; };
  canvas.addEventListener('mousedown',  setScr(true));
  canvas.addEventListener('mouseup',    setScr(false));
  canvas.addEventListener('mouseleave', setScr(false));
  canvas.addEventListener('mousemove',  onScratch);
  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); scratching = true;  }, { passive: false });
  canvas.addEventListener('touchend',   (e) => { e.preventDefault(); scratching = false; }, { passive: false });
  canvas.addEventListener('touchmove',  (e) => { e.preventDefault(); onScratch(e); }, { passive: false });
}

function getPos(e) {
  const rect   = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  const src    = e.touches ? e.touches[0] : e;
  return {
    x: (src.clientX - rect.left) * scaleX,
    y: (src.clientY - rect.top)  * scaleY,
  };
}

function onScratch(e) {
  if (!scratching || cardRevealed || !currentPrize) return;
  const { x, y } = getPos(e);
  const isMobile = !!e.touches;
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(x, y, isMobile ? 36 : 28, 0, Math.PI * 2);
  ctx.fill();
  checkScratched();
}

function checkScratched() {
  if (!canvas || canvas.width === 0 || canvas.height === 0) return;
  const data    = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const total   = canvas.width * canvas.height;
  let   visible = 0;
  for (let i = 3; i < data.data.length; i += 4) {
    if (data.data[i] > 0) visible++;
  }
  if (1 - (visible / total) > 0.60) doAutoReveal();
}

// ── Reveal logic ─────────────────────────────────────────────────────────────
window.doAutoReveal = function () {
  if (cardRevealed || !currentPrize) return;
  cardRevealed = true;

  // Wipe canvas
  if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Animate cells one by one
  const cells = document.querySelectorAll('.sc-cell');
  const isWin = currentPrize.coins > 0;
  cells.forEach((cell, i) => {
    setTimeout(() => {
      cell.classList.add('sc-cell-revealed');
      if (isWin) cell.classList.add('sc-cell-win');
    }, i * 140);
  });

  // Show result panel
  setTimeout(() => {
    showPrizeResult(currentPrize);
    if (isWin && window.VGSounds) VGSounds.prize();
  }, cells.length * 140 + 250);
};

function renderCells(syms) {
  const container = $('scCells');
  if (!container) return;
  container.innerHTML = syms.map(s =>
    `<div class="sc-cell">
      <span class="sc-sym">${s.icon}</span>
      <span class="sc-lbl">${s.label || ''}</span>
    </div>`
  ).join('');
}

function showPrizeResult(prize) {
  const win = prize.coins > 0;
  const panel = $('revealResult');
  if (!panel) return;

  $('rrIcon').textContent  = win ? '🎉' : '😔';
  $('rrTitle').textContent = win ? `¡Ganaste!` : 'Sin suerte esta vez';

  const coinsEl = $('rrCoins');
  if (coinsEl) {
    coinsEl.innerHTML   = win
      ? `+${prize.coins} <img src="images/coin.png" class="coin-img" alt="coin">`
      : `0 <img src="images/coin.png" class="coin-img" alt="coin">`;
    coinsEl.className   = 'rr-coins ' + (win ? 'win' : 'miss');
  }

  $('rrSub').textContent  = win
    ? 'Coins agregados a tu cuenta automáticamente.'
    : 'Prueba en tu siguiente raspadito.';

  const remaining = cardsTotal - cardsUsed;
  const rrBtn = $('rrBtn');
  if (remaining > 0) {
    rrBtn.textContent = `Siguiente raspadito (${remaining} restante${remaining !== 1 ? 's' : ''}) →`;
    rrBtn.onclick = nextCard;
  } else {
    rrBtn.textContent = 'Ver resumen del día';
    rrBtn.onclick = showDaySummary;
  }

  panel.classList.remove('hidden');

  // Win sparkle effect
  if (win) spawnSparkles();
}

// ── Sparkle animation ────────────────────────────────────────────────────────
function spawnSparkles() {
  const wrap = $('scCard');
  if (!wrap) return;
  for (let i = 0; i < 18; i++) {
    const p = document.createElement('span');
    p.className = 'sc-sparkle';
    p.textContent = ['✨','⭐','💫','🌟'][Math.floor(Math.random() * 4)];
    p.style.cssText = `
      left:${10 + Math.random() * 80}%;
      animation-delay:${Math.random() * 0.5}s;
      animation-duration:${0.7 + Math.random() * 0.6}s;
      font-size:${0.8 + Math.random() * 0.8}rem;
    `;
    wrap.appendChild(p);
    setTimeout(() => p.remove(), 1400);
  }
}

// ── Day summary ───────────────────────────────────────────────────────────────
function showDaySummary() {
  $('cardArea').classList.add('hidden');
  const ss = $('daySummary');
  if (!ss) { goHome(); return; }
  ss.classList.remove('hidden');

  $('dsTotalCoins').innerHTML = `${sessionCoins} <img src="images/coin.png" class="coin-img" alt="coin">`;
  $('dsCardsUsed').textContent = `${cardsUsed}/${cardsTotal}`;

  // countdown
  const now  = new Date();
  const mid  = new Date(now); mid.setHours(24, 0, 0, 0);
  const diff = Math.round((mid - now) / 1000);
  const h    = Math.floor(diff / 3600);
  const m    = Math.floor((diff % 3600) / 60);
  const cdEl = $('dsCooldown');
  if (cdEl) cdEl.textContent = `Vuelve en ${h}h ${m}m`;
}

function goHome() {
  window.location.href = typeof withAppFlag === 'function' ? withAppFlag('inicio.html') : 'inicio.html';
}

// ── New card flow ─────────────────────────────────────────────────────────────
window.requestCard = async function () {
  const btn = $('requestBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Generando…'; }

  try {
    const fn  = firebase.functions().httpsCallable('scratchCard');
    const res = await fn({});
    const d   = res.data;

    cardsUsed  = d.cardsUsed;
    cardsTotal = d.cardsUsed + d.cardsRemaining;
    setBalance(d.points);
    sessionCoins += d.coins || 0;
    updatePlaysUI();

    currentPrize  = { coins: d.coins };
    currentSyms   = generateSymbols(d.coins);
    cardRevealed  = false;

    // Show card area, hide request area
    $('readyArea').classList.add('hidden');
    $('cardArea').classList.remove('hidden');
    $('revealResult').classList.add('hidden');

    renderCells(currentSyms);

    // Defer canvas resize to next frame so layout is computed
    requestAnimationFrame(() => {
      resizeCanvas();
      drawScratchLayer();
    });

  } catch (err) {
    const code = err.code || '';
    if (code === 'resource-exhausted') {
      showNoCards();
    } else {
      showToast('Error al generar el raspadito. Intenta de nuevo.');
      if (btn) { btn.disabled = false; btn.textContent = '¡Jugar raspadito!'; }
    }
  }
};

function nextCard() {
  $('revealResult').classList.add('hidden');
  $('cardArea').classList.add('hidden');
  $('readyArea').classList.remove('hidden');
  const btn = $('requestBtn');
  if (btn) { btn.disabled = false; btn.textContent = '¡Jugar raspadito!'; }
}

function showNoCards() {
  $('cardArea')?.classList.add('hidden');
  $('readyArea')?.classList.add('hidden');
  $('daySummary')?.classList.add('hidden');
  $('noCardsScreen').classList.remove('hidden');

  const now = new Date();
  const mid = new Date(now); mid.setHours(24, 0, 0, 0);
  const diff = Math.round((mid - now) / 1000);
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const cdEl = $('noCardsCountdown');
  if (cdEl) cdEl.textContent = `Vuelve en ${h}h ${m}m`;
}

// ── Init ──────────────────────────────────────────────────────────────────────
window.addEventListener('load', () => {
  initCanvas();
  window.waitForFirebase(() => {
    firebase.auth().onAuthStateChanged(async (fbUser) => {
      if (!fbUser) {
        window.location.href = typeof withAppFlag === 'function' ? withAppFlag('login.html') : 'login.html';
        return;
      }
      currentUser = fbUser;

      try {
        const snap = await window.db.collection('users').doc(fbUser.uid).get();
        const data = snap.data() || {};
        setBalance(data.points || 0);

        const todayKey = new Date().toLocaleDateString('en-CA');
        if (data.scratchDate === todayKey) {
          cardsUsed  = data.scratchCards || 0;
          cardsTotal = FREE_CARDS + (data.scratchExtra || 0);
        } else {
          cardsUsed = 0; cardsTotal = FREE_CARDS;
        }
      } catch (e) {
        cardsUsed = 0; cardsTotal = FREE_CARDS;
      }

      updatePlaysUI();

      if (cardsUsed >= cardsTotal) {
        showNoCards();
      }
    });
  });
});
