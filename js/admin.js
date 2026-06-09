/* =================================================
   ADMIN.JS — VirtualGift Panel de Administración
   Guard: users/{uid}.isAdmin === true
   ================================================= */
'use strict';

// ─────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────
let adminUser        = null;
let canjeFilter      = 'pending';
let currentSorteo    = null;
let currentPartRaffle = null; // {id, title} del sorteo con participantes abierto

const PLATFORM_NAME = {
  paypal: 'PayPal', amazon: 'Amazon Gift Card',
  steam: 'Steam Wallet', googleplay: 'Google Play', psn: 'PlayStation',
  xbox: 'Xbox', netflix: 'Netflix', spotify: 'Spotify',
};
const PLATFORM_ICON = {
  paypal: '💳', amazon: '📦', steam: '🎮', googleplay: '📱', psn: '🎮',
  xbox: '🎮', netflix: '🎬', spotify: '🎵',
};
const PLATFORM_IMG = {
  paypal:     'images/giftcards/paypal.png',
  amazon:     'images/giftcards/amazon.png',
  steam:      'images/giftcards/steam.png',
  googleplay: 'images/giftcards/googleplay.png',
  psn:        'images/giftcards/psn.png',
  xbox:       'images/giftcards/xbox.png',
  netflix:    'images/giftcards/netflix.png',
  spotify:    'images/giftcards/spotify.png',
};
const STATUS_LABEL = {
  pending: '⏳ Pendiente', completed: '✅ Completado', rejected: '❌ Rechazado',
};

// ─────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function fmtDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('es-DO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
function toast(msg, ok = true) {
  const el = document.getElementById('adminToast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'admin-toast ' + (ok ? 'ok' : 'err') + ' show';
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3200);
}
function showLoading(show) {
  const el = document.getElementById('gateLoading');
  if (el) el.style.display = show ? 'flex' : 'none';
}
function showDenied() {
  showLoading(false);
  const el = document.getElementById('gateDenied');
  if (el) el.style.display = 'flex';
}
function showAdmin() {
  showLoading(false);
  const el = document.getElementById('adminWrap');
  if (el) el.style.display = 'block';
}
function setStat(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = typeof val === 'number' ? val.toLocaleString() : val;
}
function setVal(id, v) {
  const el = document.getElementById(id);
  if (el) el.value = v !== undefined && v !== null ? v : '';
}

// ─────────────────────────────────────────────────
// TABS
// ─────────────────────────────────────────────────
const TAB_TITLES = {
  tabDashboard:      'Dashboard',
  tabCanjes:         'Gestión de Canjes',
  tabNoticias:       'Noticias',
  tabNotificaciones: 'Notificaciones',
  tabSorteos:        'Sorteos',
  tabUsuarios:       'Usuarios',
  tabTrabajadores:   'Equipo de Trabajo',
  tabSoporte:        'Chat de Soporte',
};

window.switchTab = function (id) {
  // Actualizar tabs móvil y botones sidebar
  document.querySelectorAll('[data-tab]').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === id)
  );
  // Actualizar paneles
  document.querySelectorAll('.admin-panel').forEach(p =>
    p.classList.toggle('active', p.id === id)
  );
  // Actualizar título en el header
  const titleEl = document.getElementById('headerSectionTitle');
  if (titleEl) titleEl.textContent = TAB_TITLES[id] || '';

  if (id === 'tabDashboard')      loadDashboard();
  if (id === 'tabCanjes')         loadCanjes();
  if (id === 'tabNoticias')       loadNoticias();
  if (id === 'tabNotificaciones') loadNotificaciones();
  if (id === 'tabSorteos')        loadSorteos();
  if (id === 'tabUsuarios')       resetUsersTab();
  if (id === 'tabTrabajadores')   loadTrabajadores();
  if (id === 'tabSoporte')        loadSoporte();
};

// ─────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const [usersSnap, pendingSnap, activeSnap, completedSnap, newsSnap] = await Promise.all([
      window.db.collection('users').get(),
      window.db.collection('redeemRequests').where('status', '==', 'pending').get(),
      window.db.collection('raffles').where('endDate', '>', new Date()).get(),
      window.db.collection('redeemRequests').where('status', '==', 'completed').get(),
      window.db.collection('news').get(),
    ]);

    setStat('dashUsers',     usersSnap.size);
    setStat('dashPending',   pendingSnap.size);
    setStat('dashSorteos',   activeSnap.size);
    setStat('dashCompleted', completedSnap.size);
    setStat('dashNews',      newsSnap.size);

    // Total USD pagado
    let totalUsd = 0;
    completedSnap.forEach(d => { totalUsd += (d.data().usdAmount || 0); });
    setStat('dashUsdPaid', '$' + totalUsd.toFixed(2));

    ['canjeBadge', 'canjeBadgeSidebar'].forEach(id => {
      const badge = document.getElementById(id);
      if (badge) {
        badge.textContent = pendingSnap.size;
        badge.style.display = pendingSnap.size > 0 ? 'inline-flex' : 'none';
      }
    });

    const recentSnap = await window.db.collection('redeemRequests')
      .orderBy('createdAt', 'desc').limit(5).get();
    const list = document.getElementById('dashRecentList');
    if (list) {
      list.innerHTML = recentSnap.empty
        ? '<p class="admin-empty">Sin solicitudes aún</p>'
        : recentSnap.docs.map(d => buildRowMini(d.id, d.data())).join('');
    }
  } catch (e) {
    console.error('[admin] loadDashboard', e);
  }
}

function buildRowMini(id, d) {
  const plat   = PLATFORM_NAME[d.platform] || d.platform || '—';
  const s      = d.status || 'pending';
  const cls    = { pending: 'warn', completed: 'ok', rejected: 'err' }[s] || 'warn';
  const imgSrc = PLATFORM_IMG[d.platform];
  const platIcon = imgSrc
    ? `<img src="${imgSrc}" class="arm-plat-img" alt="${esc(plat)}" onerror="this.style.display='none'">`
    : '';
  return `<div class="admin-row-mini">
    ${platIcon}
    <div class="arm-info">
      <span class="arm-name">${esc(d.fullName || '—')}</span>
      <span class="arm-plat">${esc(plat)} · $${(d.usdAmount || 0).toFixed(2)} USD</span>
    </div>
    <span class="admin-badge ${cls}">${STATUS_LABEL[s] || s}</span>
  </div>`;
}

// ─────────────────────────────────────────────────
// CANJES
// ─────────────────────────────────────────────────
window.loadCanjes = async function (filter) {
  if (filter !== undefined) canjeFilter = filter;

  document.querySelectorAll('.canje-filter-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.filter === canjeFilter)
  );

  const list = document.getElementById('canjeList');
  if (!list) return;
  list.innerHTML = '<div class="admin-loading">Cargando...</div>';

  try {
    let q;
    if (canjeFilter === 'all') {
      q = window.db.collection('redeemRequests').orderBy('createdAt', 'desc').limit(50);
    } else {
      q = window.db.collection('redeemRequests')
        .where('status', '==', canjeFilter)
        .orderBy('createdAt', 'desc').limit(50);
    }
    const snap = await q.get();
    list.innerHTML = snap.empty
      ? '<p class="admin-empty">No hay solicitudes en esta categoría</p>'
      : snap.docs.map(d => buildCanjeCard(d.id, d.data())).join('');
  } catch (e) {
    console.error('[admin] loadCanjes', e);
    list.innerHTML = '<p class="admin-empty">Error al cargar. Verifica los índices de Firestore.</p>';
  }
};

function buildCanjeCard(id, d) {
  const plat   = PLATFORM_NAME[d.platform] || d.platform || '—';
  const status = d.status || 'pending';
  const scls   = { pending: 'warn', completed: 'ok', rejected: 'err' }[status] || 'warn';
  const imgSrc = PLATFORM_IMG[d.platform];
  const platEl = imgSrc
    ? `<img src="${imgSrc}" class="canje-plat-img" alt="${esc(plat)}" onerror="this.outerHTML='<span class=canje-plat-icon>${PLATFORM_ICON[d.platform]||'💳'}</span>'">`
    : `<span class="canje-plat-icon">${PLATFORM_ICON[d.platform] || '💳'}</span>`;
  const actions = status === 'pending' ? `
    <div class="canje-actions">
      <button type="button" class="btn-canje-ok"  onclick="updateCanjeStatus('${id}','completed')">✓ Completar</button>
      <button type="button" class="btn-canje-err" onclick="updateCanjeStatus('${id}','rejected')">✗ Rechazar</button>
    </div>` : '';
  const extraDate = d.completedAt
    ? `<div class="canje-row"><span>Completado</span><strong>${fmtDate(d.completedAt)}</strong></div>` : '';
  const emailRow = d.email
    ? `<div class="canje-row"><span>Correo</span><strong>${esc(d.email)}</strong></div>` : '';

  return `<div class="canje-card" id="canje-${id}">
    <div class="canje-card-head">
      ${platEl}
      <div class="canje-head-info">
        <span class="canje-name">${esc(d.fullName || '—')}</span>
        <span class="canje-plat">${esc(plat)}</span>
      </div>
      <span class="admin-badge ${scls}">${STATUS_LABEL[status] || status}</span>
    </div>
    <div class="canje-card-body">
      <div class="canje-row"><span>Cuenta / Email</span><strong>${esc(d.account || '—')}</strong></div>
      ${emailRow}
      <div class="canje-row"><span>Coins</span><strong>${(d.pointsAmount || 0).toLocaleString()} 🪙</strong></div>
      <div class="canje-row"><span>Monto</span><strong>$${(d.usdAmount || 0).toFixed(2)} USD</strong></div>
      <div class="canje-row"><span>Solicitado</span><strong>${fmtDate(d.createdAt)}</strong></div>
      ${extraDate}
    </div>
    ${actions}
  </div>`;
}

window.updateCanjeStatus = async function (id, status) {
  try {
    const fn = firebase.functions().httpsCallable('processRedeemDecision');
    await fn({ requestId: id, decision: status });
    toast(status === 'completed' ? '✅ Marcado como completado' : '❌ Rechazado — coins devueltos');
    window.loadCanjes();
    loadDashboard();
  } catch (e) {
    console.error('[admin] updateCanjeStatus', e);
    toast('Error: ' + (e.message || 'No se pudo actualizar'), false);
  }
};

