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
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayTs    = firebase.firestore.Timestamp.fromDate(todayStart);

    const [usersSnap, pendingSnap, activeSnap, completedSnap, newsSnap, activeTodaySnap, ticketsSnap] = await Promise.all([
      window.db.collection('users').get(),
      window.db.collection('redeemRequests').where('status', '==', 'pending').get(),
      window.db.collection('raffles').where('endDate', '>', new Date()).get(),
      window.db.collection('redeemRequests').where('status', '==', 'completed').get(),
      window.db.collection('news').get(),
      window.db.collection('users').where('lastLogin', '>=', todayTs).get(),
      window.db.collection('supportChats').where('status', 'in', ['open', 'waiting', 'replied']).get(),
    ]);

    setStat('dashUsers',       usersSnap.size);
    setStat('dashActiveToday', activeTodaySnap.size);
    setStat('dashPending',     pendingSnap.size);
    setStat('dashSorteos',     activeSnap.size);
    setStat('dashCompleted',   completedSnap.size);
    setStat('dashNews',        newsSnap.size);
    setStat('dashTickets',     ticketsSnap.size);

    // USD pagado
    let totalUsd = 0;
    completedSnap.forEach(d => { totalUsd += (d.data().usdAmount || 0); });
    setStat('dashUsdPaid', '$' + totalUsd.toFixed(2));

    // Pending alert dot on KPI card
    const alertDot = document.getElementById('kpiPendingDot');
    if (alertDot) alertDot.style.display = pendingSnap.size > 0 ? 'block' : 'none';

    // Update admin avatar initial
    const avatarEl = document.getElementById('adminAvatarEl');
    if (avatarEl && adminUser) {
      const name = adminUser.displayName || adminUser.email || 'A';
      avatarEl.textContent = name.charAt(0).toUpperCase();
    }

    // Canje badges (header + sidebar)
    ['canjeBadge', 'canjeBadgeSidebar'].forEach(id => {
      const badge = document.getElementById(id);
      if (badge) {
        badge.textContent = pendingSnap.size;
        badge.style.display = pendingSnap.size > 0 ? 'inline-flex' : 'none';
      }
    });

    // Recent activity
    const recentSnap = await window.db.collection('redeemRequests')
      .orderBy('createdAt', 'desc').limit(6).get();
    const list = document.getElementById('dashRecentList');
    if (list) {
      list.innerHTML = recentSnap.empty
        ? '<p class="admin-empty" style="padding:20px 18px">Sin solicitudes aún</p>'
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
  return `<div class="admin-row-mini" id="arm-${id}">
    ${platIcon}
    <div class="arm-info">
      <span class="arm-name">${esc(d.fullName || '—')}</span>
      <span class="arm-plat">${esc(plat)} · $${(d.usdAmount || 0).toFixed(2)} USD</span>
    </div>
    <span class="admin-badge ${cls}">${STATUS_LABEL[s] || s}</span>
    <button type="button" class="arm-del-btn" onclick="deleteRecentItem('${id}')" title="Eliminar">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
    </button>
  </div>`;
}

window.deleteRecentItem = async function(id) {
  try {
    await window.db.collection('redeemRequests').doc(id).delete();
    const el = document.getElementById('arm-' + id);
    if (el) el.remove();
    toast('Eliminado');
  } catch (e) {
    console.error('[admin] deleteRecentItem', e);
    toast('Error al eliminar', false);
  }
};

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
  const actions = status === 'pending'
    ? `<div class="canje-actions">
        <button type="button" class="btn-canje-ok"  onclick="updateCanjeStatus('${id}','completed')">✓ Completar</button>
        <button type="button" class="btn-canje-err" onclick="updateCanjeStatus('${id}','rejected')">✗ Rechazar</button>
       </div>`
    : `<div class="canje-actions">
        ${status === 'rejected' ? `<button type="button" class="btn-canje-ok" onclick="forceCanjeStatus('${id}','completed')">✓ Marcar completado</button>` : ''}
        ${status === 'completed' ? `<button type="button" class="btn-canje-err" onclick="forceCanjeStatus('${id}','rejected')">✗ Marcar rechazado</button>` : ''}
        <button type="button" class="btn-canje-muted" onclick="forceCanjeStatus('${id}','pending')">↩ Mover a pendiente</button>
       </div>`;
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

