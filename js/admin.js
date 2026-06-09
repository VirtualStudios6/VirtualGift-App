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
