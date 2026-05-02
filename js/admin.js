/* =================================================
   ADMIN.JS — VirtualGift Panel de Administración
   Guard: users/{uid}.isAdmin === true
   ================================================= */
'use strict';

// ─────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────
let adminUser     = null;
let canjeFilter   = 'pending';
let currentSorteo = null; // null = nuevo, {id,...} = editando

const PLATFORM_NAME = {
  paypal:     'PayPal',
  amazon:     'Amazon Gift Card',
  steam:      'Steam Wallet',
  googleplay: 'Google Play',
  psn:        'PlayStation',
};
const PLATFORM_ICON = {
  paypal: '💳', amazon: '📦', steam: '🎮', googleplay: '📱', psn: '🎮',
};
const STATUS_LABEL = {
  pending:   '⏳ Pendiente',
  completed: '✅ Completado',
  rejected:  '❌ Rechazado',
};
const IMAGE_OPTIONS = [
  { val: 'amazon.png',  label: 'Amazon'      },
  { val: 'psn.png',     label: 'PlayStation' },
  { val: 'google.png',  label: 'Google Play' },
  { val: 'steam.png',   label: 'Steam'       },
  { val: 'xbox.png',    label: 'Xbox'        },
  { val: 'paypal.png',  label: 'PayPal'      },
  { val: '',            label: '— Sin imagen —' },
];

// ─────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function fmtDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('es-DO', {
    day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'
  });
}
function toast(msg, ok = true) {
  const el = document.getElementById('adminToast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'admin-toast ' + (ok ? 'ok' : 'err') + ' show';
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3000);
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

// ─────────────────────────────────────────────────
// TABS
// ─────────────────────────────────────────────────
window.switchTab = function(id) {
  document.querySelectorAll('.admin-tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === id)
  );
  document.querySelectorAll('.admin-panel').forEach(p =>
    p.classList.toggle('active', p.id === id)
  );
  if (id === 'tabDashboard') loadDashboard();
  if (id === 'tabCanjes')    loadCanjes();
  if (id === 'tabSorteos')   loadSorteos();
  if (id === 'tabUsuarios')  resetUsersTab();
};

// ─────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const [usersSnap, pendingSnap, activeSnap] = await Promise.all([
      window.db.collection('users').get(),
      window.db.collection('redeemRequests').where('status','==','pending').get(),
      window.db.collection('raffles').where('endDate','>',new Date()).get(),
    ]);

    setStat('dashUsers',   usersSnap.size);
    setStat('dashPending', pendingSnap.size);
    setStat('dashSorteos', activeSnap.size);

    const badge = document.getElementById('canjeBadge');
    if (badge) {
      badge.textContent = pendingSnap.size;
      badge.style.display = pendingSnap.size > 0 ? 'inline-flex' : 'none';
    }

    const recentSnap = await window.db.collection('redeemRequests')
      .orderBy('createdAt','desc').limit(5).get();
    const list = document.getElementById('dashRecentList');
    if (list) {
      list.innerHTML = recentSnap.empty
        ? '<p class="admin-empty">Sin solicitudes aún</p>'
        : recentSnap.docs.map(d => buildRowMini(d.id, d.data())).join('');
    }
  } catch(e) {
    console.error('[admin] loadDashboard', e);
  }
}

function setStat(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = typeof val === 'number' ? val.toLocaleString() : val;
}

function buildRowMini(id, d) {
  const plat = PLATFORM_NAME[d.platform] || d.platform || '—';
  const s    = d.status || 'pending';
  const cls  = { pending:'warn', completed:'ok', rejected:'err' }[s] || 'warn';
  return `<div class="admin-row-mini">
    <div class="arm-info">
      <span class="arm-name">${esc(d.fullName||'—')}</span>
      <span class="arm-plat">${esc(plat)} · $${(d.usdAmount||0).toFixed(2)} USD</span>
    </div>
    <span class="admin-badge ${cls}">${STATUS_LABEL[s]||s}</span>
  </div>`;
}