window.forceCanjeStatus = async function (id, status) {
  const labels = { completed: '✅ Marcado como completado', rejected: '❌ Marcado como rechazado', pending: '⏳ Movido a pendiente' };
  try {
    const FS = firebase.firestore.FieldValue;
    const update = { status, updatedAt: FS.serverTimestamp() };
    if (status === 'completed') update.completedAt = FS.serverTimestamp();
    await window.db.collection('redeemRequests').doc(id).update(update);
    toast(labels[status] || 'Estado actualizado');
    window.loadCanjes();
    loadDashboard();
  } catch (e) {
    console.error('[admin] forceCanjeStatus', e);
    toast('Error al actualizar', false);
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
// NOTIFICATION CENTER (NC)
// ─────────────────────────────────────────────────
var _ncSegment    = 'all';
var _ncTotalUsers = 0;
var _ncHistAll    = [];
var _ncHistFilter = 'all';
var _ncEmojiTarget = 'notifBody';

var NC_SEGMENTS = [
  { id: 'all',        icon: '🌎', label: 'Todos',            sub: 'Todos los usuarios registrados' },
  { id: 'active',     icon: '🟢', label: 'Activos',          sub: 'Activos en los últimos 7 días' },
  { id: 'inactive',   icon: '🟡', label: 'Inactivos',        sub: 'Sin actividad en +30 días' },
  { id: 'coins',      icon: '💰', label: 'Con monedas',      sub: 'Tienen coins disponibles' },
  { id: 'level',      icon: '🏆', label: 'Por nivel',        sub: 'Nivel 5 o superior' },
  { id: 'canjes',     icon: '🎁', label: 'Han canjeado',     sub: 'Al menos 1 canje completado' },
  { id: 'sorteos',    icon: '🎟️', label: 'En sorteos',       sub: 'Participan en sorteos activos' },
  { id: 'individual', icon: '👤', label: 'Individual',       sub: 'Usuario específico por UID' },
];

var NC_TEMPLATES = [
  { id: 'double',   icon: '🎉', label: '2× puntos',        title: '🎉 ¡Doble puntos activado!',          body: 'Hola {username}, gana el doble de coins en todos los juegos hoy. ¡No te lo pierdas!' },
  { id: 'prize',    icon: '🎁', label: 'Nuevo premio',     title: '🎁 ¡Nuevo premio disponible!',         body: 'Tienes {coins} coins esperándote. Canjéalos por increíbles recompensas ahora.' },
  { id: 'raffle',   icon: '🏆', label: 'Nuevo sorteo',     title: '🏆 ¡Nuevo sorteo disponible!',         body: '¡Participa y gana grandes premios! Tus tickets están listos. ¿A qué esperas?' },
  { id: 'canje_ok', icon: '✅', label: 'Canje aprobado',   title: '✅ Tu canje fue aprobado',              body: 'Hola {username}, tu solicitud ha sido procesada. El pago está en camino. ¡Gracias!' },
  { id: 'maint',    icon: '🔧', label: 'Mantenimiento',    title: '🔧 Mantenimiento programado',          body: 'El servicio estará temporalmente no disponible. Regresa en unos minutos. ¡Gracias!' },
  { id: 'update',   icon: '🚀', label: 'Actualización',    title: '🚀 ¡Nueva actualización disponible!',  body: 'Hemos mejorado la app. Actualiza ahora y disfruta de las nuevas funciones y mejoras. 🎮' },
  { id: 'event',    icon: '🎊', label: 'Evento especial',  title: '🎊 ¡Evento especial activo hoy!',      body: '¡No te pierdas las recompensas exclusivas de hoy! Accede ahora y aprovecha. ⭐' },
  { id: 'expiry',   icon: '⚠️', label: 'Coins por vencer', title: '⚠️ Tus coins están por vencer',        body: 'Tienes {coins} coins que vencen pronto. ¡Canjéalos antes de que expiren!' },
];

var NC_EMOJIS = ['🎉','🎁','🏆','💰','🔔','⭐','🚀','🎊','💎','🎮','🎯','🔥','✨','💫','🌟','👑','🎀','🎲','✅','❤️','🙌','👏','😊','🤩','😎','🎈','📢','🆕'];

async function loadNotificaciones() {
  _ncInitGrid();
  _ncInitTemplates();
  _ncInitEmojis();
  _ncUpdateClock();
  ncUpdatePreview();
  await Promise.all([_ncLoadStats(), _ncLoadHistory()]);
}

function _ncInitGrid() {
  const grid = document.getElementById('ncSegGrid');
  if (!grid || grid.dataset.built) return;
  grid.dataset.built = '1';
  grid.innerHTML = NC_SEGMENTS.map(s =>
    `<div class="nc-seg${s.id === 'all' ? ' active' : ''}" onclick="ncSetSegment('${s.id}',this)" data-seg="${s.id}">
      <span class="nc-seg-icon">${s.icon}</span>
      <span><span class="nc-seg-label">${s.label}</span><span class="nc-seg-sub">${s.sub}</span></span>
    </div>`
  ).join('');
}

function _ncInitTemplates() {
  const wrap = document.getElementById('ncTplWrap');
  if (!wrap || wrap.dataset.built) return;
  wrap.dataset.built = '1';
  wrap.innerHTML = NC_TEMPLATES.map(t =>
    `<button class="nc-tpl" onclick="ncApplyTemplate('${t.id}')">${t.icon} ${t.label}</button>`
  ).join('');
}

function _ncInitEmojis() {
  const grid = document.getElementById('ncEmojiGrid');
  if (!grid || grid.dataset.built) return;
  grid.dataset.built = '1';
  grid.innerHTML = NC_EMOJIS.map(e =>
    `<span class="nc-emoji" onclick="ncInsertEmoji('${e}')">${e}</span>`
  ).join('');
}

function _ncUpdateClock() {
  const t = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  ['ncAndTime', 'ncIphTime'].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = t;
  });
  setTimeout(_ncUpdateClock, 30000);
}

