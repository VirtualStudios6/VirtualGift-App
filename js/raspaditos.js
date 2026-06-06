'use strict';

const FREE_CARDS = 3;

let currentUser   = null;
let cardsUsed     = 0;
let cardsTotal    = FREE_CARDS;
let scratching    = false;
let cardRevealed  = false;
let currentPrize  = null;
let canvas, ctx;

function $(id) { return document.getElementById(id); }

function showToast(msg) {
  const t = $('gameToast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2500);
}

function setBalance(pts) {
  const el = $('balanceVal');
  if (el) el.textContent = Number(pts).toLocaleString();
}

function updatePlaysUI() {
  const label = $('playsLabel');
  const pips  = $('playsPips');
  const rem   = Math.max(cardsTotal - cardsUsed, 0);
  if (label) label.textContent = `${rem} raspadito${rem !== 1 ? 's' : ''} disponible${rem !== 1 ? 's' : ''}`;
  if (!pips) return;
  pips.innerHTML = '';
  for (let i = 0; i < cardsTotal; i++) {
    const d = document.createElement('div');
    d.className = 'plays-pip' + (i < cardsUsed ? ' used' : '');
    pips.appendChild(d);
  }
}

// ── Canvas scratch ─────────────────────────────────────────────────────────
function initCanvas() {
  canvas = $('scratchCanvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  resizeCanvas();
  drawScratchLayer();
  bindScratchEvents();
}

function resizeCanvas() {
  const wrap = $('scratchWrap');
  if (!wrap || !canvas) return;
  canvas.width  = wrap.offsetWidth;
  canvas.height = wrap.offsetHeight;
}

function drawScratchLayer() {
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'source-over';

  // Gradient scratch layer
  const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  grad.addColorStop(0, '#1a0a3c');
  grad.addColorStop(1, '#0c0520');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(0, 0, canvas.width, canvas.height, 16);
  ctx.fill();

  // Scratch hint text
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '700 14px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('¡Raspa aquí! 🪙', canvas.width / 2, canvas.height / 2 - 6);
  ctx.font = '600 11px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.fillText('Usa el dedo para raspar', canvas.width / 2, canvas.height / 2 + 14);
}

function bindScratchEvents() {
  if (!canvas) return;
  canvas.addEventListener('mousedown',  () => { scratching = true; });
  canvas.addEventListener('mouseup',    () => { scratching = false; });
  canvas.addEventListener('mouseleave', () => { scratching = false; });
  canvas.addEventListener('mousemove',  onScratch);
  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); scratching = true; }, { passive: false });
  canvas.addEventListener('touchend',   () => { scratching = false; });
  canvas.addEventListener('touchmove',  (e) => { e.preventDefault(); onScratch(e); }, { passive: false });
}

function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  const src = e.touches ? e.touches[0] : e;
  return {
    x: (src.clientX - rect.left) * scaleX,
    y: (src.clientY - rect.top)  * scaleY,
  };
}

function onScratch(e) {
  if (!scratching || cardRevealed || !currentPrize) return;
  const { x, y } = getPos(e);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(x, y, 28, 0, Math.PI * 2);
  ctx.fill();
  checkScratched();
}

function checkScratched() {
  const data  = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let visible = 0;
  for (let i = 3; i < data.data.length; i += 4) {
    if (data.data[i] > 0) visible++;
  }
  const pct = 1 - (visible / (canvas.width * canvas.height));
  if (pct > 0.55) autoReveal();
}

function autoReveal() {
  if (cardRevealed) return;
  cardRevealed = true;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  showPrizeResult(currentPrize);
}

// ── Prize display ──────────────────────────────────────────────────────────
function setPrizeDisplay(prize) {
  const win  = prize.coins > 0;
  $('prizeEmoji').textContent  = win ? '🪙' : '😞';
  $('prizeCoins').textContent  = win ? `+${prize.coins}` : '0';
  $('prizeLabel').textContent  = win ? 'coins ganados' : 'sin premio';
  $('prizeCoins').className    = 'prize-coins ' + (win ? 'win' : 'miss');
}

function showPrizeResult(prize) {
  const win = prize.coins > 0;
  $('revealOverlay').classList.remove('hidden');
  $('revealEmoji').textContent  = win ? '🎉' : '😔';
  $('revealTitle').textContent  = win ? `¡Ganaste ${prize.coins} 🪙!` : 'Sin suerte esta vez';
  $('revealSub').textContent    = win ? 'Los coins fueron agregados a tu cuenta.' : 'Prueba con otro raspadito.';
  $('revealBtn').textContent    = cardsUsed < cardsTotal ? `Raspar otro (${cardsTotal - cardsUsed} restantes)` : '¡Volver al inicio!';
  $('revealBtn').onclick = cardsUsed < cardsTotal ? nextCard : goHome;
  if (win && window.VGSounds) VGSounds.prize();
}

function goHome() {
  window.location.href = typeof withAppFlag === 'function' ? withAppFlag('inicio.html') : 'inicio.html';
}

// ── New card ───────────────────────────────────────────────────────────────
async function requestCard() {
  const btn = $('requestBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Generando...'; }
  try {
    const fn  = firebase.functions().httpsCallable('scratchCard');
    const res = await fn({});
    const d   = res.data;
    cardsUsed  = d.cardsUsed;
    cardsTotal = d.cardsUsed + d.cardsRemaining;
    setBalance(d.points);
    updatePlaysUI();
    currentPrize  = { coins: d.coins };
    cardRevealed  = false;
    setPrizeDisplay(currentPrize);
    $('cardArea').classList.remove('hidden');
    $('requestArea').classList.add('hidden');
    $('revealOverlay').classList.add('hidden');
    resizeCanvas();
    drawScratchLayer();
  } catch (err) {
    const code = err.code || '';
    if (code === 'resource-exhausted') {
      showNoCards();
    } else {
      showToast('Error al generar el raspadito. Intenta de nuevo.');
      if (btn) { btn.disabled = false; btn.textContent = '¡Raspar ahora!'; }
    }
  }
}

function nextCard() {
  $('revealOverlay').classList.add('hidden');
  $('cardArea').classList.add('hidden');
  $('requestArea').classList.remove('hidden');
  const btn = $('requestBtn');
  if (btn) { btn.disabled = false; btn.textContent = '¡Raspar ahora!'; }
}

function showNoCards() {
  $('cardArea').classList.add('hidden');
  $('requestArea').classList.add('hidden');
  $('noCardsScreen').classList.remove('hidden');
}

// ── Init ──────────────────────────────────────────────────────────────────
window.addEventListener('load', () => {
  initCanvas();
  window.waitForFirebase(() => {
    firebase.auth().onAuthStateChanged(async (fbUser) => {
      if (!fbUser) { window.location.href = typeof withAppFlag === 'function' ? withAppFlag('login.html') : 'login.html'; return; }
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
      } catch (e) { cardsUsed = 0; cardsTotal = FREE_CARDS; }

      updatePlaysUI();
      if (cardsUsed >= cardsTotal) { showNoCards(); }
    });
  });
});