// ─────────────────────────────────────────────────
// CANJES
// ─────────────────────────────────────────────────
window.loadCanjes = async function(filter) {
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
      q = window.db.collection('redeemRequests').orderBy('createdAt','desc').limit(50);
    } else {
      q = window.db.collection('redeemRequests')
        .where('status','==', canjeFilter)
        .orderBy('createdAt','desc')
        .limit(50);
    }
    const snap = await q.get();
    if (snap.empty) {
      list.innerHTML = '<p class="admin-empty">No hay solicitudes en esta categoría</p>';
    } else {
      list.innerHTML = snap.docs.map(d => buildCanjeCard(d.id, d.data())).join('');
    }
  } catch(e) {
    console.error('[admin] loadCanjes', e);
    list.innerHTML = '<p class="admin-empty">Error al cargar. Verifica los índices de Firestore.</p>';
  }
};

function buildCanjeCard(id, d) {
  const plat     = PLATFORM_NAME[d.platform] || d.platform || '—';
  const icon     = PLATFORM_ICON[d.platform] || '💳';
  const status   = d.status || 'pending';
  const scls     = { pending:'warn', completed:'ok', rejected:'err' }[status] || 'warn';
  const actions  = status === 'pending' ? `
    <div class="canje-actions">
      <button class="btn-canje-ok"  onclick="updateCanjeStatus('${id}','completed')">✓ Marcar completado</button>
      <button class="btn-canje-err" onclick="updateCanjeStatus('${id}','rejected')">✗ Rechazar</button>
    </div>` : '';
  const extraDate = d.completedAt
    ? `<div class="canje-row"><span>Completado</span><strong>${fmtDate(d.completedAt)}</strong></div>` : '';

  return `<div class="canje-card" id="canje-${id}">
    <div class="canje-card-head">
      <span class="canje-plat-icon">${icon}</span>
      <div class="canje-head-info">
        <span class="canje-name">${esc(d.fullName||'—')}</span>
        <span class="canje-plat">${esc(plat)}</span>
      </div>
      <span class="admin-badge ${scls}">${STATUS_LABEL[status]||status}</span>
    </div>
    <div class="canje-card-body">
      <div class="canje-row"><span>Correo</span><strong>${esc(d.account||'—')}</strong></div>
      <div class="canje-row"><span>Coins</span><strong>${(d.pointsAmount||0).toLocaleString()} 🪙</strong></div>
      <div class="canje-row"><span>Monto</span><strong>$${(d.usdAmount||0).toFixed(2)} USD</strong></div>
      <div class="canje-row"><span>Solicitado</span><strong>${fmtDate(d.createdAt)}</strong></div>
      ${extraDate}
    </div>
    ${actions}
  </div>`;
}

window.updateCanjeStatus = async function(id, status) {
  try {
    const upd = { status, adminId: adminUser.uid };
    if (status === 'completed') upd.completedAt = firebase.firestore.Timestamp.now();
    if (status === 'rejected')  upd.rejectedAt  = firebase.firestore.Timestamp.now();

    await window.db.collection('redeemRequests').doc(id).update(upd);

    // Notificar al usuario
    const docSnap = await window.db.collection('redeemRequests').doc(id).get();
    const d = docSnap.data();
    if (d?.userId) {
      const plat = PLATFORM_NAME[d.platform] || d.platform || '';
      const body = status === 'completed'
        ? `¡Tu canje de $${(d.usdAmount||0).toFixed(2)} USD en ${plat} fue procesado! Revisa tu correo ${d.account}.`
        : `Tu solicitud de canje de $${(d.usdAmount||0).toFixed(2)} USD fue rechazada. Contáctanos para más info.`;
      await window.db.collection('notifications').add({
        userId:    d.userId,
        title:     status === 'completed' ? '🎉 Canje completado' : '❌ Canje rechazado',
        body,
        type:      'canje',
        read:      false,
        createdAt: firebase.firestore.Timestamp.now(),
      });
    }

    toast(status === 'completed' ? '✅ Marcado como completado' : '❌ Solicitud rechazada');
    window.loadCanjes();
    loadDashboard();
  } catch(e) {
    console.error('[admin] updateCanjeStatus', e);
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
    const snap = await window.db.collection('raffles')
      .orderBy('endDate','desc').limit(30).get();
    if (snap.empty) {
      list.innerHTML = '<p class="admin-empty">No hay sorteos creados aún</p>';
      return;
    }
    const now = Date.now();
    list.innerHTML = snap.docs.map(d => {
      const r   = d.data();
      const end = r.endDate?.toDate ? r.endDate.toDate() : new Date(r.endDate);
      return buildSorteoRow(d.id, r, end > now, end);
    }).join('');
  } catch(e) {
    console.error('[admin] loadSorteos', e);
    list.innerHTML = '<p class="admin-empty">Error al cargar</p>';
  }
}