async function _ncLoadStats() {
  try {
    const [notifSnap, usersSnap] = await Promise.all([
      window.db.collection('globalNotifications').get(),
      window.db.collection('users').limit(2000).get(),
    ]);
    _ncTotalUsers = usersSnap.size;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let todayCount = 0, lastSentAt = null;
    notifSnap.forEach(doc => {
      const d = doc.data();
      if (d.sentAt) {
        const dt = d.sentAt.toDate ? d.sentAt.toDate() : new Date(d.sentAt);
        if (dt >= today) todayCount++;
        if (!lastSentAt || dt > lastSentAt) lastSentAt = dt;
      }
    });
    const setEl = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    setEl('ncKpiToday', todayCount);
    setEl('ncKpiTodaySub', todayCount === 0 ? 'Sin envíos hoy' : `${todayCount} notificación${todayCount > 1 ? 'es' : ''}`);
    setEl('ncKpiTotal', notifSnap.size);
    setEl('ncKpiReach', _ncTotalUsers);
    if (lastSentAt) {
      const diff = Math.floor((Date.now() - lastSentAt.getTime()) / 60000);
      setEl('ncKpiLast', diff < 60 ? `${diff}m` : diff < 1440 ? `${Math.floor(diff / 60)}h` : `${Math.floor(diff / 1440)}d`);
      setEl('ncKpiLastSub', lastSentAt.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }));
    } else {
      setEl('ncKpiLast', '—'); setEl('ncKpiLastSub', 'Sin envíos aún');
    }
    _ncUpdateImpact();
  } catch (e) { console.error('[admin] _ncLoadStats', e); }
}

async function _ncLoadHistory() {
  const list = document.getElementById('ncHistList');
  if (!list) return;
  list.innerHTML = '<div class="admin-loading">Cargando...</div>';
  try {
    const snap = await window.db.collection('globalNotifications')
      .orderBy('sentAt', 'desc').limit(40).get();
    _ncHistAll = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    _ncRenderHistory();
    const badge = document.getElementById('ncHistBadge');
    if (badge) badge.textContent = _ncHistAll.length;
  } catch (e) {
    console.error('[admin] _ncLoadHistory', e);
    list.innerHTML = '<p class="admin-empty">Error al cargar historial</p>';
  }
}

function _ncRenderHistory() {
  const list = document.getElementById('ncHistList');
  if (!list) return;
  let items = _ncHistAll;
  if (_ncHistFilter === 'global')     items = items.filter(i => i.segment !== 'individual');
  if (_ncHistFilter === 'individual') items = items.filter(i => i.segment === 'individual');
  if (!items.length) {
    list.innerHTML = '<p class="admin-empty">Sin envíos en este filtro</p>';
    return;
  }
  list.innerHTML = items.map(_ncBuildHistItem).join('');
}

function _ncBuildHistItem(d) {
  const emoji    = (d.title || '').match(/\p{Emoji}/u)?.[0] || '🔔';
  const segMap   = { all: 'Todos', individual: 'Individual', active: 'Activos', inactive: 'Inactivos', coins: 'Con monedas', level: 'Por nivel', canjes: 'Han canjeado', sorteos: 'En sorteos' };
  const segLabel = d.segmentLabel || segMap[d.segment] || 'Todos';
  const dateStr  = d.sentAt ? fmtDate(d.sentAt) : '—';
  return `<div class="nc-hist-item" id="nc-hi-${d.id}">
    <div class="nc-hist-top">
      <div class="nc-hist-ico">${emoji}</div>
      <div class="nc-hist-info">
        <div class="nc-hist-title">${esc(d.title || '—')}</div>
        <div class="nc-hist-body">${esc(d.body || '')}</div>
      </div>
      <span class="nc-hist-badge ok">✓ Enviada</span>
    </div>
    <div class="nc-hist-meta">
      <span class="nc-hist-meta-tag">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        ${esc(dateStr)}
      </span>
      <span class="nc-hist-meta-tag">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        ${esc(segLabel)}
      </span>
      <span class="nc-hist-spacer"></span>
      <span class="nc-hist-btns">
        <button class="nc-hist-btn" onclick="ncResend('${d.id}')">↩ Reenviar</button>
        <button class="nc-hist-btn del" onclick="ncDeleteHist('${d.id}')">🗑</button>
      </span>
    </div>
  </div>`;
}

function _ncUpdateImpact() {
  let reach = _ncTotalUsers || '—', openRate = '78%', clickRate = '42%', relevance = '⭐⭐⭐';
  switch (_ncSegment) {
    case 'active':     reach = Math.round((_ncTotalUsers || 0) * 0.35) || '~35%'; relevance = '⭐⭐⭐⭐'; openRate = '88%'; clickRate = '55%'; break;
    case 'inactive':   reach = Math.round((_ncTotalUsers || 0) * 0.25) || '~25%'; relevance = '⭐⭐⭐⭐'; openRate = '62%'; clickRate = '28%'; break;
    case 'coins':      relevance = '⭐⭐⭐⭐⭐'; openRate = '91%'; clickRate = '68%'; break;
    case 'level':      relevance = '⭐⭐⭐⭐';   openRate = '85%'; clickRate = '50%'; break;
    case 'canjes':     relevance = '⭐⭐⭐⭐⭐'; openRate = '93%'; clickRate = '72%'; break;
    case 'sorteos':    relevance = '⭐⭐⭐⭐⭐'; openRate = '95%'; clickRate = '80%'; break;
    case 'individual': reach = 1; openRate = '100%'; clickRate = '—'; relevance = '👤'; break;
  }
  const setEl = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  setEl('ncImpactReach', reach); setEl('ncImpactOpen', openRate);
  setEl('ncImpactClick', clickRate); setEl('ncImpactRel', relevance);
  const reachBar = document.getElementById('ncReachNum');
  if (reachBar) reachBar.textContent = reach === 1 ? '1 usuario' : `${reach} usuario${typeof reach === 'number' && reach !== 1 ? 's' : 's'}`;
}

window.ncFilterHist = function (filter, btn) {
  _ncHistFilter = filter;
  document.querySelectorAll('[data-nhfilter]').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  _ncRenderHistory();
};