// ─────────────────────────────────────────────────
// SORTEOS
// ─────────────────────────────────────────────────
async function loadSorteos() {
  const list = document.getElementById('sorteoList');
  if (!list) return;
  list.innerHTML = '<div class="admin-loading">Cargando...</div>';
  try {
    const snap = await window.db.collection('raffles').orderBy('endDate', 'desc').limit(30).get();
    if (snap.empty) {
      list.innerHTML = '<p class="admin-empty">No hay sorteos creados aún</p>';
      return;
    }
    const now = Date.now();
    list.innerHTML = snap.docs.map(d => {
      const r   = d.data();
      const end = r.endDate?.toDate ? r.endDate.toDate() : new Date(r.endDate);
      return buildSorteoRow(d.id, r, end > now);
    }).join('');
  } catch (e) {
    list.innerHTML = '<p class="admin-empty">Error al cargar</p>';
  }
}

function buildSorteoRow(id, r, active) {
  const endStr = r.endDate
    ? (r.endDate.toDate ? r.endDate.toDate() : new Date(r.endDate))
        .toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
  const idSafe = esc(id);
  return `<div class="sorteo-row">
    <div class="sorteo-row-info">
      <span class="sorteo-row-dot" style="background:${r.color || '#8b5cf6'}"></span>
      <div style="min-width:0">
        <span class="sorteo-row-title">${esc(r.title)} ${esc(r.value)}</span>
        <span class="sorteo-row-meta">${(r.participants || 0).toLocaleString()} participantes · ${endStr}</span>
      </div>
    </div>
    <div class="sorteo-row-actions">
      <span class="admin-badge ${active ? 'ok' : 'muted'}">${active ? 'Activo' : 'Terminado'}</span>
      <button type="button" class="btn-icon" onclick="openSorteoParticipants('${idSafe}','${esc(r.title)} ${esc(r.value)}')" title="Ver participantes">👥</button>
      <button type="button" class="btn-icon" onclick="editSorteo('${idSafe}')" title="Editar">✏️</button>
      <button type="button" class="btn-icon btn-del" onclick="deleteSorteo('${idSafe}')" title="Eliminar">🗑️</button>
    </div>
  </div>`;
}

// ── Participantes ──────────────────────────────
window.openSorteoParticipants = async function (raffleId, title) {
  currentPartRaffle = { id: raffleId, title };
  document.getElementById('sorteoListWrap').style.display   = 'none';
  document.getElementById('sorteoFormWrap').style.display   = 'none';
  document.getElementById('sorteoParticipantsWrap').style.display = 'block';
  document.getElementById('partSorteoName').textContent = title;
  document.getElementById('winnerBanner').innerHTML = '';
  const pList = document.getElementById('partList');
  pList.innerHTML = '<div class="admin-loading">Cargando participantes...</div>';

  try {
    const snap = await window.db.collection('raffleParticipants')
      .where('raffleId', '==', raffleId)
      .orderBy('enteredAt', 'asc')
      .get();

    // Agrupar por userId para contar entradas
    const byUser = {};
    snap.docs.forEach(d => {
      const u = d.data().userId;
      byUser[u] = (byUser[u] || 0) + 1;
    });
    const uids = Object.keys(byUser);
    document.getElementById('partCountLabel').textContent =
      `${snap.size} entradas · ${uids.length} participantes únicos`;

    if (uids.length === 0) {
      pList.innerHTML = '<p class="admin-empty">Aún no hay participantes</p>';
      return;
    }

    // Cargar nombres de usuarios en batches de 10
    const profiles = {};
    for (let i = 0; i < uids.length; i += 10) {
      const batch = uids.slice(i, i + 10);
      const usersSnap = await window.db.collection('users')
        .where(firebase.firestore.FieldPath.documentId(), 'in', batch).get();
      usersSnap.forEach(d => { profiles[d.id] = d.data(); });
    }

    // Construir lista expandida (una entrada por ticket, para que el ganador aleatorio sea justo)
    const tickets = [];
    snap.docs.forEach(d => {
      const uid = d.data().userId;
      const u   = profiles[uid] || {};
      tickets.push({ uid, name: u.displayName || u.username || uid.slice(0, 8) });
    });

    pList.innerHTML = uids.map((uid, i) => {
      const u    = profiles[uid] || {};
      const name = u.displayName || u.username || uid.slice(0, 8);
      return `<div class="part-row">
        <span class="part-num">#${i + 1}</span>
        <span class="part-name">${esc(name)}</span>
        <span class="part-entries">${byUser[uid]} entrada${byUser[uid] !== 1 ? 's' : ''}</span>
      </div>`;
    }).join('');

    // Guardar tickets en estado para el ganador
    currentPartRaffle.tickets = tickets;

  } catch (e) {
    console.error('[admin] openSorteoParticipants', e);
    pList.innerHTML = '<p class="admin-empty">Error al cargar participantes</p>';
  }
};

window.closeSorteoParticipants = function () {
  document.getElementById('sorteoParticipantsWrap').style.display = 'none';
  document.getElementById('sorteoListWrap').style.display = 'block';
  currentPartRaffle = null;
};

window.pickWinner = function () {
  const tickets = currentPartRaffle?.tickets;
  if (!tickets || tickets.length === 0) {
    toast('No hay participantes para elegir', false);
    return;
  }
  const winner = tickets[Math.floor(Math.random() * tickets.length)];
  document.getElementById('winnerBanner').innerHTML = `
    <div class="winner-banner">
      <div class="winner-banner-emoji">🎉</div>
      <div class="winner-banner-name">${esc(winner.name)}</div>
      <div class="winner-banner-sub">Elegido entre ${tickets.length} entradas · Sorteo: ${esc(currentPartRaffle.title)}</div>
    </div>`;
};

// ── Crear / editar sorteo ──────────────────────
window.newSorteo = function () {
  currentSorteo = null;
  resetSorteoForm();
  document.getElementById('sorteoFormTitle').textContent = 'Nuevo Sorteo';
  document.getElementById('sorteoFormWrap').style.display = 'block';
  document.getElementById('sorteoListWrap').style.display = 'none';
};

window.editSorteo = async function (id) {
  try {
    const doc = await window.db.collection('raffles').doc(id).get();
    if (!doc.exists) { toast('Sorteo no encontrado', false); return; }
    currentSorteo = { id, ...doc.data() };
    fillSorteoForm(currentSorteo);
    document.getElementById('sorteoFormTitle').textContent = 'Editar Sorteo';
    document.getElementById('sorteoFormWrap').style.display = 'block';
    document.getElementById('sorteoListWrap').style.display = 'none';
  } catch (e) {
    toast('Error al cargar sorteo', false);
  }
};

window.cancelSorteoForm = function () {
  document.getElementById('sorteoFormWrap').style.display = 'none';
  document.getElementById('sorteoListWrap').style.display = 'block';
  currentSorteo = null;
};

