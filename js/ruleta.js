/* ═══════════════════════════════════════════════
   RULETA.JS — VirtualGift
   3 giros gratis/día · +1 por anuncio (máx 3)
   Canvas wheel con animación suave ease-out
═══════════════════════════════════════════════ */
'use strict';

// ── Segmentos ──
const SEGMENTS = [
  { label: '+5',   coins: 5,   color: '#7c3aed', weight: 28 },
  { label: '+10',  coins: 10,  color: '#2563eb', weight: 22 },
  { label: '+15',  coins: 15,  color: '#059669', weight: 18 },
  { label: '+25',  coins: 25,  color: '#d97706', weight: 12 },
  { label: '+50',  coins: 50,  color: '#dc2626', weight:  8 },
  { label: '+5',   coins: 5,   color: '#7c3aed', weight: 28 / 2 }, // duplicate for symmetry
  { label: '+10',  coins: 10,  color: '#2563eb', weight: 22 / 2 },
  { label: '+100', coins: 100, color: '#db2777', weight:  3 },
  { label: 'MISS', coins: 0,   color: '#1f2937', weight:  2 },
];

const TOTAL_WEIGHT = SEGMENTS.reduce((s, g) => s + g.weight, 0);

const FREE_PLAYS       = 3;
const MAX_EXTRA        = 3;
const REWARDED_UNIT_ID = '7d073f1e-bb56-4a59-90d0-ea9dd0285f13';

// ── Estado ──
let currentUser   = null;
let userCoins     = 0;
let playsUsed     = 0;
let extraUsed     = 0;
let isSpinning    = false;
let displayedRot  = 0; // ángulo actual en canvas (grados, acumulado)

// ── Canvas ──
let canvas, ctx;

// ── Helpers ──
function today() { return new Date().toISOString().slice(0, 10); }
function toast(msg) {
  const el = document.getElementById('gameToast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2800);
}

// ── Wheel drawing ──
function drawWheel(rotDeg) {
  const W   = canvas.width;
  const H   = canvas.height;
  const cx  = W / 2;
  const cy  = H / 2;
  const r   = cx - 6;
  const rot = (rotDeg * Math.PI) / 180;

  ctx.clearRect(0, 0, W, H);

  // Outer glow ring
  ctx.beginPath();
  ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(139,92,246,0.25)';
  ctx.lineWidth = 8;
  ctx.stroke();

  // Segments
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);

  let startAngle = -Math.PI / 2; // start from top

  SEGMENTS.forEach(seg => {
    const slice = (seg.weight / TOTAL_WEIGHT) * Math.PI * 2;

    // Fill
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, startAngle, startAngle + slice);
    ctx.closePath();
    ctx.fillStyle = seg.color;
    ctx.fill();

    // Separator
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, startAngle, startAngle + slice);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Label text
    const textAngle = startAngle + slice / 2;
    const textR     = r * 0.64;
    ctx.save();
    ctx.translate(Math.cos(textAngle) * textR, Math.sin(textAngle) * textR);
    ctx.rotate(textAngle + Math.PI / 2);
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = '#fff';
    ctx.font         = `800 ${slice > 0.5 ? 13 : 11}px Inter, sans-serif`;
    ctx.shadowColor  = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur   = 3;
    ctx.fillText(seg.label, 0, 0);
    ctx.restore();

    startAngle += slice;
  });

  ctx.restore();

  // Center hub
  ctx.beginPath();
  ctx.arc(cx, cy, 20, 0, Math.PI * 2);
  ctx.fillStyle = '#0f0c22';
  ctx.fill();
  ctx.strokeStyle = 'rgba(139,92,246,0.7)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Center dot
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#8b5cf6';
  ctx.fill();
}

// ── Weighted random ──
function getResult() {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const seg of SEGMENTS) {
    r -= seg.weight;
    if (r <= 0) return seg;
  }
  return SEGMENTS[0];
}

// ── Calculate target rotation ──
function calcTargetRotation(targetSeg) {
  const idx = SEGMENTS.indexOf(targetSeg);

  // Angle of target segment center from top (degrees, clockwise)
  let start = 0;
  for (let i = 0; i < idx; i++) {
    start += (SEGMENTS[i].weight / TOTAL_WEIGHT) * 360;
  }
  const center = start + (SEGMENTS[idx].weight / TOTAL_WEIGHT) * 180;

  // How much to rotate so target lands under the pointer (top = 0)
  const currentNorm = ((displayedRot % 360) + 360) % 360;
  let needed = center - currentNorm;
  if (needed <= 0) needed += 360;

  // Add 6–8 full spins for visual effect
  const extraSpins = (6 + Math.floor(Math.random() * 3)) * 360;

  return displayedRot + needed + extraSpins;
}

// ── Animation ──
function easeOut(t) { return 1 - Math.pow(1 - t, 4); }

function animateTo(target, onDone) {
  const start    = displayedRot;
  const duration = 4200 + Math.random() * 800;
  const t0       = performance.now();

  function frame(now) {
    const elapsed = now - t0;
    const t = Math.min(elapsed / duration, 1);
    displayedRot = start + (target - start) * easeOut(t);
    drawWheel(displayedRot);

    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      displayedRot = target;
      drawWheel(displayedRot);
      onDone();
    }
  }
  requestAnimationFrame(frame);
}

