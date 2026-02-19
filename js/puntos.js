/* ============================================ */
/* CONSTANTES */
/* ============================================ */
const POINTS_CACHE_KEY      = "vg_points_cache";
const POINTS_CACHE_DURATION = 2 * 60 * 1000; // 2 min
const POINTS_TO_USD_RATE    = 1000;           // 1000 coins = $1
const MIN_REDEEM_POINTS     = 20000;

/* ============================================ */
/* ESTADO GLOBAL */
/* ============================================ */
let currentUserPoints = 0;
let currentUserId     = null;
let selectedPlatform  = null;

/* ============================================ */
/* MODAL PERSONALIZADO (reemplaza alert/confirm) */
/* ============================================ */
function showModal(title, message, buttons = [{ label: 'OK', primary: true }]) {
  return new Promise(resolve => {
    // Crear overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:99999;
      background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);
      display:flex;align-items:center;justify-content:center;padding:20px;`;

    const box = document.createElement('div');
    box.style.cssText = `
      background:#111827;border:1px solid rgba(255,255,255,0.1);
      border-radius:18px;padding:24px;max-width:340px;width:100%;
      animation:fadeUp .25s ease;`;

    const titleEl = document.createElement('div');
    titleEl.style.cssText = 'font-size:17px;font-weight:800;color:white;margin-bottom:10px;';
    titleEl.textContent = title;

    const msgEl = document.createElement('div');
    msgEl.style.cssText = 'font-size:14px;color:rgba(255,255,255,0.65);line-height:1.6;margin-bottom:20px;white-space:pre-line;';
    msgEl.textContent = message;

    const btnsEl = document.createElement('div');
    btnsEl.style.cssText = 'display:flex;gap:10px;';

    buttons.forEach(b => {
      const btn = document.createElement('button');
      btn.textContent = b.label;
      btn.style.cssText = `flex:1;padding:12px;border-radius:12px;border:none;
        font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;
        ${b.primary
          ? 'background:linear-gradient(135deg,#7c3aed,#a855f7);color:white;'
          : 'background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.7);'}`;
      btn.onclick = () => { document.body.removeChild(overlay); resolve(b.value ?? b.label); };
      btnsEl.appendChild(btn);
    });

    box.appendChild(titleEl);
    box.appendChild(msgEl);
    box.appendChild(btnsEl);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  });
}

/* ============================================ */
/* CACHÉ DE PUNTOS */
/* ============================================ */
function getCachedPoints() {
  try {
    const cached = localStorage.getItem(POINTS_CACHE_KEY);
    if (!cached) return null;
    const data = JSON.parse(cached);
    if (Date.now() - data.timestamp < POINTS_CACHE_DURATION) return data.points;
    localStorage.removeItem(POINTS_CACHE_KEY);
    return null;
  } catch(e) { return null; }
}

function setCachedPoints(points) {
  try {
    localStorage.setItem(POINTS_CACHE_KEY, JSON.stringify({ points, timestamp: Date.now() }));
  } catch(e) {}
}

/* ============================================ */
/* UTILIDADES */
/* ============================================ */
function pointsToUSD(points) {
  return (points / POINTS_TO_USD_RATE).toFixed(2);
}

function updateBalanceUI(points) {
  const totalEl  = document.getElementById('totalPoints');
  const dollarEl = document.getElementById('dollarValue');
  if (totalEl)  totalEl.textContent  = points.toLocaleString();
  if (dollarEl) dollarEl.textContent = pointsToUSD(points);
}

function isFirebaseReady() {
  return typeof firebase !== 'undefined'
    && typeof firebase.auth === 'function'
    && window.db;
}

function waitForFirebase(cb, max = 80) {
  let i = 0;
  const t = setInterval(() => {
    i++;
    if (isFirebaseReady()) { clearInterval(t); cb(); }
    else if (i >= max) { clearInterval(t); window.location.href = withAppFlag('index.html'); }
  }, 100);
}

/* ============================================ */
/* NOTIFICACIONES (BADGE) */
/* ============================================ */
function loadNotificationCount(uid) {
  window.db.collection('notifications')
    .where('userId', '==', uid)
    .where('read', '==', false)
    .get()
    .then(snap => {
      const badge = document.getElementById('notificationBadge');
      if (!badge) return;
      badge.textContent = snap.size;
      badge.style.display = snap.size > 0 ? 'flex' : 'none';
    }).catch(() => {});
}

/* ============================================ */
/* CARGAR PUNTOS */
/* ============================================ */
async function loadUserPoints(userId) {
  currentUserId = userId;

  // Mostrar caché inmediatamente
  const cached = getCachedPoints();
  if (cached !== null) {
    currentUserPoints = cached;
    updateBalanceUI(cached);
  }

  try {
    const doc = await window.db.collection('users').doc(userId).get();
    if (doc.exists) {
      const points = doc.data().points || 0;
      currentUserPoints = points;
      updateBalanceUI(points);
      setCachedPoints(points);
    }
  } catch(e) {
    console.error('loadUserPoints:', e);
  }
}

/* ============================================ */
/* SELECTOR DE PLATAFORMA + INPUT CANJE */
/* ============================================ */
const PLATFORM_LABELS = {
  paypal:     { name: 'PayPal',           field: 'Correo PayPal',     placeholder: 'ejemplo@paypal.com' },
  amazon:     { name: 'Amazon Gift Card', field: 'Correo Amazon',     placeholder: 'ejemplo@email.com'  },
  steam:      { name: 'Steam Wallet',     field: 'Steam Trade URL',   placeholder: 'https://steamcommunity.com/...' },
  googleplay: { name: 'Google Play',      field: 'Correo Google',     placeholder: 'ejemplo@gmail.com'  },
  psn:        { name: 'PlayStation',      field: 'PSN ID',            placeholder: 'Tu PSN ID'          },
};

function setupPlatformCards() {
  document.querySelectorAll('.platform-card').forEach(card => {
    card.addEventListener('click', () => {
      const platform = card.dataset.platform;
      if (!platform) return;

      document.querySelectorAll('.platform-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedPlatform = platform;

      const info = PLATFORM_LABELS[platform] || {};
      const label    = document.getElementById('redeemAccountLabel');
      const input    = document.getElementById('redeemAccount');
      const proceedBtn = document.getElementById('proceedRedeemBtn');

      if (label) label.textContent = info.field || 'Cuenta';
      if (input) input.placeholder = info.placeholder || '';

      validateRedeemForm();
    });
  });
}

function setupRedeemInput() {
  const input = document.getElementById('redeemPoints');
  const preview = document.getElementById('redeemUsdPreview');
  const errorEl = document.getElementById('redeemError');

  if (!input) return;

  input.addEventListener('input', () => {
    const val = parseInt(input.value, 10) || 0;
    if (preview) preview.textContent = `$${pointsToUSD(val)} USD`;
    validateRedeemForm();
  });
}

function validateRedeemForm() {
  const input    = document.getElementById('redeemPoints');
  const errorEl  = document.getElementById('redeemError');
  const proceedBtn = document.getElementById('proceedRedeemBtn');

  const val = parseInt(input?.value, 10) || 0;

  let error = '';
  if (val > 0 && val < MIN_REDEEM_POINTS) error = `Mínimo ${MIN_REDEEM_POINTS.toLocaleString()} coins`;
  else if (val > 0 && val % 1000 !== 0)  error = 'Debe ser múltiplo de 1.000';
  else if (val > currentUserPoints)       error = 'No tienes suficientes coins';

  if (errorEl) errorEl.textContent = error;

  const valid = !error && val >= MIN_REDEEM_POINTS && selectedPlatform;
  if (proceedBtn) {
    proceedBtn.disabled = !valid;
    proceedBtn.textContent = valid
      ? `Continuar con ${PLATFORM_LABELS[selectedPlatform]?.name}`
      : (selectedPlatform ? 'Completa los campos' : 'Selecciona una plataforma');
  }
}

/* ============================================ */
/* MODAL DE CANJE */
/* ============================================ */
function openRedeemModal() {
  const points   = parseInt(document.getElementById('redeemPoints')?.value, 10) || 0;
  const platform = PLATFORM_LABELS[selectedPlatform] || {};

  const modal         = document.getElementById('redeemModal');
  const modalPlatName = document.getElementById('modalPlatformName');
  const modalPts      = document.getElementById('modalRedeemPoints');
  const modalUSD      = document.getElementById('modalRedeemUSD');

  if (!modal) return;

  if (modalPlatName) modalPlatName.textContent = `Canjear — ${platform.name || ''}`;
  if (modalPts)      modalPts.textContent      = points.toLocaleString() + ' 🪙';
  if (modalUSD)      modalUSD.textContent      = `$${pointsToUSD(points)} USD`;

  const label = document.getElementById('redeemAccountLabel');
  const input = document.getElementById('redeemAccount');
  if (label) label.textContent  = platform.field || 'Cuenta';
  if (input) input.placeholder  = platform.placeholder || '';

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeRedeemModal() {
  const modal = document.getElementById('redeemModal');
  if (!modal) return;
  modal.classList.remove('active');
  document.body.style.overflow = '';
  const form = document.getElementById('redeemForm');
  if (form) form.reset();
}

async function processRedeem(e) {
  e.preventDefault();

  const fullName = document.getElementById('redeemFullName')?.value.trim();
  const account  = document.getElementById('redeemAccount')?.value.trim();
  const points   = parseInt(document.getElementById('redeemPoints')?.value, 10) || 0;
  const usdAmt   = pointsToUSD(points);
  const platform = PLATFORM_LABELS[selectedPlatform] || {};

  if (!fullName || fullName.length < 3) {
    await showModal('Campo requerido', 'Ingresa tu nombre completo.');
    return;
  }
  if (!account) {
    await showModal('Campo requerido', `Ingresa tu ${platform.field || 'cuenta'}.`);
    return;
  }

  const confirmed = await showModal(
    '¿Confirmar canje?',
    `VirtualCoins: ${points.toLocaleString()} 🪙\nRecibirás: $${usdAmt} USD\nPlataforma: ${platform.name}\nCuenta: ${account}\n\nTiempo estimado: 24–48 horas.`,
    [
      { label: 'Cancelar', primary: false, value: false },
      { label: 'Confirmar', primary: true,  value: true  },
    ]
  );
  if (!confirmed) return;

  const btn = document.getElementById('confirmRedeemBtn');
  if (btn) { btn.textContent = 'Procesando...'; btn.disabled = true; }

  try {
    const newPoints = currentUserPoints - points;

    await window.db.collection('users').doc(currentUserId).update({ points: newPoints });

    await window.db.collection('pointsHistory').add({
      userId: currentUserId,
      type: 'redeem',
      points: -points,
      platform: selectedPlatform,
      createdAt: firebase.firestore.Timestamp.now(),
    });

    await window.db.collection('redeemRequests').add({
      userId: currentUserId,
      platform: selectedPlatform,
      fullName,
      account,
      pointsAmount: points,
      usdAmount: parseFloat(usdAmt),
      status: 'pending',
      createdAt: firebase.firestore.Timestamp.now(),
    });

    currentUserPoints = newPoints;
    updateBalanceUI(newPoints);
    setCachedPoints(newPoints);

    closeRedeemModal();

    await showModal(
      '✅ Solicitud enviada',
      `Recibirás $${usdAmt} USD en tu cuenta de ${platform.name} en 24–48 horas.\n\nCoins restantes: ${newPoints.toLocaleString()}`
    );

    // Limpiar selección
    document.getElementById('redeemPoints').value = '';
    document.getElementById('redeemUsdPreview').textContent = '$0.00 USD';
    document.querySelectorAll('.platform-card').forEach(c => c.classList.remove('selected'));
    selectedPlatform = null;
    validateRedeemForm();

  } catch(err) {
    console.error('processRedeem:', err);
    await showModal('❌ Error', 'No se pudo procesar el canje. Intenta de nuevo.');
    if (btn) { btn.textContent = 'Confirmar'; btn.disabled = false; }
  }
}

/* ============================================ */
/* AUTH + INIT */
/* ============================================ */
function checkAuth() {
  waitForFirebase(() => {
    firebase.auth().onAuthStateChanged(user => {
      if (!user) { window.location.href = withAppFlag('index.html'); return; }
      window._vcCurrentUser = user;
      loadUserPoints(user.uid);
      loadNotificationCount(user.uid);
    });
  });
}

window.addEventListener('load', () => {
  setupPlatformCards();
  setupRedeemInput();

  // Botón proceder
  const proceedBtn = document.getElementById('proceedRedeemBtn');
  if (proceedBtn) proceedBtn.addEventListener('click', openRedeemModal);

  // Cerrar modal
  const closeBtn  = document.getElementById('closeRedeemModal');
  const cancelBtn = document.getElementById('cancelRedeemBtn');
  const backdrop  = document.querySelector('#redeemModal .modal-backdrop');
  if (closeBtn)  closeBtn.addEventListener('click',  closeRedeemModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeRedeemModal);
  if (backdrop)  backdrop.addEventListener('click',  closeRedeemModal);

  // Formulario
  const form = document.getElementById('redeemForm');
  if (form) form.addEventListener('submit', processRedeem);

  // ESC cierra modal
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeRedeemModal();
  });

  checkAuth();
});