function fillSorteoForm(r) {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
  set('sfTitle', r.title); set('sfValue', r.value); set('sfCost', r.cost);
  set('sfMaxPart', r.maxParticipants); set('sfColor', r.color || '#8b5cf6');
  set('sfColorDark', r.colorDark || '#6d28d9'); set('sfImage', r.image || '');
  set('sfTag', r.tag || ''); set('sfTagColor', r.tagColor || '#f59e0b');
  if (r.endDate) {
    const d = r.endDate.toDate ? r.endDate.toDate() : new Date(r.endDate);
    set('sfEndDate', new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
  }
}

function resetSorteoForm() {
  ['sfTitle', 'sfValue', 'sfCost', 'sfMaxPart', 'sfTag', 'sfEndDate'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  setVal('sfColor', '#8b5cf6'); setVal('sfColorDark', '#6d28d9');
  setVal('sfImage', '');       setVal('sfTagColor', '#f59e0b');
}

window.saveSorteo = async function () {
  const gv = id => document.getElementById(id)?.value.trim();
  const title    = gv('sfTitle');
  const value    = gv('sfValue');
  const cost     = parseInt(gv('sfCost'), 10);
  const maxPart  = parseInt(gv('sfMaxPart'), 10);
  const endDateV = gv('sfEndDate');

  if (!title || !value || !cost || !maxPart || !endDateV) {
    toast('Completa todos los campos obligatorios', false); return;
  }

  const data = {
    title, value, cost, maxParticipants: maxPart,
    color:     gv('sfColor')     || '#8b5cf6',
    colorDark: gv('sfColorDark') || '#6d28d9',
    endDate:   firebase.firestore.Timestamp.fromDate(new Date(endDateV)),
    ...(gv('sfImage')    && { image: gv('sfImage') }),
    ...(gv('sfTag')      && { tag: gv('sfTag'), tagColor: gv('sfTagColor') || '#f59e0b' }),
  };

  const btn = document.getElementById('btnSaveSorteo');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

  try {
    if (currentSorteo?.id) {
      await window.db.collection('raffles').doc(currentSorteo.id).update(data);
      toast('✅ Sorteo actualizado');
    } else {
      data.participants = 0;
      data.active = true;
      data.createdAt = firebase.firestore.Timestamp.now();
      await window.db.collection('raffles').add(data);
      toast('✅ Sorteo creado');
    }
    window.cancelSorteoForm();
    loadSorteos();
  } catch (e) {
    console.error('[admin] saveSorteo', e);
    toast('Error al guardar', false);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar sorteo'; }
  }
};

window.deleteSorteo = async function (id) {
  if (!confirm('¿Eliminar este sorteo permanentemente? Esta acción no se puede deshacer.')) return;
  try {
    await window.db.collection('raffles').doc(id).delete();
    toast('Sorteo eliminado');
    loadSorteos();
  } catch (e) {
    toast('Error al eliminar', false);
  }
};

// ─────────────────────────────────────────────────
// USUARIOS
// ─────────────────────────────────────────────────
function resetUsersTab() {
  const input = document.getElementById('userSearchInput');
  if (input) input.value = '';
  const list = document.getElementById('userList');
  if (list) list.innerHTML = '<p class="admin-empty">Busca por correo electrónico o nombre</p>';
}

window.searchUsers = async function () {
  const query = document.getElementById('userSearchInput')?.value.trim().toLowerCase();
  const list  = document.getElementById('userList');
  if (!list) return;
  if (!query) { resetUsersTab(); return; }

  list.innerHTML = '<div class="admin-loading">Buscando...</div>';
  try {
    // Buscar por email (rango prefix)
    const [byEmail, byName] = await Promise.all([
      window.db.collection('users')
        .where('email', '>=', query)
        .where('email', '<=', query + '')
        .limit(10).get(),
      window.db.collection('users')
        .where('username', '>=', query)
        .where('username', '<=', query + '')
        .limit(10).get(),
    ]);

    // Merge sin duplicados
    const seen = new Set();
    const docs = [];
    [...byEmail.docs, ...byName.docs].forEach(d => {
      if (!seen.has(d.id)) { seen.add(d.id); docs.push(d); }
    });

    if (docs.length === 0) {
      list.innerHTML = '<p class="admin-empty">No se encontraron usuarios</p>';
      return;
    }
    list.innerHTML = docs.map(d => buildUserCard(d.id, d.data())).join('');
  } catch (e) {
    console.error('[admin] searchUsers', e);
    list.innerHTML = '<p class="admin-empty">Error al buscar.</p>';
  }
};

function buildUserCard(uid, u) {
  const initials  = (u.displayName || u.username || u.email || '?').slice(0, 2).toUpperCase();
  const isAdmin   = u.isAdmin === true;
  const uidSafe   = esc(uid);
  return `<div class="user-row-v2" id="ucard-${uidSafe}">
    <div class="user-row-v2-head">
      <div class="user-avatar-lg">${initials}</div>
      <div class="user-detail">
        <div class="user-detail-name">${esc(u.displayName || u.username || 'Sin nombre')}</div>
        <div class="user-detail-email">${esc(u.email || '—')}</div>
        <div class="user-detail-uid">${uidSafe}</div>
      </div>
      <div class="user-coins-big">${(u.points || 0).toLocaleString()} 🪙</div>
    </div>
    <div class="user-row-v2-actions">
      <div class="coin-adjust-wrap">
        <input type="number" class="coin-adjust-input" id="coinInput-${uidSafe}"
          placeholder="Cantidad" min="1">
        <button type="button" class="btn-coin-add" onclick="adjustCoins('${uidSafe}',1)">+ Dar</button>
        <button type="button" class="btn-coin-sub" onclick="adjustCoins('${uidSafe}',-1)">- Quitar</button>
      </div>
      <button type="button" class="btn-toggle-admin" onclick="toggleAdmin('${uidSafe}',${isAdmin})">
        ${isAdmin ? '👑 Quitar admin' : '⭐ Hacer admin'}
      </button>
    </div>
    ${isAdmin ? '<div style="margin-top:6px"><span class="admin-badge ok">Administrador</span></div>' : ''}
  </div>`;
}

window.adjustCoins = async function (uid, direction) {
  const input = document.getElementById('coinInput-' + uid);
  const amount = parseInt(input?.value, 10);
  if (!amount || amount <= 0) { toast('Ingresa una cantidad válida', false); return; }

  const delta = direction * amount;
  try {
    await window.db.collection('users').doc(uid).update({
      points: firebase.firestore.FieldValue.increment(delta),
    });
    await window.db.collection('pointsHistory').add({
      userId:    uid,
      type:      'admin_adjustment',
      points:    delta,
      adminId:   adminUser.uid,
      createdAt: firebase.firestore.Timestamp.now(),
    });
    toast((delta > 0 ? '+' : '') + delta.toLocaleString() + ' coins aplicados ✅');
    if (input) input.value = '';
    // Recargar la tarjeta
    const doc = await window.db.collection('users').doc(uid).get();
    if (doc.exists) {
      const el = document.getElementById('ucard-' + uid);
      if (el) el.outerHTML = buildUserCard(uid, doc.data());
    }
  } catch (e) {
    console.error('[admin] adjustCoins', e);
    toast('Error al ajustar coins', false);
  }
};

window.toggleAdmin = async function (uid, currentlyAdmin) {
  const action = currentlyAdmin ? 'quitar permisos de admin a' : 'dar permisos de admin a';
  if (!confirm(`¿Estás seguro de ${action} este usuario?`)) return;
  try {
    await window.db.collection('users').doc(uid).update({ isAdmin: !currentlyAdmin });
    toast(currentlyAdmin ? 'Admin removido' : '⭐ Usuario promovido a admin');
    const doc = await window.db.collection('users').doc(uid).get();
    if (doc.exists) {
      const el = document.getElementById('ucard-' + uid);
      if (el) el.outerHTML = buildUserCard(uid, doc.data());
    }
  } catch (e) {
    console.error('[admin] toggleAdmin', e);
    toast('Error al cambiar permisos', false);
  }
};


// ─────────────────────────────────────────────────
// NOTICIAS (lista inline)
// ─────────────────────────────────────────────────
let noticiaFilter = 'all';
let noticiaSearch = '';

window.loadNoticias = async function (filter) {
  if (filter !== undefined) noticiaFilter = filter;

  document.querySelectorAll('[data-nfilter]').forEach(b =>
    b.classList.toggle('active', b.dataset.nfilter === noticiaFilter)
  );

  const list = document.getElementById('noticiasList');
  if (!list) return;
  list.innerHTML = '<div class="admin-loading">Cargando...</div>';

  try {
    const [allSnap, pubSnap] = await Promise.all([
      window.db.collection('news').get(),
      window.db.collection('news').where('published', '==', true).get(),
    ]);
    setStat('newsTotal',     allSnap.size);
    setStat('newsPublished', pubSnap.size);
    setStat('newsDrafts',    allSnap.size - pubSnap.size);

    let q;
    if (noticiaFilter === 'published') {
      q = window.db.collection('news').where('published', '==', true).orderBy('date', 'desc').limit(80);
    } else if (noticiaFilter === 'draft') {
      q = window.db.collection('news').where('published', '==', false).orderBy('date', 'desc').limit(80);
    } else {
      q = window.db.collection('news').orderBy('date', 'desc').limit(80);
    }

    const snap = await q.get();
    if (snap.empty) {
      list.innerHTML = '<p class="admin-empty">No hay noticias en esta categoría</p>';
      return;
    }

    let docs = snap.docs;
    const search = noticiaSearch.trim().toLowerCase();
    if (search) {
      docs = docs.filter(d => {
        const data = d.data();
        return (data.feedTitle || data.title || '').toLowerCase().includes(search)
          || (data.category || '').toLowerCase().includes(search);
      });
    }

    if (docs.length === 0) {
      list.innerHTML = '<p class="admin-empty">No hay resultados para esa búsqueda</p>';
      return;
    }
    list.innerHTML = docs.map(d => buildNoticiaRow(d.id, d.data())).join('');
  } catch (e) {
    console.error('[admin] loadNoticias', e);
    list.innerHTML = '<p class="admin-empty">Error al cargar noticias. Verifica índices de Firestore.</p>';
  }
};

window.filterNoticias = function () {
  noticiaSearch = document.getElementById('noticiaSearchInput')?.value || '';
  window.loadNoticias();
};

function buildNoticiaRow(id, d) {
  const pub      = d.published === true;
  const title    = esc(d.feedTitle || d.title || '(sin título)');
  const cat      = esc(d.category || 'General');
  const date     = fmtDate(d.date || d.createdAt);
  const idS      = esc(id);
  const coverSrc = d.coverImageUrl || d.cover || '';
  const cover    = coverSrc ? `<img src="${esc(coverSrc)}" alt="" loading="lazy">` : '<span style="font-size:1.5rem">📰</span>';
  const editHref = typeof withAppFlag === 'function'
    ? withAppFlag(`admin-news.html?id=${encodeURIComponent(id)}`)
    : `admin-news.html?id=${encodeURIComponent(id)}`;
  return `<div class="noticia-row" id="nrow-${idS}">
    <div class="noticia-thumb">${cover}</div>
    <div class="noticia-info">
      <span class="noticia-title">${title}</span>
      <span class="noticia-meta"><span class="noticia-cat-badge">${cat}</span> · ${date}</span>
    </div>
    <div class="noticia-actions">
      <span class="admin-badge ${pub ? 'ok' : 'muted'}">${pub ? 'Publicada' : 'Borrador'}</span>
      <a href="${editHref}" class="btn-icon" title="Editar artículo">✏️</a>
      <button type="button" class="btn-icon" title="${pub ? 'Despublicar' : 'Publicar'}"
        onclick="toggleNoticiaPublish('${idS}',${pub})">${pub ? '📦' : '🚀'}</button>
      <button type="button" class="btn-icon btn-del" title="Eliminar"
        onclick="deleteNoticia('${idS}')">🗑️</button>
    </div>
  </div>`;
}

window.toggleNoticiaPublish = async function (id, currentlyPublished) {
  try {
    const upd = { published: !currentlyPublished };
    if (!currentlyPublished) upd.date = firebase.firestore.Timestamp.now();
    await window.db.collection('news').doc(id).update(upd);
    toast(currentlyPublished ? '📦 Despublicada' : '🚀 Publicada');
    window.loadNoticias();
  } catch (e) {
    console.error('[admin] toggleNoticiaPublish', e);
    toast('Error al cambiar estado', false);
  }
};

window.deleteNoticia = async function (id) {
  if (!confirm('¿Eliminar esta noticia permanentemente?')) return;
  try {
    await window.db.collection('news').doc(id).delete();
    toast('Noticia eliminada');
    window.loadNoticias();
  } catch (e) {
    toast('Error al eliminar', false);
  }
};

// ─────────────────────────────────────────────────
// NOTIFICACIONES (inline)
// ─────────────────────────────────────────────────
async function loadNotificaciones() {
  const list = document.getElementById('notifRecentList');
  if (!list) return;
  list.innerHTML = '<div class="admin-loading">Cargando...</div>';
  try {
    const snap = await window.db.collection('globalNotifications')
      .orderBy('sentAt', 'desc').limit(15).get();
    if (snap.empty) {
      list.innerHTML = '<p class="admin-empty">Sin notificaciones enviadas aún</p>';
      return;
    }
    list.innerHTML = snap.docs.map(d => buildNotifRow(d.data())).join('');
  } catch (e) {
    console.error('[admin] loadNotificaciones', e);
    list.innerHTML = '<p class="admin-empty">Error al cargar</p>';
  }
}

function buildNotifRow(d) {
  const imgHtml = d.imageUrl
    ? `<img class="notif-img" src="${esc(d.imageUrl)}" alt="" loading="lazy">`
    : '';
  return `<div class="notif-recent-row">
    ${imgHtml}
    <div class="notif-info">
      <div class="notif-title-txt">${esc(d.title || '—')}</div>
      <div class="notif-body-txt">${esc(d.body || '')}</div>
      <div class="notif-date-txt">${fmtDate(d.sentAt)}</div>
    </div>
  </div>`;
}

window.clearNotifForm = function () {
  ['notifTitle', 'notifBody', 'notifImage'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  ['notifTitleCount', 'notifBodyCount'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = el.textContent.replace(/^\d+/, '0');
  });
};

window.sendNotificacion = async function () {
  const title    = document.getElementById('notifTitle')?.value.trim();
  const body     = document.getElementById('notifBody')?.value.trim();
  const imageUrl = document.getElementById('notifImage')?.value.trim();

  if (!title || !body) {
    toast('Título y mensaje son obligatorios', false);
    return;
  }

  const btn = document.getElementById('btnSendNotif');
  if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }

  try {
    const data = {
      title, body,
      ...(imageUrl && { imageUrl }),
      type:   'global',
      sentAt: firebase.firestore.Timestamp.now(),
      sentBy: adminUser?.uid || 'admin',
    };
    await window.db.collection('globalNotifications').add(data);
    toast('✅ Notificación enviada a todos los usuarios');
    window.clearNotifForm();
    loadNotificaciones();
  } catch (e) {
    console.error('[admin] sendNotificacion', e);
    toast('Error al enviar la notificación', false);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '📤 Enviar a todos los usuarios'; }
  }
};