function buildSorteoRow(id, r, active, end) {
  const endStr = end.toLocaleDateString('es-DO', {
    day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'
  });
  const idSafe = esc(id);
  return `<div class="sorteo-row">
    <div class="sorteo-row-info">
      <span class="sorteo-row-dot" style="background:${r.color||'#8b5cf6'}"></span>
      <div style="min-width:0">
        <span class="sorteo-row-title">${esc(r.title)} ${esc(r.value)}</span>
        <span class="sorteo-row-meta">${(r.participants||0).toLocaleString()} participantes · ${endStr}</span>
      </div>
    </div>
    <div class="sorteo-row-actions">
      <span class="admin-badge ${active?'ok':'muted'}">${active?'Activo':'Terminado'}</span>
      <button class="btn-icon" onclick="editSorteo('${idSafe}')" title="Editar">✏️</button>
      <button class="btn-icon btn-del" onclick="deleteSorteo('${idSafe}')" title="Eliminar">🗑️</button>
    </div>
  </div>`;
}

window.newSorteo = function() {
  currentSorteo = null;
  resetSorteoForm();
  document.getElementById('sorteoFormTitle').textContent = 'Nuevo Sorteo';
  document.getElementById('sorteoFormWrap').style.display = 'block';
  document.getElementById('sorteoListWrap').style.display = 'none';
};

window.editSorteo = async function(id) {
  try {
    const doc = await window.db.collection('raffles').doc(id).get();
    if (!doc.exists) { toast('Sorteo no encontrado', false); return; }
    currentSorteo = { id, ...doc.data() };
    fillSorteoForm(currentSorteo);
    document.getElementById('sorteoFormTitle').textContent = 'Editar Sorteo';
    document.getElementById('sorteoFormWrap').style.display = 'block';
    document.getElementById('sorteoListWrap').style.display = 'none';
  } catch(e) {
    toast('Error al cargar sorteo', false);
  }
};

window.cancelSorteoForm = function() {
  document.getElementById('sorteoFormWrap').style.display = 'none';
  document.getElementById('sorteoListWrap').style.display = 'block';
  currentSorteo = null;
};

function fillSorteoForm(r) {
  const set = (id, v) => { const el = document.getElementById(id); if(el) el.value = v || ''; };
  set('sfTitle',    r.title);
  set('sfValue',    r.value);
  set('sfCost',     r.cost);
  set('sfMaxPart',  r.maxParticipants);
  set('sfColor',    r.color    || '#8b5cf6');
  set('sfColorDark',r.colorDark|| '#6d28d9');
  set('sfImage',    r.image    || '');
  set('sfTag',      r.tag      || '');
  set('sfTagColor', r.tagColor || '#f59e0b');
  if (r.endDate) {
    const d = r.endDate.toDate ? r.endDate.toDate() : new Date(r.endDate);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,16);
    set('sfEndDate', local);
  }
}

function resetSorteoForm() {
  ['sfTitle','sfValue','sfCost','sfMaxPart','sfTag','sfEndDate'].forEach(id => {
    const el = document.getElementById(id); if(el) el.value = '';
  });
  const set = (id, v) => { const el = document.getElementById(id); if(el) el.value = v; };
  set('sfColor',    '#8b5cf6');
  set('sfColorDark','#6d28d9');
  set('sfImage',    '');
  set('sfTagColor', '#f59e0b');
}

