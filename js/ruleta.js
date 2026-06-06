/* -----------------------------------------------
   RULETA.JS — VirtualGift
   3 giros gratis diarios
   Canvas wheel con animación suave ease-out
----------------------------------------------- */
'use strict';

// -- Segmentos --
const SEGMENTS = [
  { label: 'MISS', icon: 'X', coins: 0,   color: '#4a0010', weight: 22 },
  { label: '+5',   icon: '5',  coins: 5,   color: '#3b0075', weight: 20 },
  { label: '+10',  icon: '10',  coins: 10,  color: '#00267a', weight: 16 },
  { label: 'MISS', icon: 'X',  coins: 0,   color: '#1a1a30', weight: 14 },
  { label: '+5',   icon: '5',  coins: 5,   color: '#220065', weight: 12 },
  { label: '+20',  icon: '20',  coins: 20,  color: '#004020', weight: 10 },
  { label: '+50',  icon: '50',  coins: 50,  color: '#4d2000', weight:  5 },
  { label: '+100', icon: '100',  coins: 100, color: '#660033', weight:  1 },
];

const TOTAL_WEIGHT = SEGMENTS.reduce((s, g) => s + g.weight, 0);

const FREE_PLAYS       = 3;
const MAX_EXTRA        = 3;

// -- Estado --
let currentUser   = null;
let userCoins     = 0;
let playsUsed     = 0;
let extraUsed     = 0;
let isSpinning    = false;
let displayedRot  = 0; // ángulo actual en canvas (grados, acumulado)

// -- Canvas --
let canvas, ctx;

// -- Helpers --
function today() { return new Date().toISOString().slice(0, 10); }
function toast(msg) {
  const el = document.getElementById('gameToast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2800);
}

// -- Wheel drawing --
function drawWheel(rotDeg) {
  const W  = canvas.width;
  const H  = canvas.height;
  const cx = W / 2;
  const cy = H / 2;
  const r  = cx - 14;
  const rot = (rotDeg * Math.PI) / 180;

  ctx.clearRect(0, 0, W, H);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);

  let startAngle = -Math.PI / 2;

  SEGMENTS.forEach(seg => {
    const slice     = (seg.weight / TOTAL_WEIGHT) * Math.PI * 2;
    const sliceFrac = slice / (Math.PI * 2);

    // Segment fill
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, startAngle, startAngle + slice);
    ctx.closePath();
    ctx.fillStyle = seg.color;
    ctx.fill();

    // Subtle inner shimmer on outer arc
    ctx.beginPath();
    ctx.arc(0, 0, r - 2, startAngle + 0.03, startAngle + slice - 0.03);
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.stroke();

    // Separator line
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(startAngle) * r, Math.sin(startAngle) * r);
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Icon + label
    const midAngle = startAngle + slice / 2;
    const textR    = r * 0.60;
    const iconSize = Math.max(10, Math.min(16, sliceFrac * 200));
    const lblSize  = Math.max(7,  Math.min(11, sliceFrac * 118));

    ctx.save();
    ctx.translate(Math.cos(midAngle) * textR, Math.sin(midAngle) * textR);
    ctx.rotate(midAngle + Math.PI / 2);
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    // Emoji icon
    ctx.shadowColor = 'rgba(0,0,0,0.95)';
    ctx.shadowBlur  = 8;
    ctx.font = `${iconSize}px "Segoe UI Emoji","Apple Color Emoji",sans-serif`;
    ctx.fillStyle = '#fff';
    ctx.fillText(seg.icon, 0, -(lblSize * 1.15));

    // Label
    ctx.shadowBlur = 3;
    ctx.font = `900 ${lblSize}px Inter,sans-serif`;
    ctx.fillStyle = seg.coins > 0 ? '#fde68a' : '#fca5a5';
    ctx.fillText(seg.label, 0, iconSize * 0.72);

    ctx.restore();
    startAngle += slice;
  });

  // Radial depth overlay
  const shade = ctx.createRadialGradient(0, 0, r * 0.12, 0, 0, r);
  shade.addColorStop(0,    'rgba(255,255,255,0.09)');
  shade.addColorStop(0.55, 'rgba(0,0,0,0.0)');
  shade.addColorStop(1,    'rgba(0,0,0,0.30)');
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = shade;
  ctx.fill();

  // Rim decorative dot ring
  const numDots = 44;
  for (let i = 0; i < numDots; i++) {
    const a = (i / numDots) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * (r - 6), Math.sin(a) * (r - 6), 2.2, 0, Math.PI * 2);
    if (i % 2 !== 0) {
      ctx.shadowColor = 'rgba(167,139,250,0.9)';
      ctx.shadowBlur  = 5;
      ctx.fillStyle   = 'rgba(167,139,250,0.9)';
    } else {
      ctx.shadowBlur  = 0;
      ctx.fillStyle   = 'rgba(255,255,255,0.75)';
    }
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  ctx.restore();

  // Outer frame rings
  ctx.beginPath();
  ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, r + 7, 0, Math.PI * 2);
  ctx.lineWidth = 9;
  ctx.strokeStyle = 'rgba(109,40,217,0.35)';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, r + 12, 0, Math.PI * 2);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = 'rgba(250,200,50,0.55)';
  ctx.stroke();

  // Center hub
  ctx.beginPath();
  ctx.arc(cx, cy, 28, 0, Math.PI * 2);
  const hubGrad = ctx.createRadialGradient(cx - 6, cy - 6, 0, cx, cy, 28);
  hubGrad.addColorStop(0,   '#7c3aed');
  hubGrad.addColorStop(0.5, '#2d0a6b');
  hubGrad.addColorStop(1,   '#0a0618');
  ctx.fillStyle = hubGrad;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = 'rgba(167,139,250,0.9)';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, 18, 0, Math.PI * 2);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(196,181,253,0.35)';
  ctx.stroke();

  // Center dot
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  const dotGrad = ctx.createRadialGradient(cx - 3, cy - 3, 0, cx, cy, 8);
  dotGrad.addColorStop(0, '#f0abfc');
  dotGrad.addColorStop(1, '#7c3aed');
  ctx.fillStyle = dotGrad;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.stroke();
}