// Contadores de caracteres para el formulario de notificaciones
function initNotifCounters() {
  const pairs = [
    ['notifTitle', 'notifTitleCount', 60],
    ['notifBody',  'notifBodyCount',  160],
  ];
  pairs.forEach(([inputId, countId, max]) => {
    const input = document.getElementById(inputId);
    const count = document.getElementById(countId);
    if (!input || !count) return;
    const update = () => {
      count.textContent = `${input.value.length}/${max}`;
      count.style.color = input.value.length >= max ? 'var(--err)' : 'var(--text2)';
    };
    input.addEventListener('input', update);
  });
}

// ─────────────────────────────────────────────────
// TRABAJADORES
// ─────────────────────────────────────────────────
const ROLES = {
  admin:      { label: 'Admin',      icon: '👑' },
  editor:     { label: 'Editor',     icon: '✏️' },
  soporte:    { label: 'Soporte',    icon: '🎧' },
  moderador:  { label: 'Moderador',  icon: '🛡️' },
};

async function loadTrabajadores() {
  const list = document.getElementById('trabajadoresList');
  if (!list) return;
  list.innerHTML = '<div class="admin-loading">Cargando...</div>';

  try {
    const [adminSnap, staffSnap] = await Promise.all([
      window.db.collection('users').where('isAdmin', '==', true).limit(50).get(),
      window.db.collection('users').where('isStaff', '==', true).limit(50).get(),
    ]);

    const seen = new Set();
    const docs = [];
    [...adminSnap.docs, ...staffSnap.docs].forEach(d => {
      if (!seen.has(d.id)) { seen.add(d.id); docs.push(d); }
    });

    if (docs.length === 0) {
      list.innerHTML = '<p class="admin-empty">No hay trabajadores asignados. Usa el buscador de arriba para añadir.</p>';
      return;
    }
    list.innerHTML = docs.map(d => buildWorkerRow(d.id, d.data())).join('');
  } catch (e) {
    console.error('[admin] loadTrabajadores', e);
    list.innerHTML = '<p class="admin-empty">Error al cargar trabajadores</p>';
  }
}

function buildWorkerRow(uid, u) {
  const role     = u.role || (u.isAdmin ? 'admin' : 'soporte');
  const name     = u.displayName || u.username || '—';
  const initials = name.slice(0, 2).toUpperCase();
  const uidS     = esc(uid);
  const isSelf   = adminUser && adminUser.uid === uid;

  const roleOptions = Object.entries(ROLES).map(([k, v]) =>
    `<option value="${k}" ${role === k ? 'selected' : ''}>${v.icon} ${v.label}</option>`
  ).join('');

  const roleCls = ROLES[role] ? role : 'soporte';

  return `<div class="worker-row" id="wrow-${uidS}">
    <div class="user-avatar-lg" style="width:40px;height:40px;font-size:.85rem">${initials}</div>
    <div class="worker-info">
      <div class="user-detail-name">${esc(name)}${isSelf ? ' <span style="font-size:.7rem;color:var(--text2)">(tú)</span>' : ''}</div>
      <div class="user-detail-email">${esc(u.email || '—')}</div>
    </div>
    <div class="worker-actions">
      <span class="role-badge ${roleCls}">${ROLES[role]?.icon || ''} ${ROLES[role]?.label || role}</span>
      <select class="worker-role-select" onchange="changeWorkerRole('${uidS}', this.value)" ${isSelf ? 'disabled title="No puedes cambiar tu propio rol"' : ''}>
        ${roleOptions}
      </select>
      ${!isSelf ? `<button type="button" class="btn-icon btn-del" onclick="removeWorker('${uidS}')" title="Quitar del equipo">🗑️</button>` : ''}
    </div>
  </div>`;
}

window.searchWorkerUser = async function () {
  const query  = document.getElementById('workerSearchInput')?.value.trim().toLowerCase();
  const result = document.getElementById('workerSearchResult');
  if (!result) return;
  if (!query) { result.innerHTML = ''; return; }

  result.innerHTML = '<div class="admin-loading">Buscando...</div>';
  try {
    const snap = await window.db.collection('users')
      .where('email', '>=', query)
      .where('email', '<=', query + '\uf8ff')
      .limit(5).get();

    if (snap.empty) {
      result.innerHTML = '<p class="admin-empty">Usuario no encontrado</p>';
      return;
    }

    result.innerHTML = snap.docs.map(d => {
      const u       = d.data();
      const name    = u.displayName || u.username || '—';
      const isStaff = u.isAdmin || u.isStaff;
      const uidS    = esc(d.id);
      const init    = name.slice(0, 2).toUpperCase();
      return `<div class="worker-result-row">
        <div class="user-avatar-lg" style="width:36px;height:36px;font-size:.78rem;flex-shrink:0">${init}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:.88rem;font-weight:700;color:#fff">${esc(name)}</div>
          <div style="font-size:.72rem;color:var(--text2)">${esc(u.email || '—')}</div>
        </div>
        ${isStaff
          ? '<span class="admin-badge ok">Ya es miembro</span>'
          : `<button type="button" class="btn-new" style="margin:0;padding:7px 12px;font-size:.78rem" onclick="addWorker('${uidS}')">+ Agregar</button>`
        }
      </div>`;
    }).join('');
  } catch (e) {
    console.error('[admin] searchWorkerUser', e);
    result.innerHTML = '<p class="admin-empty">Error al buscar</p>';
  }
};

window.addWorker = async function (uid) {
  try {
    await window.db.collection('users').doc(uid).update({ isStaff: true, role: 'soporte' });
    toast('✅ Trabajador agregado al equipo');
    const result = document.getElementById('workerSearchResult');
    const input  = document.getElementById('workerSearchInput');
    if (result) result.innerHTML = '';
    if (input)  input.value = '';
    loadTrabajadores();
  } catch (e) {
    console.error('[admin] addWorker', e);
    toast('Error al agregar trabajador', false);
  }
};

window.changeWorkerRole = async function (uid, newRole) {
  try {
    await window.db.collection('users').doc(uid).update({ role: newRole });
    toast('✅ Rol actualizado');
    // Refrescar el row
    const doc = await window.db.collection('users').doc(uid).get();
    if (doc.exists) {
      const el = document.getElementById('wrow-' + uid);
      if (el) el.outerHTML = buildWorkerRow(uid, doc.data());
    }
  } catch (e) {
    console.error('[admin] changeWorkerRole', e);
    toast('Error al cambiar rol', false);
  }
};

window.removeWorker = async function (uid) {
  if (!confirm('¿Quitar a este usuario del equipo de trabajo?')) return;
  try {
    await window.db.collection('users').doc(uid).update({
      isStaff: false,
      role: firebase.firestore.FieldValue.delete(),
    });
    toast('Trabajador eliminado del equipo');
    loadTrabajadores();
  } catch (e) {
    console.error('[admin] removeWorker', e);
    toast('Error al eliminar trabajador', false);
  }
};

// ─────────────────────────────────────────────────
// SOPORTE — Enterprise Chat System
// ─────────────────────────────────────────────────
let _soporteSnap         = null;
let _unsubSoporte        = null;
let _soporteCurrentChat  = null;
let _unsubSoporteChat    = null;
let _unsubSoporteDoc     = null;
let _soporteFilter       = 'all';
let _soportePrioFilter   = 'all';
let _sc2InfoVisible      = false;
let _adminTypingTimer    = null;
let _currentMsgsData     = [];