window.ncSetSegment = function (id, el) {
  _ncSegment = id;
  document.querySelectorAll('.nc-seg').forEach(s => s.classList.remove('active'));
  if (el) el.classList.add('active');
  const row = document.getElementById('ncIndividualRow');
  if (row) row.classList.toggle('visible', id === 'individual');
  _ncUpdateImpact();
};

window.ncApplyTemplate = function (id) {
  const tpl = NC_TEMPLATES.find(t => t.id === id);
  if (!tpl) return;
  const titleEl = document.getElementById('notifTitle');
  const bodyEl  = document.getElementById('notifBody');
  if (titleEl) { titleEl.value = tpl.title; ncUpdateCounter(titleEl, 'notifTitleCount', 60); }
  if (bodyEl)  { bodyEl.value  = tpl.body;  ncUpdateCounter(bodyEl, 'notifBodyCount', 160); }
  ncUpdatePreview();
  const badge = document.getElementById('ncModeBadge');
  if (badge) badge.textContent = 'Plantilla';
};

window.ncInsert = function (fieldId, text) {
  const el = document.getElementById(fieldId);
  if (!el) return;
  const s = el.selectionStart, e = el.selectionEnd;
  el.value = el.value.slice(0, s) + text + el.value.slice(e);
  el.selectionStart = el.selectionEnd = s + text.length;
  el.dispatchEvent(new Event('input'));
  el.focus();
};

window.ncToggleEmojiPicker = function (target) {
  _ncEmojiTarget = target === 'title' ? 'notifTitle' : 'notifBody';
  const picker = document.getElementById('ncEmojiPicker');
  if (picker) picker.style.display = picker.style.display === 'none' ? 'block' : 'none';
};

window.ncInsertEmoji = function (emoji) {
  ncInsert(_ncEmojiTarget, emoji);
  const picker = document.getElementById('ncEmojiPicker');
  if (picker) picker.style.display = 'none';
};

window.ncUpdateCounter = function (el, countId, max) {
  const count = document.getElementById(countId);
  if (!count) return;
  const len = (el.value || '').length;
  count.textContent = `${len}/${max}`;
  count.classList.toggle('warn', len >= Math.floor(max * 0.9));
};

window.ncUpdatePreview = function () {
  const raw = id => _ncSubstituteVars(document.getElementById(id)?.value || '');
  const title  = raw('notifTitle') || 'Tu notificación';
  const body   = raw('notifBody')  || 'El mensaje aparecerá aquí';
  const imgUrl = document.getElementById('notifImage')?.value.trim() || '';
  const valid  = imgUrl.startsWith('http');

  [['ncPrevTitle','ncPrevBody','ncPrevImg','ncPrevImgEl'],
   ['ncPrevTitleIph','ncPrevBodyIph','ncPrevImgIph','ncPrevImgElIph']].forEach(([tId,bId,wId,iId]) => {
    const t = document.getElementById(tId); if (t) t.textContent = title;
    const b = document.getElementById(bId); if (b) b.textContent = body;
    const w = document.getElementById(wId); if (w) w.classList.toggle('visible', valid);
    const i = document.getElementById(iId); if (i && valid) i.src = imgUrl;
  });
  const ta = document.getElementById('ncPrevTitleApp'); if (ta) ta.textContent = title;
  const ba = document.getElementById('ncPrevBodyApp');  if (ba) ba.textContent = body;
  const wa = document.getElementById('ncPrevImgApp');   if (wa) wa.classList.toggle('visible', valid);
  const ia = document.getElementById('ncPrevImgElApp'); if (ia && valid) ia.src = imgUrl;

  const appIco = document.getElementById('ncAppIco');
  if (appIco) appIco.textContent = (title.match(/\p{Emoji}/u) || [])[0] || '🔔';

  const imgPrev  = document.getElementById('ncImgPrev');
  const imgPrevI = document.getElementById('ncImgPrevImg');
  if (imgPrev) imgPrev.classList.toggle('visible', valid);
  if (imgPrevI && valid) imgPrevI.src = imgUrl;
};

function _ncSubstituteVars(text) {
  return text
    .replace(/\{username\}/g, 'Carlos')
    .replace(/\{coins\}/g, '1,250')
    .replace(/\{level\}/g, '12')
    .replace(/\{reward\}/g, 'Gift Card $10');
}