// -- Weighted random --
function getResult() {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const seg of SEGMENTS) {
    r -= seg.weight;
    if (r <= 0) return seg;
  }
  return SEGMENTS[0];
}

// -- Calculate target rotation --
function calcTargetRotation(targetSeg) {
  const idx = SEGMENTS.indexOf(targetSeg);

  // ángulo del centro del segmento desde el inicio del dibujo (degrees, clockwise from top)
  let start = 0;
  for (let i = 0; i < idx; i++) {
    start += (SEGMENTS[i].weight / TOTAL_WEIGHT) * 360;
  }
  const center = start + (SEGMENTS[idx].weight / TOTAL_WEIGHT) * 180;

  // Para que el segmento quede bajo el puntero (top), la rotación total debe ser (360 - center) mod 360.
  // Fórmula: cuando canvas rota +rot, el punto originalmente en ángulo 'a' aparece en 'a + rot'.
  // Queremos a + rot = 0° (top) ? rot = -center = 360 - center (mod 360).
  const currentNorm = ((displayedRot % 360) + 360) % 360;
  let target = (360 - center) % 360;
  let needed  = target - currentNorm;
  if (needed <= 0) needed += 360;

  // 6-8 vueltas completas para efecto visual
  const extraSpins = (6 + Math.floor(Math.random() * 3)) * 360;

  return displayedRot + needed + extraSpins;
}

// -- Animation --
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

// -- UI --
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

async function grantExtraPlayFromAd() {
  if (!currentUser || isSpinning) return;
  const adBtn = document.getElementById('adPlayBtn');
  if (adBtn) adBtn.disabled = true;

  try {
    if (!window.VGUnityAds) throw new Error('Unity Ads no esta cargado');
    await window.VGUnityAds.showRewarded({ serverId: currentUser.uid });

    const fn = firebase.functions().httpsCallable('grantUnityAdReward');
    const res = await fn({
      rewardType: 'roulette_extra',
      placementId: window.VGUnityAds.config.placements[window.VGUnityAds.getPlatform() === 'ios' ? 'ios' : 'android'].rewarded,
    });

    const data = res.data || {};
    extraUsed = data.extraUsed ?? (extraUsed + 1);
    toast(data.message || '+1 giro desbloqueado');
    updatePlaysUI();
  } catch (e) {
    console.error('[ruleta] unity rewarded error', e);
    toast(e.message || 'No se pudo completar el anuncio');
  } finally {
    if (adBtn) adBtn.disabled = false;
  }
}

function buildLegend() {
  const el = document.getElementById('rouletteLegend');
  if (!el) return;
  const seen = new Set();
  el.innerHTML = SEGMENTS.filter(s => {
    if (seen.has(s.label)) return false;
    seen.add(s.label); return true;
  }).map(s => {
    const glow = s.color + 'cc';
    return `
    <div class="legend-item" style="border-left-color:${s.color}">
      <div class="legend-dot" style="background:${s.color};box-shadow:0 0 7px ${glow}"></div>
      <span class="legend-icon">${s.icon}</span>
      <span class="legend-label">${s.label === 'MISS' ? 'Sin suerte' : s.label}</span>
      <span class="legend-coins">${s.coins > 0 ? '+' + s.coins + ' VC' : '—'}</span>
    </div>`;
  }).join('');
}

function setResult(html) {
  const el = document.getElementById('resultDisplay');
  if (el) el.innerHTML = html;
}

// -- Load data --
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

// -- Spin --
window.doSpin = async function() {
  const total = FREE_PLAYS + extraUsed;
  if (playsUsed >= total || isSpinning) return;

  isSpinning = true;
  const spinBtn = document.getElementById('spinBtn');
  if (spinBtn) spinBtn.disabled = true;
  setResult('<span class="result-hint">Girando...</span>');

  try {
    const fn = firebase.functions().httpsCallable('spinRoulette');
    const serverResult = await fn();
    const data = serverResult.data || {};
    const result = SEGMENTS[data.segmentIndex] || data.segment || SEGMENTS[0];
    const target = calcTargetRotation(result);

    animateTo(target, () => {
      playsUsed = data.playsUsed ?? (playsUsed + 1);
      if (data.coins > 0) {
        setResult('<span class="result-win">+' + data.coins + ' VC</span>');
        if (window.VGSounds) VGSounds.prize();
      } else {
        setResult('<span class="result-miss">Sin suerte esta vez</span>');
      }
      userCoins = data.points ?? (userCoins + (data.coins || 0));
      updateBalanceUI();
      isSpinning = false;
      updatePlaysUI();
    });
  } catch(e) {
    console.error('[ruleta] spin error', e);
    toast(e.message || 'No se pudo guardar el giro');
    isSpinning = false;
    updatePlaysUI();
  }
};

// -- Init --
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