// AI suggestion templates keyed by detected topic
const _AI_TOPICS = {
  canje: {
    label: '🎁 Canje',
    kw: ['canje','canjear','regalo','card','tarjeta','google play','amazon','steam','robux','paypal','redeem','código','code'],
    suggestions: [
      '¡Hola! Entiendo que tienes una consulta sobre un canje. ¿Puedes indicarme el ID del canje o el producto que intentas canjear para revisarlo de inmediato?',
      'Voy a revisar el estado de tu canje ahora mismo. ¿Puedes compartir el número de ticket o una captura de pantalla de la transacción?',
      'Tu canje ha sido verificado y procesado correctamente. En las próximas 24 horas recibirás tu recompensa. ¡Gracias por tu paciencia!',
    ],
  },
  pago: {
    label: '💰 Pago',
    kw: ['pago','cobro','dinero','balance','saldo','transferencia','nequi','binance','recibir','retirar','withdraw'],
    suggestions: [
      'Entiendo tu consulta sobre el pago. Para procesarlo correctamente necesito verificar tus datos. ¿Puedes confirmar el monto y el método de pago seleccionado?',
      'He revisado tu historial de pagos. ¿Puedes indicarme la fecha aproximada y el monto de la transacción en cuestión?',
      'Los pagos se procesan en un plazo de 1-3 días hábiles. Si ya pasó ese tiempo y no has recibido nada, escríbenos y revisamos el caso de inmediato.',
    ],
  },
  sorteo: {
    label: '🎰 Sorteo',
    kw: ['sorteo','ganado','premio','winner','ganador','raffle','lotería'],
    suggestions: [
      '¡Felicitaciones por participar! Para reclamar tu premio del sorteo necesito verificar tu identidad. Por favor comparte tu UID y capturas del sorteo.',
      'He revisado los resultados del sorteo. Tu participación está confirmada. El proceso de entrega de premios puede tomar hasta 7 días hábiles.',
      'Los ganadores son seleccionados de forma aleatoria y verificados manualmente. Te contactaremos directamente cuando tu premio esté listo para ser entregado.',
    ],
  },
  error: {
    label: '🐛 Error técnico',
    kw: ['error','falla','bug','problema','no funciona','crash','pantalla','blanco','negro','lento','fallo'],
    suggestions: [
      'Lamentamos los inconvenientes técnicos que experimentas. ¿Puedes compartir una captura del error y los pasos que realizaste antes de que ocurriera?',
      'Hemos escalado este problema a nuestro equipo técnico. En breve te contactaremos con una solución. ¿Qué dispositivo y sistema operativo usas?',
      'Para reproducir y resolver este error lo antes posible, necesito que me indiques: 1) qué dispositivo usas, 2) qué versión del sistema operativo, 3) qué acción realizabas.',
    ],
  },
  cuenta: {
    label: '👤 Cuenta',
    kw: ['cuenta','perfil','acceso','contraseña','login','entrar','verificar','correo','email','registrar'],
    suggestions: [
      'Para ayudarte con tu cuenta, necesito verificar tu identidad. ¿Puedes proporcionarme el correo electrónico asociado y tu UID?',
      'Por seguridad hemos verificado tu cuenta. Para recuperar el acceso, intenta cerrar sesión completamente y volver a iniciar sesión con tus credenciales.',
      'He revisado tu cuenta y todo parece estar en orden. Si el problema persiste, borra la caché de la aplicación y vuelve a intentarlo.',
    ],
  },
};

const _AI_GENERAL = [
  '¡Hola! Soy parte del equipo de soporte de VirtualGift. Estoy revisando tu consulta y en breve te doy una respuesta detallada. ¡Gracias por tu paciencia!',
  'Entiendo tu situación y voy a hacer todo lo posible para ayudarte. ¿Puedes proporcionarme más detalles sobre lo que necesitas?',
  'Tu caso ha sido registrado en nuestro sistema. Te contactaremos en las próximas horas con una resolución. ¡Gracias por usar VirtualGift!',
];

function _detectAITopic(msgs) {
  const text = msgs.filter(m => m.from === 'user').map(m => (m.text || '').toLowerCase()).join(' ');
  for (const [key, data] of Object.entries(_AI_TOPICS)) {
    if (data.kw.some(kw => text.includes(kw))) return { key, ...data };
  }
  return { key: 'general', label: '💬 General', suggestions: _AI_GENERAL };
}

function updateChatBadges(count) {
  ['chatBadge', 'chatBadgeSidebar'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = count;
    el.style.display = count > 0 ? 'inline-flex' : 'none';
  });
  const total = document.getElementById('sc2TotalBadge');
  if (total) {
    total.textContent = count;
    total.style.display = count > 0 ? 'inline-flex' : 'none';
  }
}

function updateSoporteMetrics(snap) {
  if (!snap) return;
  const today = new Date(); today.setHours(0,0,0,0);
  let total = 0, active = 0, waiting = 0, unread = 0, closedToday = 0;
  snap.forEach(d => {
    const data = d.data();
    total++;
    const st = data.status || 'waiting';
    if (st !== 'closed') active++;
    if (st === 'waiting') waiting++;
    if (data.unreadAdmin > 0) unread++;
    if (st === 'closed' && data.lastMessageAt) {
      const t = data.lastMessageAt.toDate ? data.lastMessageAt.toDate() : new Date(data.lastMessageAt);
      if (t >= today) closedToday++;
    }
  });
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('sc2MetTotal',   total);
  set('sc2MetOpen',    active);
  set('sc2MetWaiting', waiting);
  set('sc2MetUnread',  unread);
  set('sc2MetClosed',  closedToday);
}

function initSoporteListener() {
  if (_unsubSoporte) return;
  _unsubSoporte = window.db.collection('supportChats')
    .orderBy('lastMessageAt', 'desc')
    .onSnapshot(snap => {
      _soporteSnap = snap;
      let unread = 0;
      snap.forEach(d => { unread += (d.data().unreadAdmin || 0); });
      updateChatBadges(unread);
      updateSoporteMetrics(snap);
      if (document.getElementById('soporteChatList')) renderSoporteList(snap);
    }, err => {
      console.error('[admin] soporte listener:', err);
    });
}

window.loadSoporte = function () {
  const emptyState = document.getElementById('soporteListWrap');
  const chatWrap   = document.getElementById('soporteChatWrap');
  const infoPanel  = document.getElementById('sc2InfoPanel');
  if (emptyState) emptyState.style.display = '';
  if (chatWrap)   chatWrap.style.display = 'none';
  if (infoPanel)  { infoPanel.style.display = 'none'; _sc2InfoVisible = false; }

  const listEl = document.getElementById('soporteChatList');
  if (!listEl) return;

  if (_soporteSnap) {
    updateSoporteMetrics(_soporteSnap);
    renderSoporteList(_soporteSnap);
    return;
  }

  listEl.innerHTML = '<div class="sc2-list-empty"><div class="sc2-list-empty-icon">⏳</div><div class="sc2-list-empty-text">Cargando...</div></div>';

  window.db.collection('supportChats')
    .orderBy('lastMessageAt', 'desc')
    .get()
    .then(snap => { _soporteSnap = snap; updateSoporteMetrics(snap); renderSoporteList(snap); })
    .catch(() => {
      listEl.innerHTML = '<div class="sc2-list-empty"><div class="sc2-list-empty-icon">⚠️</div><div class="sc2-list-empty-text">Error al cargar chats</div></div>';
    });
};

function renderSoporteList(snap) {
  const listEl = document.getElementById('soporteChatList');
  if (!listEl) return;

  const search = (document.getElementById('sc2SearchInput')?.value || '').toLowerCase().trim();
  let docs = snap ? snap.docs : [];

  // Status filter
  if (_soporteFilter === 'active') {
    docs = docs.filter(d => (d.data().status || 'waiting') !== 'closed');
  } else if (_soporteFilter === 'waiting') {
    docs = docs.filter(d => (d.data().status || 'waiting') === 'waiting');
  } else if (_soporteFilter !== 'all') {
    docs = docs.filter(d => (d.data().status || 'waiting') === _soporteFilter);
  }

  // Priority filter
  if (_soportePrioFilter !== 'all') {
    docs = docs.filter(d => (d.data().priority || 'low') === _soportePrioFilter);
  }

  // Search
  if (search) {
    docs = docs.filter(d => {
      const data = d.data();
      return (data.userName  || '').toLowerCase().includes(search)
          || (data.userEmail || '').toLowerCase().includes(search);
    });
  }

  // Sort: urgent first, then by lastMessageAt desc
  const prioOrder = { urgent:0, high:1, medium:2, low:3 };
  docs.sort((a, b) => {
    const pa = prioOrder[a.data().priority || 'low'] || 3;
    const pb = prioOrder[b.data().priority || 'low'] || 3;
    if (pa !== pb) return pa - pb;
    const ta = a.data().lastMessageAt?.toMillis?.() || 0;
    const tb = b.data().lastMessageAt?.toMillis?.() || 0;
    return tb - ta;
  });

  if (!docs.length) {
    const msg = search || _soporteFilter !== 'all' || _soportePrioFilter !== 'all' ? 'Sin resultados' : 'Ningún usuario ha iniciado un chat todavía';
    listEl.innerHTML = `<div class="sc2-list-empty"><div class="sc2-list-empty-icon">💬</div><div class="sc2-list-empty-text">${msg}</div></div>`;
    return;
  }

  listEl.innerHTML = docs.map(d => buildConvItem(d.id, d.data())).join('');

  if (_soporteCurrentChat) {
    const active = listEl.querySelector(`[data-chat-id="${_soporteCurrentChat}"]`);
    if (active) active.classList.add('active');
  }
}

function buildConvItem(chatId, data) {
  const name     = esc(data.userName  || 'Usuario');
  const lastMsg  = esc((data.lastMessage || 'Sin mensajes').replace(/^\[Admin\] /, ''));
  const unread   = data.unreadAdmin || 0;
  const status   = data.status || 'waiting';
  const prio     = data.priority || 'low';
  const initial  = name.charAt(0).toUpperCase();
  const tags     = data.tags || [];

  let timeStr = '—';
  if (data.lastMessageAt) {
    const d    = data.lastMessageAt.toDate ? data.lastMessageAt.toDate() : new Date(data.lastMessageAt);
    const diff = Date.now() - d.getTime();
    if      (diff < 60000)    timeStr = 'Ahora';
    else if (diff < 3600000)  timeStr = Math.floor(diff / 60000) + 'm';
    else if (diff < 86400000) timeStr = Math.floor(diff / 3600000) + 'h';
    else timeStr = d.toLocaleDateString('es-DO', { day: '2-digit', month: 'short' });
  }

  const tagHtml = tags.slice(0,2).map(t => `<span class="sc2-topbar-tag" style="font-size:.55rem;padding:1px 5px">${esc(t)}</span>`).join('');

  const safeId = esc(chatId);
  return `<div class="sc2-conv-item" data-chat-id="${safeId}" onclick="window.openSoporteChat('${safeId}')">
    <div class="sc2-conv-avatar">${initial}</div>
    <div class="sc2-conv-body">
      <div class="sc2-conv-name">
        <span>${name}</span>
        ${tagHtml}
      </div>
      <div class="sc2-conv-preview">${lastMsg}</div>
    </div>
    <div class="sc2-conv-meta">
      <span class="sc2-conv-time">${timeStr}</span>
      <div style="display:flex;gap:4px;align-items:center">
        ${unread > 0 ? `<span class="sc2-conv-unread">${unread}</span>` : ''}
        <span class="sc2-conv-sdot" data-s="${esc(status)}"></span>
        <span class="sc2-prio-dot" data-p="${esc(prio)}"></span>
      </div>
    </div>
  </div>`;
}

