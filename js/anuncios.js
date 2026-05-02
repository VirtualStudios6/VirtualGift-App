// js/anuncios.js

const AD_REWARD    = 50;   // coins por anuncio
const AD_MAX_DAILY = 10;   // máximo de anuncios por día
const AD_DURATION  = 30;   // segundos que dura cada anuncio
const AD_COOLDOWN  = 5000; // ms de espera entre anuncios

let currentUser   = null;
let currentPoints = 0;
let adsToday      = 0;
let canWatch      = true;
let adTimer       = null;
let rewardClaimed = false;
let activeAdIndex = -1;

// ---- Utils ----

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function $(id) { return document.getElementById(id); }

function showToast(msg, duration = 3000) {
  const t = $('adToast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

// ---- UI Updates ----

function updateBalanceUI() {
  const el = $('adBalance');
  if (el) el.textContent = currentPoints.toLocaleString('en-US');
}

function updateProgressUI() {
  const countEl  = $('adsCount');
  const barEl    = $('adsProgressBar');
  const statusEl = $('adsStatus');

  if (countEl) countEl.textContent = `${adsToday}/${AD_MAX_DAILY}`;
  if (barEl)   barEl.style.width   = `${(adsToday / AD_MAX_DAILY) * 100}%`;

  const remaining = AD_MAX_DAILY - adsToday;
  if (statusEl) {
    if (remaining <= 0) {
      statusEl.textContent = '¡Completaste todos los anuncios de hoy! Vuelve mañana.';
      statusEl.className = 'ad-status done';
    } else if (!canWatch) {
      statusEl.textContent = 'Espera un momento antes del siguiente anuncio...';
      statusEl.className = 'ad-status';
    } else {
      statusEl.textContent = `${remaining} anuncio${remaining !== 1 ? 's' : ''} disponible${remaining !== 1 ? 's' : ''} hoy`;
      statusEl.className = 'ad-status';
    }
  }

  const btns = document.querySelectorAll('.ad-watch-btn');
  btns.forEach(btn => {
    const isLimitReached = adsToday >= AD_MAX_DAILY;
    btn.disabled = isLimitReached || !canWatch;
    if (isLimitReached) {
      btn.textContent = 'Límite alcanzado';
    } else if (!canWatch) {
      btn.textContent = 'Espera...';
    } else {
      btn.textContent = 'Ver anuncio';
    }
  });

  markWatchedCards();
}

function markWatchedCards() {
  const cards = document.querySelectorAll('.ad-card');
  cards.forEach((card, i) => {
    if (adsToday >= AD_MAX_DAILY) {
      card.classList.add('watched');
    } else {
      card.classList.remove('watched');
    }
  });
}

function addEarnedChip() {
  const section = $('adEarnedSection');
  const list    = $('adEarnedList');
  if (!section || !list) return;

  section.style.display = 'block';

  const chip = document.createElement('div');
  chip.className   = 'ad-earned-chip';
  chip.textContent = `🪙 +${AD_REWARD}`;
  list.appendChild(chip);
}

// ---- Firestore ----

async function loadUserData(userId) {
  try {
    const doc = await window.db.collection('users').doc(userId).get();
    if (doc.exists) {
      const data = doc.data();
      currentPoints = data.points || 0;

      if ((data.adLastDate || '') === todayStr()) {
        adsToday = data.adCount || 0;
      } else {
        adsToday = 0;
      }

      // Restore earned chips from today
      if (adsToday > 0) {
        const section = $('adEarnedSection');
        const list    = $('adEarnedList');
        if (section && list) {
          section.style.display = 'block';
          for (let i = 0; i < adsToday; i++) {
            const chip = document.createElement('div');
            chip.className   = 'ad-earned-chip';
            chip.textContent = `🪙 +${AD_REWARD}`;
            list.appendChild(chip);
          }
        }
      }
    }
    updateBalanceUI();
    updateProgressUI();
  } catch (e) {
    console.error('[anuncios] loadUserData:', e);
    showToast('❌ Error cargando datos');
  }
}

async function saveAdReward() {
  const today     = todayStr();
  const newCount  = adsToday + 1;
  const newPoints = currentPoints + AD_REWARD;

  try {
    await window.db.collection('users').doc(currentUser.uid).update({
      points:     newPoints,
      adLastDate: today,
      adCount:    newCount
    });

    await window.db.collection('pointsHistory').add({
      userId:    currentUser.uid,
      type:      'ad_reward',
      points:    AD_REWARD,
      adCount:   newCount,
      timestamp: firebase.firestore.Timestamp.now()
    });

    currentPoints = newPoints;
    adsToday      = newCount;

    updateBalanceUI();
    updateProgressUI();
    addEarnedChip();
    if (window.VGSounds) VGSounds.coin();
    showToast(`🎉 +${AD_REWARD} coins ganados!`);
  } catch (e) {
    console.error('[anuncios] saveAdReward:', e);
    showToast('❌ Error al guardar recompensa');
    throw e;
  }
}

// ---- Modal / Ad Player ----

function openAdModal(adIndex) {
  if (adsToday >= AD_MAX_DAILY || !canWatch) return;

  activeAdIndex = adIndex;
  rewardClaimed = false;
  canWatch      = false;
  updateProgressUI();

  const modal     = $('adModal');
  const claimBtn  = $('adClaimBtn');
  const timerBar  = $('adTimerBar');
  const countdown = $('adCountdown');

  if (!modal) return;

  claimBtn.disabled    = true;
  claimBtn.textContent = 'Mira el anuncio completo';
  timerBar.style.width = '0%';
  countdown.textContent = String(AD_DURATION);

  modal.style.display = 'flex';

  let timeLeft = AD_DURATION;

  adTimer = setInterval(() => {
    timeLeft--;
    const pct = ((AD_DURATION - timeLeft) / AD_DURATION) * 100;
    timerBar.style.width  = `${pct}%`;
    countdown.textContent = timeLeft > 0 ? String(timeLeft) : '✓';

    if (timeLeft <= 0) {
      clearInterval(adTimer);
      adTimer = null;
      claimBtn.disabled    = false;
      claimBtn.textContent = `Reclamar +${AD_REWARD} coins`;
    }
  }, 1000);
}

function closeAdModal() {
  const modal = $('adModal');
  if (!modal) return;

  if (adTimer) { clearInterval(adTimer); adTimer = null; }
  modal.style.display = 'none';

  // Cooldown before next ad
  setTimeout(() => {
    canWatch = true;
    updateProgressUI();
  }, AD_COOLDOWN);
}

async function claimAdReward() {
  const btn = $('adClaimBtn');
  if (!btn || btn.disabled) return;

  btn.disabled    = true;
  btn.textContent = 'Guardando...';

  try {
    await saveAdReward();
    rewardClaimed = true;
    closeAdModal();
  } catch {
    btn.disabled    = false;
    btn.textContent = `Reintentar`;
  }
}

// ---- Init ----

function init() {
  window.waitForFirebase((err) => {
    if (err) { showToast('❌ Firebase no disponible'); return; }

    window.auth.onAuthStateChanged((user) => {
      if (!user) { window.location.href = withAppFlag('index.html'); return; }
      if (!user.emailVerified && user.providerData?.[0]?.providerId === 'password') {
        window.location.href = withAppFlag('verify-pending.html'); return;
      }
      currentUser = user;
      loadUserData(user.uid);
    });
  });

  // Claim button
  const claimBtn = $('adClaimBtn');
  if (claimBtn) claimBtn.addEventListener('click', claimAdReward);

  // Close button
  const closeBtn = $('adModalClose');
  if (closeBtn) closeBtn.addEventListener('click', closeAdModal);

  // Backdrop closes modal
  const backdrop = $('adModalBackdrop');
  if (backdrop) backdrop.addEventListener('click', closeAdModal);

  // Watch buttons — each card passes its index
  document.querySelectorAll('.ad-watch-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index, 10);
      openAdModal(idx);
    });
  });
}

document.addEventListener('DOMContentLoaded', init);