window.saveSorteo = async function() {
  const gv  = id => document.getElementById(id)?.value.trim();
  const title    = gv('sfTitle');
  const value    = gv('sfValue');
  const cost     = parseInt(gv('sfCost'), 10);
  const maxPart  = parseInt(gv('sfMaxPart'), 10);
  const color    = gv('sfColor')    || '#8b5cf6';
  const colorDark= gv('sfColorDark')|| '#6d28d9';
  const image    = gv('sfImage');
  const tag      = gv('sfTag');
  const tagColor = gv('sfTagColor') || '#f59e0b';
  const endDateV = gv('sfEndDate');

  if (!title || !value || !cost || !maxPart || !endDateV) {
    toast('Completa todos los campos obligatorios', false); return;
  }

  const endDate = firebase.firestore.Timestamp.fromDate(new Date(endDateV));
  const data = {
    title, value, cost, maxParticipants: maxPart,
    color, colorDark, endDate,
    ...(image    && { image }),
    ...(tag      && { tag, tagColor }),
  };

  const btn = document.getElementById('btnSaveSorteo');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

  try {
    if (currentSorteo?.id) {
      await window.db.collection('raffles').doc(currentSorteo.id).update(data);
      toast('✅ Sorteo actualizado');
    } else {
      data.participants = 0;
      data.createdAt = firebase.firestore.Timestamp.now();
      await window.db.collection('raffles').add(data);
      toast('✅ Sorteo creado');
    }
    window.cancelSorteoForm();
    loadSorteos();
  } catch(e) {
    console.error('[admin] saveSorteo', e);
    toast('Error al guardar', false);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar sorteo'; }
  }
};

window.deleteSorteo = async function(id) {
  if (!confirm('¿Eliminar este sorteo permanentemente? Esta acción no se puede deshacer.')) return;
  try {
    await window.db.collection('raffles').doc(id).delete();
    toast('Sorteo eliminado');
    loadSorteos();
  } catch(e) {
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
  if (list) list.innerHTML = '<p class="admin-empty">Busca por correo electrónico</p>';
}

window.searchUsers = async function() {
  const query = document.getElementById('userSearchInput')?.value.trim().toLowerCase();
  const list  = document.getElementById('userList');
  if (!list) return;
  if (!query) { resetUsersTab(); return; }

  list.innerHTML = '<div class="admin-loading">Buscando...</div>';
  try {
    const snap = await window.db.collection('users')
      .where('email', '>=', query)
      .where('email', '<=', query + '')
      .limit(15).get();

    if (snap.empty) {
      list.innerHTML = '<p class="admin-empty">No se encontraron usuarios con ese correo</p>';
      return;
    }
    list.innerHTML = snap.docs.map(d => buildUserRow({ id: d.id, ...d.data() })).join('');
  } catch(e) {
    console.error('[admin] searchUsers', e);
    list.innerHTML = '<p class="admin-empty">Error al buscar. El campo email debe estar en Firestore.</p>';
  }
};

function buildUserRow(u) {
  const initials = (u.displayName || u.email || '?').slice(0,2).toUpperCase();
  return `<div class="user-row">
    <div class="user-avatar">${initials}</div>
    <div class="user-info">
      <span class="user-name">${esc(u.displayName||'Sin nombre')}</span>
      <span class="user-email">${esc(u.email||'—')}</span>
    </div>
    <div class="user-stats">
      <span class="user-coins">${(u.points||0).toLocaleString()} 🪙</span>
      ${u.isAdmin ? '<span class="admin-badge ok">Admin</span>' : ''}
    </div>
  </div>`;
}

// ─────────────────────────────────────────────────
// AUTH GUARD
// ─────────────────────────────────────────────────
async function checkAdmin(user) {
  try {
    const doc  = await window.db.collection('users').doc(user.uid).get();
    if (doc.data()?.isAdmin !== true) { showDenied(); return; }
    adminUser = user;
    showAdmin();
    window.switchTab('tabDashboard');
  } catch(e) {
    console.error('[admin] checkAdmin', e);
    showDenied();
  }
}

// ─────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────
window.addEventListener('load', () => {
  // withAppFlag fallback
  if (typeof window.withAppFlag !== 'function') {
    window.withAppFlag = url => url;
  }

  window.waitForFirebase(() => {
    firebase.auth().onAuthStateChanged(user => {
      if (!user) {
        window.location.href = typeof withAppFlag === 'function'
          ? withAppFlag('index.html') : 'index.html';
        return;
      }
      checkAdmin(user);
    });
  });
});