window.setSoporteFilter = function (filter) {
  _soporteFilter = filter;
  document.querySelectorAll('.sc2-ftab').forEach(b => {
    b.classList.toggle('active', b.dataset.sf === filter);
  });
  if (_soporteSnap) renderSoporteList(_soporteSnap);
};

window.setSoportePrioFilter = function (pf) {
  _soportePrioFilter = pf;
  document.querySelectorAll('.sc2-pfil').forEach(b => {
    b.classList.toggle('active', b.dataset.pf === pf);
  });
  if (_soporteSnap) renderSoporteList(_soporteSnap);
};

window.filterSoporteChats = function () {
  if (_soporteSnap) renderSoporteList(_soporteSnap);
};

window.openSoporteChat = function (chatId) {
  _soporteCurrentChat = chatId;
  _currentMsgsData    = [];

  const emptyState = document.getElementById('soporteListWrap');
  const chatWrap   = document.getElementById('soporteChatWrap');
  if (emptyState) emptyState.style.display = 'none';
  if (chatWrap)   chatWrap.style.display = 'flex';

  // Hide AI panel and quick replies when switching chats
  const aiPanel = document.getElementById('sc2AiPanel');
  const qr      = document.getElementById('sc2QuickReplies');
  if (aiPanel) aiPanel.style.display = 'none';
  if (qr)      qr.style.display = 'none';

  document.querySelectorAll('.sc2-conv-item').forEach(el => {
    el.classList.toggle('active', el.dataset.chatId === chatId);
  });

  window.db.collection('supportChats').doc(chatId)
    .update({ unreadAdmin: 0 })
    .catch(() => {});

  // Start real-time doc listener (typing, tags, status updates)
  _startSoporteDocListener(chatId);

  // Messages subscription
  if (_unsubSoporteChat) { _unsubSoporteChat(); _unsubSoporteChat = null; }

  const msgsEl = document.getElementById('soporteMessages');
  if (msgsEl) msgsEl.innerHTML = '<div class="sc2-msg-empty"><div class="sc2-msg-empty-icon">⏳</div><div class="sc2-msg-empty-text">Cargando mensajes…</div></div>';

  _unsubSoporteChat = window.db
    .collection('supportChats').doc(chatId)
    .collection('messages')
    .orderBy('createdAt', 'asc')
    .onSnapshot(snap => {
      if (!msgsEl) return;
      _currentMsgsData = snap.docs.map(d => d.data());
      if (snap.empty) {
        msgsEl.innerHTML = '<div class="sc2-msg-empty"><div class="sc2-msg-empty-icon">💬</div><div class="sc2-msg-empty-text">Sin mensajes todavía</div></div>';
        return;
      }
      msgsEl.innerHTML = _currentMsgsData.map(buildAdminMsgBubble).join('');
      msgsEl.scrollTop = msgsEl.scrollHeight;
    }, err => {
      console.error('[admin] soporte messages:', err);
      if (msgsEl) msgsEl.innerHTML = '<div class="sc2-msg-empty"><div class="sc2-msg-empty-icon">⚠️</div><div class="sc2-msg-empty-text">Error al cargar mensajes</div></div>';
    });
};

function _startSoporteDocListener(chatId) {
  if (_unsubSoporteDoc) { _unsubSoporteDoc(); _unsubSoporteDoc = null; }

  _unsubSoporteDoc = window.db.collection('supportChats').doc(chatId)
    .onSnapshot(doc => {
      if (!doc.exists) return;
      const d = doc.data();

      // ── Topbar info ──
      const nameEl    = document.getElementById('scChatName');
      const emailEl   = document.getElementById('scChatEmail');
      const avatarEl  = document.getElementById('scChatAvatar');
      const toggleBtn = document.getElementById('scToggleStatusBtn');

      if (nameEl)   nameEl.textContent  = d.userName  || 'Usuario';
      if (emailEl)  emailEl.textContent = d.userEmail || '';
      if (avatarEl) avatarEl.textContent = (d.userName || 'U').charAt(0).toUpperCase();

      // ── Status badge ──
      const status    = d.status || 'waiting';
      const isClosed  = status === 'closed';
      const statusCfg = {
        open:    { label: '🟢 Abierto',    cls: 'sc2-tbtn--close' },
        waiting: { label: '⏳ Esperando',  cls: 'sc2-tbtn--close' },
        replied: { label: '🔵 Respondido', cls: 'sc2-tbtn--close' },
        closed:  { label: '⚫ Cerrado',    cls: 'sc2-tbtn--open'  },
      };
      const cfg = statusCfg[status] || statusCfg.waiting;

      const badge = document.getElementById('sc2ChatStatusBadge');
      if (badge) { badge.textContent = cfg.label; badge.dataset.s = status; }

      const ipChip = document.getElementById('sc2IpStatusChip');
      if (ipChip) { ipChip.textContent = cfg.label; ipChip.dataset.s = status; }

      if (toggleBtn) {
        toggleBtn.innerHTML = isClosed
          ? `<svg viewBox="0 0 24 24"><path d="M12 1C8.676 1 6 3.676 6 7v1H4c-1.103 0-2 .897-2 2v11c0 1.103.897 2 2 2h16c1.103 0 2-.897 2-2V10c0-1.103-.897-2-2-2h-2V7c0-3.324-2.676-6-6-6zm4 8H8V7c0-2.206 1.794-4 4-4s4 1.794 4 4v2zm-4 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg><span>Reabrir</span>`
          : `<svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg><span>Cerrar ticket</span>`;
        toggleBtn.dataset.closed = isClosed ? '1' : '0';
        toggleBtn.className = 'sc2-tbtn ' + cfg.cls;
      }

      // ── Typing indicator ──
      const typingBar = document.getElementById('sc2TypingBar');
      const typingLbl = document.getElementById('sc2TypingLabel');
      if (typingBar) {
        const isTyping = d.typingUser === true;
        typingBar.style.display = isTyping ? 'flex' : 'none';
        if (typingLbl) typingLbl.textContent = (d.userName || 'Usuario') + ' está escribiendo…';
      }

      // ── Tags ──
      _renderTagsUI(d.tags || []);

      // ── Wait time ──
      const waitEl = document.getElementById('sc2IpWait');
      if (waitEl && d.createdAt) {
        const created = d.createdAt.toDate ? d.createdAt.toDate() : new Date(d.createdAt);
        const mins    = Math.floor((Date.now() - created.getTime()) / 60000);
        waitEl.textContent = mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
      }

      // ── Priority ──
      const prio = d.priority || 'low';
      document.querySelectorAll('.sc2-prio-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.p === prio);
      });

      // ── Load extended user info (only on first load) ──
      if (!document.getElementById('sc2IpName')?.dataset.loaded) {
        _loadSoporteUserInfo(doc.id, d);
        const nm = document.getElementById('sc2IpName');
        if (nm) nm.dataset.loaded = '1';
      }
    }, err => { console.error('[admin] soporteDoc listener:', err); });
}

function _renderTagsUI(tags) {
  // Topbar tags
  const topbarTags = document.getElementById('sc2TopbarTags');
  if (topbarTags) {
    topbarTags.innerHTML = tags.map(t =>
      `<span class="sc2-topbar-tag">${esc(t)}</span>`
    ).join('');
  }
  // Info panel tags
  const tagsWrap = document.getElementById('sc2TagsWrap');
  if (tagsWrap) {
    tagsWrap.innerHTML = tags.map(t =>
      `<span class="sc2-tag-chip">${esc(t)}<button class="sc2-tag-remove" onclick="window.removeSoporteTag('${esc(t)}')" title="Eliminar">×</button></span>`
    ).join('');
  }
}

window.addSoporteTag = async function (tag) {
  if (!_soporteCurrentChat) return;
  try {
    await window.db.collection('supportChats').doc(_soporteCurrentChat)
      .update({ tags: firebase.firestore.FieldValue.arrayUnion(tag) });
  } catch (e) { toast('Error al agregar etiqueta', false); }
};

window.removeSoporteTag = async function (tag) {
  if (!_soporteCurrentChat) return;
  try {
    await window.db.collection('supportChats').doc(_soporteCurrentChat)
      .update({ tags: firebase.firestore.FieldValue.arrayRemove(tag) });
  } catch (e) { toast('Error al eliminar etiqueta', false); }
};