// ── UI ──
function updateBalanceUI() {
  const el = document.getElementById('balanceVal');
  if (el) el.textContent = userCoins.toLocaleString('en-US');
}

function updatePlaysUI() {
  const total     = FREE_PLAYS + extraUsed;
  const remaining = Math.max(total - playsUsed, 0);
  const label     = document.getElementById('playsLabel');
  const pips      = document.getElementById('playsPips');
  const spinBtn   = document.getElementById('spinBtn');
  const adRow     = document.getElementById('adPlayRow');

  if (label) label.textContent = `${remaining} giro${remaining !== 1 ? 's' : ''} restante${remaining !== 1 ? 's' : ''}`;

  if (pips) {
    pips.innerHTML = '';
    for (let i = 0; i < FREE_PLAYS; i++) {
      const pip = document.createElement('div');
      pip.className = 'plays-pip' + (i < playsUsed ? ' used' : (i === playsUsed ? ' active' : ''));
      pips.appendChild(pip);
    }
  }

  if (spinBtn) spinBtn.disabled = remaining === 0 || isSpinning;
  if (adRow) adRow.style.display = (remaining === 0 && extraUsed < MAX_EXTRA) ? 'flex' : 'none';
}

function buildLegend() {
  const el = document.getElementById('rouletteLegend');
  if (!el) return;
  const seen = new Set();
  el.innerHTML = SEGMENTS.filter(s => {
    if (seen.has(s.label)) return false;
    seen.add(s.label); return true;
  }).map(s => `
    <div class="legend-item">
      <div class="legend-dot" style="background:${s.color}"></div>
      <span class="legend-label">${s.label === 'MISS' ? 'Sin suerte' : s.label}</span>
      <span class="legend-coins">${s.coins > 0 ? s.coins + ' 🪙' : '—'}</span>
    </div>`
  ).join('');
}

function setResult(html) {
  const el = document.getElementById('resultDisplay');
  if (el) el.innerHTML = html;
}

// ── Load data ──
async function loadUserData() {
  if (!currentUser) return;
  try {
    const doc  = await window.db.collection('users').doc(currentUser.uid).get();
    const data = doc.data() || {};
    userCoins = data.points || 0;

    if (data.rouletteDate === today()) {
      playsUsed = data.roulettePlays || 0;
      extraUsed = data.rouletteExtra || 0;
    } else {
      playsUsed = 0;
      extraUsed = 0;
    }

    updateBalanceUI();
    updatePlaysUI();
  } catch(e) {
    console.error('[ruleta] loadUserData', e);
  }
}

// ── Spin ──
window.doSpin = async function() {
  const total = FREE_PLAYS + extraUsed;
  if (playsUsed >= total || isSpinning) return;

  isSpinning = true;
  document.getElementById('spinBtn').disabled = true;
  setResult('<span class="result-miss">Girando…</span>');

  const result = getResult();
  const target = calcTargetRotation(result);

  animateTo(target, async () => {
    // Show result
    if (result.coins > 0) {
      setResult(`<span class="result-win">+${result.coins} 🪙</span>`);
      if (window.VGSounds) VGSounds.prize();
    } else {
      setResult('<span class="result-miss">¡Sin suerte! Intenta de nuevo 🎡</span>');
    }

    // Save to Firestore
    playsUsed++;
    try {
      const upd = {
        rouletteDate:  today(),
        roulettePlays: playsUsed,
        rouletteExtra: extraUsed,
      };
      if (result.coins > 0) {
        upd.points = firebase.firestore.FieldValue.increment(result.coins);
      }
      await window.db.collection('users').doc(currentUser.uid).update(upd);

      if (result.coins > 0) {
        userCoins += result.coins;
        updateBalanceUI();
        await window.db.collection('pointsHistory').add({
          userId:    currentUser.uid,
          type:      'roulette_win',
          points:    result.coins,
          createdAt: firebase.firestore.Timestamp.now(),
        });
      }
    } catch(e) {
      console.error('[ruleta] save error', e);
      toast('Error al guardar resultado');
    }

    isSpinning = false;
    updatePlaysUI();
  });
};

// ── Giro extra (Wortise Rewarded) ──
window.watchAd = async function() {
  const btn = document.getElementById('adPlayBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Cargando anuncio…'; }

  try {
    const result = await WortiseAds.showRewarded(REWARDED_UNIT_ID);
    if (result.rewarded) {
      await grantExtraRoulettePlay();
    } else {
      toast('El anuncio no se completó — inténtalo de nuevo');
    }
  } catch (e) {
    console.error('[ruleta] watchAd error', e);
    toast('No se pudo cargar el anuncio');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '▶ Ver anuncio para +1 giro'; }
  }
};

async function grantExtraRoulettePlay() {
  extraUsed++;
  try {
    await window.db.collection('users').doc(currentUser.uid).update({
      rouletteDate:  today(),
      rouletteExtra: extraUsed,
    });
  } catch(e) { console.error('[ruleta] grantExtraPlay save', e); }
  toast('✅ +1 giro desbloqueado');
  updatePlaysUI();
}

// ── Init ──
window.addEventListener('load', () => {
  canvas = document.getElementById('wheelCanvas');
  ctx    = canvas.getContext('2d');

  // Responsive canvas size
  const size = Math.min(window.innerWidth - 48, 320);
  canvas.width  = size;
  canvas.height = size;

  drawWheel(0);
  buildLegend();

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