window.ncSwitchDevice = function (type, btn) {
  document.getElementById('ncPreviewAndroid').style.display = type === 'android' ? '' : 'none';
  document.getElementById('ncPreviewIphone').style.display  = type === 'iphone'  ? '' : 'none';
  document.getElementById('ncPreviewApp').style.display     = type === 'app'     ? 'block' : 'none';
  document.querySelectorAll('.nc-dev-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
};

window.ncClearForm = function () {
  ['notifTitle', 'notifBody', 'notifImage'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  ncUpdateCounter({ value: '' }, 'notifTitleCount', 60);
  ncUpdateCounter({ value: '' }, 'notifBodyCount', 160);
  ncUpdatePreview();
  const badge = document.getElementById('ncModeBadge');
  if (badge) badge.textContent = 'Nueva';
};

window.ncSend = async function () {
  const title    = document.getElementById('notifTitle')?.value.trim();
  const body     = document.getElementById('notifBody')?.value.trim();
  const imageUrl = document.getElementById('notifImage')?.value.trim();
  if (!title || !body) { toast('Título y mensaje son obligatorios', false); return; }

  const btn = document.getElementById('btnSendNotif');
  const lbl = document.getElementById('btnSendNotifLabel');
  if (btn) btn.disabled = true;
  if (lbl) lbl.textContent = 'Enviando…';

  try {
    const now = firebase.firestore.Timestamp.now();
    const segObj = NC_SEGMENTS.find(s => s.id === _ncSegment);
    const segmentLabel = segObj ? segObj.label : 'Todos';

    if (_ncSegment === 'individual') {
      const uid = document.getElementById('ncIndividualId')?.value.trim();
      if (!uid) { toast('Ingresa el UID del usuario', false); return; }
      await window.db.collection('notifications').add({
        userId: uid, title, message: body,
        ...(imageUrl && { imageUrl }),
        type: 'admin_notification', sentByAdmin: true, read: false, timestamp: now,
      });
    } else {
      await window.db.collection('notifications').add({
        userId: 'ALL', title, message: body,
        ...(imageUrl && { imageUrl }),
        type: 'admin_notification', sentByAdmin: true, read: false, timestamp: now,
      });
    }

    await window.db.collection('globalNotifications').add({
      title, body, ...(imageUrl && { imageUrl }),
      segment: _ncSegment, segmentLabel,
      type: 'notification', sentAt: now,
      sentBy: adminUser?.uid || 'admin',
    });

    toast('✅ Notificación enviada exitosamente');
    ncClearForm();
    _ncLoadHistory();
    _ncLoadStats();
  } catch (e) {
    console.error('[admin] ncSend', e);
    toast('Error al enviar: ' + (e.message || ''), false);
  } finally {
    if (btn) btn.disabled = false;
    if (lbl) lbl.textContent = '📤 Enviar notificación';
  }
};

window.ncDeleteHist = async function (id) {
  if (!confirm('¿Eliminar este registro del historial?')) return;
  try {
    await window.db.collection('globalNotifications').doc(id).delete();
    _ncHistAll = _ncHistAll.filter(i => i.id !== id);
    const el = document.getElementById('nc-hi-' + id);
    if (el) el.remove();
    const badge = document.getElementById('ncHistBadge');
    if (badge) badge.textContent = _ncHistAll.length;
    toast('Eliminado del historial');
  } catch (e) { toast('Error al eliminar', false); }
};

window.ncResend = function (id) {
  const item = _ncHistAll.find(i => i.id === id);
  if (!item) return;
  const titleEl = document.getElementById('notifTitle');
  const bodyEl  = document.getElementById('notifBody');
  const imgEl   = document.getElementById('notifImage');
  if (titleEl) { titleEl.value = item.title || ''; ncUpdateCounter(titleEl, 'notifTitleCount', 60); }
  if (bodyEl)  { bodyEl.value  = item.body  || ''; ncUpdateCounter(bodyEl,  'notifBodyCount',  160); }
  if (imgEl)   imgEl.value = item.imageUrl || '';
  ncUpdatePreview();
  const badge = document.getElementById('ncModeBadge');
  if (badge) badge.textContent = 'Reenvío';
  document.getElementById('notifTitle')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  toast('Formulario cargado — revisa y envía');
};

// Kept as no-op — counters now handled inline via oninput in HTML
function initNotifCounters() {}
// Legacy aliases
window.clearNotifForm  = window.ncClearForm;
window.sendNotificacion = window.ncSend;

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
let _scPhotoCache        = {};
let _sc2InfoVisible      = false;
let _adminTypingTimer    = null;
let _currentMsgsData     = [];

// AI suggestion templates keyed by detected topic
const _AI_TOPICS = {
  canje: {
    label: '🎁 Canje',
    kw: ['canje','canjear','regalo','card','tarjeta','google play','amazon','steam','robux','paypal','redeem','código','code','gift','voucher','premio','recompensa','premios','retirar','retiro','canjeo'],
    suggestions: [
      { cat: 'Verificar',     text: 'Para revisar tu solicitud de canje necesito confirmar algunos datos. ¿Puedes indicarme el correo de tu cuenta y la plataforma que seleccionaste ([plataforma])?' },
      { cat: 'En proceso',    text: 'Tu solicitud de canje está siendo procesada por nuestro equipo. El tiempo promedio es de 24-48 horas hábiles. Te avisaremos cuando esté listo 👍' },
      { cat: 'Aprobado ✅',   text: '¡Buenas noticias! Tu canje ha sido aprobado y procesado exitosamente. Recibirás tu recompensa en [plataforma] en las próximas horas. ¡Gracias por usar VirtualGift!' },
      { cat: 'Pendiente',     text: 'Revisé tu cuenta y tu solicitud aparece como pendiente de revisión. Nuestro equipo la procesará en las próximas horas. Gracias por tu paciencia 🙏' },
      { cat: 'Rechazado',     text: 'Lamentablemente tu solicitud no pudo completarse. Por favor verifica que cumples el mínimo requerido y que tus datos de perfil estén actualizados, luego vuelve a intentarlo.' },
      { cat: 'Pedir captura', text: '¿Puedes compartirme una captura de pantalla de la solicitud? Eso nos ayuda a ubicar el caso más rápido en el sistema.' },
    ],
  },
  pago: {
    label: '💳 Pago',
    kw: ['pago','cobro','dinero','transferencia','nequi','binance','recibir','no he recibido','no llegó','donde está','cuándo llega','cuando llega','withdraw','retirar','acreditar','acreditado'],
    suggestions: [
      { cat: 'Solicitar info', text: '¿Puedes indicarme el ID de tu solicitud y el correo o cuenta destino que tienes registrado? Así verifico el estado del pago directamente.' },
      { cat: 'En tránsito',   text: 'El pago fue procesado desde nuestro lado. Los tiempos de acreditación varían: [plataforma] puede demorar 1-3 días hábiles. ¿Revisaste también tu carpeta de spam?' },
      { cat: 'Confirmado',    text: 'Confirmo que el pago fue enviado exitosamente a tu cuenta de [plataforma]. Si no lo ves reflejado aún, contacta el soporte de esa plataforma con tu ID de transacción.' },
      { cat: 'Revisar datos', text: 'Los datos de pago ingresados no coinciden con tu perfil. Por favor actualízalos y vuelve a intentar, o cuéntame más para corregirlo juntos.' },
    ],
  },
  puntos: {
    label: '🪙 VirtualCoins',
    kw: ['puntos','coins','monedas','saldo','balance','créditos','creditos','points','ganar','gané','no me acreditan','no llegaron','perdí mis','me faltan','me quitaron','acreditación','recompensa diaria','check-in','checkin'],
    suggestions: [
      { cat: 'Revisando',      text: 'Estoy revisando el historial de tu cuenta ahora mismo. ¿Puedes decirme qué actividad realizaste y en qué fecha aproximadamente para localizarlo más rápido?' },
      { cat: 'Acreditados',    text: 'Revisé tu historial y los VirtualCoins aparecen acreditados correctamente. Puedes verificarlo en "Mis Puntos" dentro de la app. ¿Ves alguna diferencia con lo esperado?' },
      { cat: 'Retraso',        text: 'Identificamos un pequeño retraso en la acreditación. Los coins deberían aparecer en tu cuenta en las próximas horas. Disculpa el inconveniente 🙏' },
      { cat: 'Ajuste manual',  text: 'Revisé el caso y corresponde hacer un ajuste manual en tu saldo. Ya estamos procesando la corrección y verás los coins reflejados en breve.' },
    ],
  },
  cuenta: {
    label: '👤 Cuenta',
    kw: ['cuenta','acceso','login','contraseña','password','entrar','acceder','email','correo','olvidé','recuperar','bloqueado','suspendido','perfil','foto','nombre','verificación','verificado','no puedo entrar','inicio de sesión'],
    suggestions: [
      { cat: 'Recuperar acceso',  text: '¿Intentaste la opción "¿Olvidaste tu contraseña?" en la pantalla de inicio? Te enviará un correo para restablecerla. También revisa tu carpeta de spam 📧' },
      { cat: 'Verificar',         text: 'Para ayudarte a recuperar el acceso necesito verificar algunos datos. ¿Cuál es el correo con el que te registraste y cuándo fue aproximadamente?' },
      { cat: 'Cuenta suspendida', text: 'Revisé tu cuenta y aparece suspendida temporalmente por actividad inusual. Si crees que es un error cuéntame más detalles y lo revisamos con el equipo.' },
      { cat: 'Todo en orden',     text: 'Revisé tu cuenta y todo parece estar bien desde nuestro lado. Te recomiendo: borrar caché de la app, cerrar sesión y volver a ingresar. ¿Se resolvió el problema?' },
    ],
  },
  error: {
    label: '⚙️ Error técnico',
    kw: ['error','bug','falla','problema','no funciona','no carga','pantalla','app','aplicación','crash','cerrar','congelar','lento','tarda','blanco','negro','roto','fallo','se cierra','no abre'],
    suggestions: [
      { cat: 'Recopilar info', text: '¿Puedes describir con detalle qué ocurre y en qué paso? Una captura del error sería de gran ayuda. También dime tu dispositivo y versión del sistema operativo.' },
      { cat: 'Pasos básicos',  text: 'Prueba estos pasos: 1️⃣ Cierra y vuelve a abrir la app. 2️⃣ Verifica tu conexión. 3️⃣ Borra el caché de la app. ¿El problema persiste después de eso?' },
      { cat: 'Escalado',       text: 'Registré el error que describes y lo escalé a nuestro equipo técnico con prioridad. Te notificamos cuando tengamos solución. ¡Gracias por reportarlo, nos ayuda mucho! 🛠️' },
      { cat: 'Actualizar app', text: 'Es posible que el error se resuelva actualizando a la última versión de VirtualGift. ¿Tienes la versión más reciente instalada?' },
    ],
  },
  sorteo: {
    label: '🎟️ Sorteo',
    kw: ['sorteo','rifa','lotería','participar','ticket','boleto','ganador','resultado','sortear','no me registré','participación','raffle'],
    suggestions: [
      { cat: 'Cómo participar',  text: 'Para participar en los sorteos necesitas VirtualCoins y canjearlos por tickets en la sección de sorteos activos. ¿Tienes algún problema al intentar registrarte?' },
      { cat: 'Verificar tickets', text: 'Revisé tu cuenta y tienes participaciones registradas en el sorteo activo. Los resultados se publican en la app automáticamente al cerrarse el período.' },
      { cat: 'Sobre resultados',  text: 'Los ganadores son seleccionados aleatoriamente de forma transparente entre todos los participantes registrados. ¿Tienes alguna pregunta específica sobre el resultado?' },
    ],
  },
};

function _detectAITopics(msgs) {
  const text = msgs.filter(m => m.from === 'user').map(m => (m.text || '').toLowerCase()).join(' ');
  const PLATFORMS = { paypal: 'PayPal', amazon: 'Amazon', steam: 'Steam', 'google play': 'Google Play', psn: 'PSN', robux: 'Robux', nequi: 'Nequi', binance: 'Binance' };
  let platform = '';
  for (const [kw, label] of Object.entries(PLATFORMS)) {
    if (text.includes(kw)) { platform = label; break; }
  }
  const topics = Object.values(_AI_TOPICS).filter(d => d.kw.some(kw => text.includes(kw)));
  return { topics, platform };
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
  let total = 0;
  snap.forEach(() => total++);
  const el = document.getElementById('sc2MetTotal');
  if (el) el.textContent = total;
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

  const safeId      = esc(chatId);
  const cachedPhoto = _scPhotoCache[chatId];
  const avatarContent = cachedPhoto
    ? `<img src="${esc(cachedPhoto)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block" loading="lazy" onerror="this.parentElement.textContent='${initial}'">`
    : initial;
  return `<div class="sc2-conv-item" data-chat-id="${safeId}" onclick="window.openSoporteChat('${safeId}')">
    <div class="sc2-conv-avatar">${avatarContent}</div>
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

  let _soporteMsgPrevCount = 0;

  _unsubSoporteChat = window.db
    .collection('supportChats').doc(chatId)
    .collection('messages')
    .orderBy('createdAt', 'asc')
    .onSnapshot(snap => {
      if (!msgsEl) return;
      const isFirstLoad = _soporteMsgPrevCount === 0;
      const hasNew      = snap.size > _soporteMsgPrevCount;
      _soporteMsgPrevCount = snap.size;
      _currentMsgsData = snap.docs.map(d => d.data());
      if (snap.empty) {
        msgsEl.innerHTML = '<div class="sc2-msg-empty"><div class="sc2-msg-empty-icon">💬</div><div class="sc2-msg-empty-text">Sin mensajes todavía</div></div>';
        return;
      }
      msgsEl.innerHTML = _currentMsgsData.map(buildAdminMsgBubble).join('');
      msgsEl.scrollTop = msgsEl.scrollHeight;
      // Ping when a new user message arrives (not on initial load)
      if (!isFirstLoad && hasNew) {
        const last = _currentMsgsData[_currentMsgsData.length - 1];
        if (last && last.from !== 'admin' && window.VGSounds) VGSounds.adminPing();
      }
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

    // Show real profile photo if available
    if (u.photoURL) {
      _scPhotoCache[chatId] = u.photoURL;
      const initial = (chatData.userName || 'U').charAt(0).toUpperCase();
      const imgHtml = `<img src="${esc(u.photoURL)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block" onerror="this.parentElement.textContent='${initial}'" loading="lazy">`;
      const ipAv = document.getElementById('sc2IpAvatar');
      if (ipAv) ipAv.innerHTML = imgHtml;
      const topAv = document.getElementById('scChatAvatar');
      if (topAv) topAv.innerHTML = imgHtml;
      // Also update the avatar in the conversation list
      const listAv = document.querySelector(`.sc2-conv-item[data-chat-id="${chatId}"] .sc2-conv-avatar`);
      if (listAv) listAv.innerHTML = imgHtml;
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
        const statusLabels = { approved: '✓', rejected: '✗', pending: '…' };
        const color = statusColors[r.status] || '#60a5fa';
        const label = statusLabels[r.status] || '?';
        const dateStr = r.createdAt ? fmtDate(r.createdAt) : '—';
        return `<div class="sc2-activity-item" style="padding:4px 0;gap:6px">
          <div class="sc2-activity-dot" style="background:${color};flex-shrink:0"></div>
          <div class="sc2-activity-info" style="min-width:0">
            <div class="sc2-activity-name" style="font-size:.75rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.itemName || r.productName || 'Canje')}</div>
          </div>
          <div style="display:flex;align-items:center;gap:4px;flex-shrink:0">
            <span style="font-size:.68rem;color:#6b7280">${dateStr}</span>
            <span style="font-size:.72rem;font-weight:700;color:${color}">${label}</span>
          </div>
        </div>`;
      }).join('');
    })
    .catch(() => {});
}

window.giveSoporteCoins = async function () {
  const amountRaw = document.getElementById('sc2GiveCoinsAmount')?.value;
  const amount    = parseInt(amountRaw);
  if (!amount || amount < 1 || amount > 50000) {
    toast('Ingresa una cantidad válida (1 – 50,000)', false); return;
  }
  if (!_soporteCurrentChat) { toast('Ningún usuario seleccionado', false); return; }
  const uid = _soporteCurrentChat;
  try {
    await window.db.collection('users').doc(uid).update({
      points: firebase.firestore.FieldValue.increment(amount),
    });
    await window.db.collection('notifications').add({
      userId:      uid,
      title:       '🎁 Bonus de VirtualCoins',
      message:     `Has recibido ${amount.toLocaleString('es-DO')} VirtualCoins de regalo del equipo de soporte.`,
      type:        'bonus',
      sentByAdmin: true,
      read:        false,
      timestamp:   firebase.firestore.Timestamp.now(),
    });
    toast(`✅ +${amount.toLocaleString('es-DO')} coins enviados`);
    document.getElementById('sc2GiveCoinsAmount').value = '';
    // Refresh coins display in the info panel
    window.db.collection('users').doc(uid).get().then(doc => {
      if (doc.exists) {
        const el = document.getElementById('sc2IpCoins');
        if (el) el.textContent = '🪙 ' + (doc.data().points || 0).toLocaleString('es-DO');
      }
    });
  } catch (e) {
    console.error('[admin] giveSoporteCoins', e);
    toast('Error: ' + (e.message || ''), false);
  }
};

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
        onclick="window.adminOpenLightbox('${safeUrl}')" loading="lazy">${caption}
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

    toast(newStatus === 'closed' ? '🔒 Chat cerrado' : '🔓 Chat reabierto');

    if (newStatus === 'closed') {
      window.closeSoporteChat();
      window.setSoporteFilter('closed');
    }
  } catch (e) {
    console.error('[admin] toggleSoporteStatus:', e);
    toast('Error al cambiar estado', false);
  }
};

window.deleteSoporteChat = async function () {
  if (!_soporteCurrentChat) return;
  const nameEl = document.getElementById('sc2IpName');
  const name   = nameEl?.textContent?.trim() || 'este usuario';
  if (!confirm(`¿Eliminar permanentemente el chat de ${name}?\n\nEsta acción no se puede deshacer.`)) return;

  const chatId = _soporteCurrentChat;
  try {
    const msgSnap = await window.db
      .collection('supportChats').doc(chatId)
      .collection('messages').limit(500).get();

    if (!msgSnap.empty) {
      const batch = window.db.batch();
      msgSnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    await window.db.collection('supportChats').doc(chatId).delete();
    window.closeSoporteChat();
    toast('Chat eliminado');
  } catch (e) {
    console.error('[admin] deleteSoporteChat:', e);
    toast('Error al eliminar chat', false);
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

    // Notify user in their notification bell
    window.db.collection('notifications').add({
      userId:    _soporteCurrentChat,
      title:     '💬 Soporte VirtualGift te respondió',
      message:   text.length > 100 ? text.slice(0, 97) + '…' : text,
      type:      'support_reply',
      link:      'chat.html',
      read:      false,
      timestamp: FS.serverTimestamp(),
    }).catch(() => {});

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

    // Notify user
    window.db.collection('notifications').add({
      userId:    _soporteCurrentChat,
      title:     '💬 Soporte VirtualGift te respondió',
      message:   type === 'image' ? 'Te enviaron una imagen' : 'Te enviaron un archivo: ' + file.name.slice(0, 50),
      type:      'support_reply',
      link:      'chat.html',
      read:      false,
      timestamp: FS.serverTimestamp(),
    }).catch(() => {});

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
  const suggsEl = document.getElementById('sc2AiSuggestions');
  const topicEl = document.getElementById('sc2AiTopic');
  const genBtn  = document.getElementById('sc2AiGenBtn');
  if (!suggsEl) return;

  suggsEl.innerHTML = '<div class="sc2-ai-loading"><div class="sc2-ai-spinner"></div><span>Analizando conversación…</span></div>';
  if (topicEl) topicEl.textContent = '';
  if (genBtn) { genBtn.disabled = true; genBtn.classList.add('loading'); }

  setTimeout(() => {
    const { topics, platform } = _detectAITopics(_currentMsgsData);
    let allSuggs = [];
    let labels   = [];

    if (!topics.length) {
      labels = ['💬 General'];
      allSuggs = [
        { cat: 'Bienvenida', text: '¡Hola! Soy del equipo de soporte de VirtualGift. Estoy revisando tu consulta y te respondo en breve. ¡Gracias por tu paciencia!' },
        { cat: 'Más info',   text: 'Para ayudarte mejor necesito algunos datos. ¿Puedes darme más detalles sobre lo que ocurre y en qué sección de la app?' },
        { cat: 'Registrado', text: 'Tu caso ha sido registrado y será atendido lo antes posible. ¿Hay algo más que puedas compartirme para agilizar la resolución?' },
        { cat: 'Disculpa',   text: 'Lamentamos los inconvenientes que estás experimentando. Estamos revisando tu caso con prioridad y te daremos una respuesta lo antes posible 🙏' },
      ];
    } else {
      labels = topics.slice(0, 3).map(d => d.label);
      topics.slice(0, 2).forEach(d => allSuggs.push(...d.suggestions.slice(0, 3)));
    }

    allSuggs = allSuggs.map(s => ({
      ...s,
      text: s.text.replace(/\[plataforma\]/g, platform || 'la plataforma elegida'),
    }));

    window._aiLastSuggs = allSuggs;
    if (topicEl) topicEl.textContent = labels.join(' · ');

    suggsEl.innerHTML = allSuggs.map((s, i) =>
      `<div class="sc2-ai-sugg" onclick="window._applyAISugg(${i})">` +
        `<span class="sc2-ai-cat">${esc(s.cat)}</span>` +
        `<span class="sc2-ai-sugg-text">${esc(s.text)}</span>` +
        `<button class="sc2-ai-use-btn" onclick="event.stopPropagation();window._applyAISugg(${i})">Usar</button>` +
      `</div>`
    ).join('');

    if (genBtn) {
      genBtn.disabled = false;
      genBtn.classList.remove('loading');
      genBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg> Regenerar';
    }
  }, 650);
};

window._applyAISugg = function (idx) {
  const sugg = (window._aiLastSuggs || [])[idx];
  if (!sugg) return;
  const input = document.getElementById('soporteReplyInput');
  if (!input) return;
  input.value = sugg.text;
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
// IMAGE LIGHTBOX
// ─────────────────────────────────────────────────
window.adminOpenLightbox = function (url) {
  const lb  = document.getElementById('adminLightbox');
  const img = document.getElementById('adminLightboxImg');
  if (!lb || !img) return;
  img.src = url;
  lb.classList.add('visible');
};

window.adminCloseLightbox = function () {
  const lb  = document.getElementById('adminLightbox');
  const img = document.getElementById('adminLightboxImg');
  if (!lb) return;
  lb.classList.remove('visible');
  if (img) img.src = '';
};

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') window.adminCloseLightbox();
});

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