function _loadSoporteUserInfo(chatId, chatData) {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val || '—';
  };

  set('sc2IpAvatar',   (chatData.userName || 'U').charAt(0).toUpperCase());
  set('sc2IpName',     chatData.userName  || 'Usuario');
  set('sc2IpEmail',    chatData.userEmail || '—');
  set('sc2IpUid',      chatId);
  set('sc2IpLevel',    'Nv. —');
  set('sc2IpCoins',    '🪙 —');
  set('sc2IpGames',    '—');
  set('sc2IpCreated',  '—');
  set('sc2IpLastLogin','—');
  set('sc2IpCanjes',   '—');
  set('sc2IpApproved', '—');

  const uidEl = document.getElementById('sc2IpUid');
  if (uidEl) uidEl.title = chatId;

  window.db.collection('users').doc(chatId).get().then(doc => {
    if (!doc.exists) return;
    const u = doc.data();
    set('sc2IpLevel', 'Nv. ' + (u.level || 1));
    set('sc2IpCoins', '🪙 ' + ((u.points || 0).toLocaleString('es-DO')));
    set('sc2IpGames', (u.gamesPlayed || 0).toLocaleString('es-DO'));
    if (u.createdAt) {
      const d = u.createdAt.toDate ? u.createdAt.toDate() : new Date(u.createdAt);
      set('sc2IpCreated', d.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' }));
    }
    if (u.lastLogin) {
      const d = u.lastLogin.toDate ? u.lastLogin.toDate() : new Date(u.lastLogin);
      set('sc2IpLastLogin', d.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' }));
    }
  }).catch(() => {});

  window.db.collection('redeemRequests')
    .where('userId', '==', chatId)
    .get()
    .then(snap => {
      set('sc2IpCanjes', snap.size + (snap.size === 1 ? ' canje' : ' canjes'));
      const approved = snap.docs.filter(d => d.data().status === 'approved').length;
      set('sc2IpApproved', approved + ' aprobado' + (approved !== 1 ? 's' : ''));

      // Recent canjes activity list
      const recEl = document.getElementById('sc2RecentCanjes');
      if (!recEl) return;
      const recent = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const ta = a.createdAt?.toDate?.() || new Date(0);
          const tb = b.createdAt?.toDate?.() || new Date(0);
          return tb - ta;
        })
        .slice(0, 5);
      if (recent.length === 0) {
        recEl.innerHTML = '<div class="sc2-activity-empty">Sin actividad reciente</div>';
        return;
      }
      recEl.innerHTML = recent.map(r => {
        const statusColors = { approved: '#4ade80', rejected: '#f87171', pending: '#fbbf24' };
        const statusLabels = { approved: 'Aprobado', rejected: 'Rechazado', pending: 'Pendiente' };
        const color = statusColors[r.status] || '#60a5fa';
        const label = statusLabels[r.status] || r.status || '?';
        const dateStr = r.createdAt ? fmtDate(r.createdAt) : '—';
        return `<div class="sc2-activity-item">
          <div class="sc2-activity-dot" style="background:${color}"></div>
          <div class="sc2-activity-info">
            <div class="sc2-activity-name">${esc(r.itemName || r.productName || 'Canje')}</div>
            <div class="sc2-activity-date">${dateStr}</div>
          </div>
          <div class="sc2-activity-status" style="color:${color}">${label}</div>
        </div>`;
      }).join('');
    })
    .catch(() => {});
}

function buildAdminMsgBubble(data) {
  const isAdmin = data.from === 'admin';
  const name    = isAdmin
    ? (adminUser?.displayName || (adminUser?.email ? adminUser.email.split('@')[0] : '') || 'Admin')
    : esc(data.senderName || 'Usuario');
  const time    = fmtDate(data.createdAt);

  let bodyHtml;
  if (data.type === 'image' && data.imageUrl) {
    const safeUrl = esc(data.imageUrl);
    const caption = data.text ? `<div style="margin-top:6px;font-size:.82rem">${esc(data.text)}</div>` : '';
    bodyHtml = `<div class="sc2-bubble-body" style="padding:6px">
      <img src="${safeUrl}" class="sc2-bubble-img" alt="Imagen"
        onclick="window.open('${safeUrl}','_blank')" loading="lazy">${caption}
    </div>`;
  } else if (data.type === 'file' && data.fileUrl) {
    const ext  = (data.fileName || '').split('.').pop().toUpperCase() || 'FILE';
    const size = data.fileSize ? (data.fileSize / 1024 < 1024
      ? (data.fileSize / 1024).toFixed(1) + ' KB'
      : (data.fileSize / 1048576).toFixed(1) + ' MB') : '';
    bodyHtml = `<div class="sc2-bubble-body sc2-file-card" onclick="window.open('${esc(data.fileUrl)}','_blank')">
      <div class="sc2-file-icon">📎</div>
      <div class="sc2-file-meta">
        <div class="sc2-file-name">${esc(data.fileName || 'Archivo')}</div>
        <div class="sc2-file-size">${ext}${size ? ' · ' + size : ''}</div>
      </div>
      <div class="sc2-file-dl">⬇</div>
    </div>`;
  } else {
    bodyHtml = `<div class="sc2-bubble-body">${esc(data.text || '').replace(/\n/g, '<br>')}</div>`;
  }

  return `<div class="sc2-bubble ${isAdmin ? 'sc2-bubble--admin' : 'sc2-bubble--user'}">
    <div class="sc2-bubble-meta">
      <span class="sc2-bubble-sender">${name}</span>
      <span class="sc2-bubble-time">${time}</span>
    </div>
    ${bodyHtml}
  </div>`;
}

window.closeSoporteChat = function () {
  if (_unsubSoporteChat) { _unsubSoporteChat(); _unsubSoporteChat = null; }
  if (_unsubSoporteDoc)  { _unsubSoporteDoc();  _unsubSoporteDoc  = null; }
  if (_adminTypingTimer) { clearTimeout(_adminTypingTimer); _adminTypingTimer = null; }
  _soporteCurrentChat = null;
  _currentMsgsData    = [];

  const input = document.getElementById('soporteReplyInput');
  if (input) { input.value = ''; input.style.height = 'auto'; }

  const emptyState = document.getElementById('soporteListWrap');
  const chatWrap   = document.getElementById('soporteChatWrap');
  const infoPanel  = document.getElementById('sc2InfoPanel');
  if (emptyState) emptyState.style.display = '';
  if (chatWrap)   chatWrap.style.display = 'none';
  if (infoPanel)  { infoPanel.style.display = 'none'; _sc2InfoVisible = false; }

  const infoToggle = document.getElementById('sc2InfoToggle');
  if (infoToggle) infoToggle.classList.remove('active');

  document.querySelectorAll('.sc2-conv-item').forEach(el => el.classList.remove('active'));

  if (_soporteSnap) renderSoporteList(_soporteSnap);
};

window.toggleSoporteStatus = async function () {
  if (!_soporteCurrentChat) return;
  const btn       = document.getElementById('scToggleStatusBtn');
  const isClosed  = btn?.dataset.closed === '1';
  const newStatus = isClosed ? 'open' : 'closed';

  try {
    await window.db.collection('supportChats').doc(_soporteCurrentChat)
      .update({ status: newStatus });

    if (btn) {
      btn.innerHTML = newStatus === 'closed'
        ? `<svg viewBox="0 0 24 24"><path d="M12 1C8.676 1 6 3.676 6 7v1H4c-1.103 0-2 .897-2 2v11c0 1.103.897 2 2 2h16c1.103 0 2-.897 2-2V10c0-1.103-.897-2-2-2h-2V7c0-3.324-2.676-6-6-6zm4 8H8V7c0-2.206 1.794-4 4-4s4 1.794 4 4v2zm-4 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg><span>Reabrir</span>`
        : `<svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg><span>Cerrar ticket</span>`;
      btn.dataset.closed = newStatus === 'closed' ? '1' : '0';
      btn.className = 'sc2-tbtn ' + (newStatus === 'closed' ? 'sc2-tbtn--open' : 'sc2-tbtn--close');
    }
    toast(newStatus === 'closed' ? '🔒 Chat cerrado' : '🔓 Chat reabierto');
  } catch (e) {
    console.error('[admin] toggleSoporteStatus:', e);
    toast('Error al cambiar estado', false);
  }
};

window.toggleSoporteInfo = function () {
  const panel  = document.getElementById('sc2InfoPanel');
  const toggle = document.getElementById('sc2InfoToggle');
  if (!panel) return;
  _sc2InfoVisible = !_sc2InfoVisible;
  panel.style.display = _sc2InfoVisible ? 'flex' : 'none';
  if (toggle) toggle.classList.toggle('active', _sc2InfoVisible);
};

window.toggleSoporteQuickReplies = function () {
  const el = document.getElementById('sc2QuickReplies');
  if (el) el.style.display = el.style.display === 'none' ? 'flex' : 'none';
};

window.insertSoporteQuickReply = function (text) {
  const input = document.getElementById('soporteReplyInput');
  if (!input) return;
  input.value = text;
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 130) + 'px';
  input.focus();
  const qr = document.getElementById('sc2QuickReplies');
  if (qr) qr.style.display = 'none';
};

window.setSoportePriority = async function (priority) {
  if (!_soporteCurrentChat) return;
  try {
    await window.db.collection('supportChats').doc(_soporteCurrentChat)
      .update({ priority });
    document.querySelectorAll('.sc2-prio-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.p === priority);
    });
    toast('Prioridad actualizada');
  } catch (e) {
    console.error('[admin] setSoportePriority:', e);
    toast('Error al actualizar prioridad', false);
  }
};

window.sendAdminReply = async function () {
  const input = document.getElementById('soporteReplyInput');
  const text  = (input?.value || '').trim();
  if (!text || !_soporteCurrentChat) return;

  // Clear typing indicator
  if (_adminTypingTimer) { clearTimeout(_adminTypingTimer); _adminTypingTimer = null; }
  setAdminTyping(_soporteCurrentChat, false);

  const btn = document.querySelector('.sc2-send-btn');
  if (btn) btn.disabled = true;
  input.value = '';
  input.style.height = 'auto';

  try {
    const FS  = firebase.firestore.FieldValue;
    const now = FS.serverTimestamp();
    const batch = window.db.batch();

    const msgRef = window.db
      .collection('supportChats').doc(_soporteCurrentChat)
      .collection('messages').doc();
    batch.set(msgRef, {
      from:       'admin',
      text,
      type:       'text',
      senderName: adminUser?.displayName || adminUser?.email?.split('@')[0] || 'Soporte VirtualGift',
      createdAt:  now,
    });

    batch.update(window.db.collection('supportChats').doc(_soporteCurrentChat), {
      lastMessage:   '[Admin] ' + text.slice(0, 80),
      lastMessageAt: now,
      unreadUser:    FS.increment(1),
      status:        'replied',
      typingAdmin:   false,
    });

    await batch.commit();
  } catch (e) {
    console.error('[admin] sendAdminReply:', e);
    toast('Error al enviar respuesta', false);
  } finally {
    if (btn) btn.disabled = false;
    input?.focus();
  }
};

window.adminPickImage = function (fileInput) {
  const file = fileInput?.files?.[0];
  if (!file) return;
  fileInput.value = '';
  if (!_soporteCurrentChat) return;
  if (!file.type.startsWith('image/')) { toast('Solo se pueden subir imágenes', false); return; }
  if (file.size > 8 * 1024 * 1024) { toast('Imagen muy grande (máx. 8 MB)', false); return; }
  adminUploadImage(file);
};

async function adminUploadImage(file) {
  const msgsEl = document.getElementById('soporteMessages');
  const tmpId  = 'adminimg-' + Date.now();
  if (msgsEl) {
    msgsEl.insertAdjacentHTML('beforeend',
      `<div id="${tmpId}" class="sc2-upload-placeholder">
        <div class="spin-ring-sm"></div><span>Subiendo imagen…</span>
      </div>`
    );
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  const sendBtn = document.querySelector('.sc2-send-btn');
  if (sendBtn) sendBtn.disabled = true;

  try {
    const ext  = file.name.split('.').pop().toLowerCase() || 'jpg';
    const path = `supportChats/${_soporteCurrentChat}/admin_${Date.now()}.${ext}`;
    const snap = await firebase.storage().ref(path).put(file);
    const imageUrl = await snap.ref.getDownloadURL();

    const FS  = firebase.firestore.FieldValue;
    const now = FS.serverTimestamp();
    const batch = window.db.batch();

    const msgRef = window.db
      .collection('supportChats').doc(_soporteCurrentChat)
      .collection('messages').doc();
    batch.set(msgRef, {
      from:      'admin',
      type:      'image',
      imageUrl,
      text:      '',
      senderName: adminUser?.displayName || adminUser?.email?.split('@')[0] || 'Soporte VirtualGift',
      createdAt: now,
    });

    batch.update(window.db.collection('supportChats').doc(_soporteCurrentChat), {
      lastMessage:   '[Admin] 📷 Imagen',
      lastMessageAt: now,
      unreadUser:    FS.increment(1),
      status:        'open',
    });

    await batch.commit();
    toast('Imagen enviada ✅');
  } catch (e) {
    console.error('[admin] adminUploadImage:', e);
    toast('Error al enviar imagen', false);
  } finally {
    document.getElementById(tmpId)?.remove();
    if (sendBtn) sendBtn.disabled = false;
  }
}

// ── TYPING INDICATOR ─────────────────────────────
window._onAdminTyping = function () {
  if (!_soporteCurrentChat) return;
  setAdminTyping(_soporteCurrentChat, true);
  clearTimeout(_adminTypingTimer);
  _adminTypingTimer = setTimeout(() => {
    setAdminTyping(_soporteCurrentChat, false);
    _adminTypingTimer = null;
  }, 3000);
};

function setAdminTyping(chatId, typing) {
  if (!chatId) return;
  window.db.collection('supportChats').doc(chatId)
    .update({ typingAdmin: typing })
    .catch(() => {});
}

// ── FILE UPLOAD (all types) ───────────────────────
window.adminPickFile = function (fileInput) {
  const file = fileInput?.files?.[0];
  if (!file) return;
  fileInput.value = '';
  if (!_soporteCurrentChat) return;
  if (file.size > 16 * 1024 * 1024) { toast('Archivo muy grande (máx. 16 MB)', false); return; }
  if (file.type.startsWith('image/')) {
    adminUploadFile(file, 'image');
  } else {
    adminUploadFile(file, 'file');
  }
};

async function adminUploadFile(file, type) {
  const msgsEl = document.getElementById('soporteMessages');
  const tmpId  = 'adminfile-' + Date.now();
  if (msgsEl) {
    msgsEl.insertAdjacentHTML('beforeend',
      `<div id="${tmpId}" class="sc2-upload-placeholder">
        <div class="spin-ring-sm"></div><span>Subiendo ${type === 'image' ? 'imagen' : 'archivo'}…</span>
      </div>`
    );
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  const sendBtn = document.querySelector('.sc2-send-btn');
  if (sendBtn) sendBtn.disabled = true;

  try {
    const ext  = file.name.split('.').pop().toLowerCase() || 'bin';
    const path = `supportChats/${_soporteCurrentChat}/admin_${Date.now()}.${ext}`;
    const snap = await firebase.storage().ref(path).put(file);
    const url  = await snap.ref.getDownloadURL();

    const FS  = firebase.firestore.FieldValue;
    const now = FS.serverTimestamp();
    const batch = window.db.batch();

    const msgData = {
      from:      'admin',
      type,
      text:      '',
      senderName: adminUser?.displayName || adminUser?.email?.split('@')[0] || 'Soporte VirtualGift',
      createdAt: now,
    };
    if (type === 'image') {
      msgData.imageUrl = url;
    } else {
      msgData.fileUrl  = url;
      msgData.fileName = file.name;
      msgData.fileSize = file.size;
    }

    const msgRef = window.db
      .collection('supportChats').doc(_soporteCurrentChat)
      .collection('messages').doc();
    batch.set(msgRef, msgData);

    batch.update(window.db.collection('supportChats').doc(_soporteCurrentChat), {
      lastMessage:   type === 'image' ? '[Admin] 📷 Imagen' : '[Admin] 📎 ' + file.name.slice(0, 40),
      lastMessageAt: now,
      unreadUser:    FS.increment(1),
      status:        'replied',
    });

    await batch.commit();
    toast(type === 'image' ? 'Imagen enviada ✅' : 'Archivo enviado ✅');
  } catch (e) {
    console.error('[admin] adminUploadFile:', e);
    toast('Error al subir archivo', false);
  } finally {
    document.getElementById(tmpId)?.remove();
    if (sendBtn) sendBtn.disabled = false;
  }
}

// ── AI SUPPORT PANEL ──────────────────────────────
window.toggleSoporteAI = function () {
  const panel = document.getElementById('sc2AiPanel');
  if (!panel) return;
  const visible = panel.style.display !== 'none';
  panel.style.display = visible ? 'none' : 'flex';
  if (!visible) window.generateAISuggestions();
};

window.generateAISuggestions = function () {
  const topicEl  = document.getElementById('sc2AiTopic');
  const suggsEl  = document.getElementById('sc2AiSuggestions');
  if (!suggsEl) return;

  const result = _detectAITopic(_currentMsgsData);
  if (topicEl) topicEl.textContent = result.label;

  suggsEl.innerHTML = result.suggestions.map((s, i) =>
    `<div class="sc2-ai-suggestion" onclick="window._applyAISuggestion(${i})">${esc(s)}</div>`
  ).join('');
};

window._applyAISuggestion = function (idx) {
  const result = _detectAITopic(_currentMsgsData);
  const text   = result.suggestions[idx];
  if (!text) return;
  const input = document.getElementById('soporteReplyInput');
  if (!input) return;
  input.value = text;
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 130) + 'px';
  input.focus();
  const panel = document.getElementById('sc2AiPanel');
  if (panel) panel.style.display = 'none';
};

// ── QUICK ACTIONS ────────────────────────────────
window.soporteViewProfile = function () {
  if (!_soporteCurrentChat) return;
  window.switchTab('tabUsuarios');
  const input = document.getElementById('userSearch');
  if (input) {
    input.value = _soporteCurrentChat;
    window.searchUsers();
  }
};

window.soporteSendNotification = async function () {
  if (!_soporteCurrentChat) return;
  const msg = prompt('Mensaje de notificación para este usuario:');
  if (!msg?.trim()) return;
  try {
    await window.db.collection('notifications').add({
      userId:    _soporteCurrentChat,
      title:     '📢 Soporte VirtualGift',
      message:   msg.trim(),
      type:      'support',
      read:      false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    toast('Notificación enviada ✅');
  } catch (e) {
    console.error('[admin] soporteSendNotification:', e);
    toast('Error al enviar notificación', false);
  }
};

window.soporteSuspendUser = async function () {
  if (!_soporteCurrentChat) return;
  const nameEl = document.getElementById('sc2IpName');
  const name   = nameEl?.textContent || _soporteCurrentChat;
  if (!confirm(`¿Suspender a ${name}? Esto marcará su cuenta como suspendida.`)) return;
  try {
    await window.db.collection('users').doc(_soporteCurrentChat)
      .update({ suspended: true, suspendedAt: firebase.firestore.FieldValue.serverTimestamp() });
    toast('Usuario suspendido');
  } catch (e) {
    console.error('[admin] soporteSuspendUser:', e);
    toast('Error al suspender usuario', false);
  }
};

window.soporteBanUser = async function () {
  if (!_soporteCurrentChat) return;
  const nameEl = document.getElementById('sc2IpName');
  const name   = nameEl?.textContent || _soporteCurrentChat;
  const reason = prompt(`¿Razón para banear a ${name}?`);
  if (!reason?.trim()) return;
  if (!confirm(`¿Confirmar ban permanente para ${name}?`)) return;
  try {
    await window.db.collection('users').doc(_soporteCurrentChat)
      .update({
        banned:    true,
        bannedAt:  firebase.firestore.FieldValue.serverTimestamp(),
        banReason: reason.trim(),
      });
    toast('Usuario baneado');
  } catch (e) {
    console.error('[admin] soporteBanUser:', e);
    toast('Error al banear usuario', false);
  }
};

// ─────────────────────────────────────────────────
// AUTH GUARD
// ─────────────────────────────────────────────────
async function checkAdmin(user) {
  try {
    const doc = await window.db.collection('users').doc(user.uid).get();
    if (doc.data()?.isAdmin !== true) { showDenied(); return; }
    adminUser = user;

    // Mostrar nombre del admin en el header
    const nameEl = document.getElementById('headerAdminName');
    if (nameEl) {
      nameEl.textContent = user.displayName || user.email?.split('@')[0] || 'Admin';
      nameEl.style.display = 'block';
    }

    showAdmin();
    window.switchTab('tabDashboard');
    initNotifCounters();
    initSoporteListener(); // start badge tracking immediately
  } catch (e) {
    console.error('[admin] checkAdmin', e);
    showDenied();
  }
}

// ─────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────
window.addEventListener('load', () => {
  if (typeof window.withAppFlag !== 'function') window.withAppFlag = url => url;

  window.waitForFirebase(() => {
    firebase.auth().onAuthStateChanged(user => {
      if (!user) {
        window.location.href = typeof withAppFlag === 'function'
          ? withAppFlag('login.html') : 'login.html';
        return;
      }
      checkAdmin(user);
    });
  });
});
