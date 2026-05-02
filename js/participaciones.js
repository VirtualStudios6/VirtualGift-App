// ══════════════════════════════════════════════════════
//  PARTICIPACIONES.JS — VirtualGift
//  Muestra todos los sorteos en los que ha participado
//  el usuario actual, agrupados por raffle.
// ══════════════════════════════════════════════════════

let currentUser = null;

// ── Utils ──

function imgPath(filename) {
  return `images/giftcards/${filename}`;
}

function guessImage(title) {
  const t = (title || '').toLowerCase();
  if (t.includes('amazon'))                            return 'amazon.png';
  if (t.includes('playstation') || t.includes('psn')) return 'psn.png';
  if (t.includes('google') || t.includes('play'))     return 'google.png';
  if (t.includes('steam'))                             return 'steam.png';
  if (t.includes('xbox'))                              return 'xbox.png';
  if (t.includes('paypal'))                            return 'paypal.png';
  return null;
}

function formatTimeLeft(endDate) {
  const diff = endDate - Date.now();
  if (diff <= 0) return 'Finalizado';
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Carga de datos ──

async function loadParticipaciones() {
  const list = document.getElementById('partList');
  const sub  = document.getElementById('partSubtitle');

  try {
    const snap = await window.db.collection('raffleParticipants')
      .where('userId', '==', currentUser.uid)
      .limit(100)
      .get();

    if (snap.empty) {
      if (sub) sub.textContent = 'Sin participaciones aún';
      list.innerHTML = `<div class="part-empty">
        <span class="part-empty-icon">🎁</span>
        <p>Aún no has participado en ningún sorteo.</p>
      </div>
      <div id="partDiscoverSection"></div>`;
      loadActiveRaffles();
      return;
    }

    // Agrupar por raffleId
    const grouped = {};
    snap.docs.forEach(doc => {
      const d = doc.data();
      if (!grouped[d.raffleId]) grouped[d.raffleId] = { raffleId: d.raffleId, count: 0 };
      grouped[d.raffleId].count++;
    });

    // Obtener datos de cada raffle desde Firestore
    const ids = Object.keys(grouped);
    const raffleDocs = await Promise.all(
      ids.map(id => window.db.collection('raffles').doc(id).get())
    );

    const raffleMap = {};
    raffleDocs.forEach(s => {
      if (!s.exists) return;
      const data = s.data();
      raffleMap[s.id] = {
        id: s.id,
        ...data,
        endDate: data.endDate?.toDate ? data.endDate.toDate() : new Date(data.endDate),
        image: data.image || guessImage(data.title),
      };
    });

    // Ordenar: activos primero, luego por fecha de cierre desc
    const entries = ids.map(id => ({ g: grouped[id], raffle: raffleMap[id] || null }));
    entries.sort((a, b) => {
      const aEnd = a.raffle?.endDate?.getTime?.() || 0;
      const bEnd = b.raffle?.endDate?.getTime?.() || 0;
      const aExpired = aEnd < Date.now();
      const bExpired = bEnd < Date.now();
      if (aExpired !== bExpired) return aExpired ? 1 : -1;
      return bEnd - aEnd;
    });

    const activeCount = entries.filter(e => e.raffle && e.raffle.endDate > Date.now()).length;
    if (sub) {
      sub.textContent = activeCount > 0
        ? `${activeCount} sorteo${activeCount !== 1 ? 's' : ''} activo${activeCount !== 1 ? 's' : ''} · ${entries.length} total`
        : `${entries.length} participación${entries.length !== 1 ? 'es' : ''} registrada${entries.length !== 1 ? 's' : ''}`;
    }

    list.innerHTML = entries.map(({ g, raffle }) => buildCard(g, raffle)).join('');

  } catch (e) {
    console.error('[participaciones]', e);
    list.innerHTML = `<div class="part-empty"><p>Error al cargar. Intenta de nuevo.</p></div>`;
  }
}

// ── Render card ──

function buildCard(g, raffle) {
  const title   = raffle ? esc(`${raffle.title} ${raffle.value}`) : 'Sorteo';
  const color   = raffle?.color || '#8b5cf6';
  const expired = raffle ? (raffle.endDate < Date.now()) : false;
  const imgHTML = raffle?.image
    ? `<img class="part-card-img" src="${imgPath(raffle.image)}" alt="">`
    : `<span class="part-card-emoji">🎁</span>`;
  const statusHTML = expired
    ? `<span class="part-status done">⏰ Finalizado</span>`
    : `<span class="part-status active">⏱ Termina en ${formatTimeLeft(raffle.endDate)}</span>`;

  return `<div class="part-card" style="--cc:${color}">
    <div class="part-card-img-wrap">${imgHTML}</div>
    <div class="part-card-body">
      <span class="part-card-title">${title}</span>
      ${statusHTML}
    </div>
    <div class="part-card-badge">
      <span class="part-card-badge-n">${g.count}</span>
      <span class="part-card-badge-l">ENTR.</span>
    </div>
  </div>`;
}

// ── Sorteos activos (estado vacío) ──

async function loadActiveRaffles() {
  const section = document.getElementById('partDiscoverSection');
  if (!section) return;

  try {
    const snap = await window.db.collection('raffles')
      .where('endDate', '>', new Date())
      .orderBy('endDate', 'asc')
      .limit(6)
      .get();

    if (snap.empty) {
      section.innerHTML = `<div class="part-empty-cta">
        <p>No hay sorteos activos en este momento.<br>¡Vuelve pronto!</p>
      </div>`;
      return;
    }

    const items = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        endDate: data.endDate?.toDate ? data.endDate.toDate() : new Date(data.endDate),
        image: data.image || guessImage(data.title),
      };
    });

    section.innerHTML = `
      <p class="part-discover-title">Sorteos disponibles</p>
      ${items.map(r => buildDiscoverCard(r)).join('')}
      <button type="button" class="part-btn" style="margin:8px 0 24px"
        onclick="window.location.href=(typeof withAppFlag==='function'?withAppFlag('sorteos.html'):'sorteos.html')">
        Ver todos los sorteos
      </button>`;
  } catch (e) {
    console.error('[participaciones] loadActiveRaffles', e);
  }
}

function buildDiscoverCard(r) {
  const color  = r.color || '#8b5cf6';
  const imgHTML = r.image
    ? `<img class="part-card-img" src="${imgPath(r.image)}" alt="">`
    : `<span class="part-card-emoji">🎁</span>`;
  const title = esc(`${r.title} ${r.value}`);

  return `<div class="part-card part-card-discover" style="--cc:${color}"
    onclick="window.location.href=(typeof withAppFlag==='function'?withAppFlag('sorteos.html'):'sorteos.html')">
    <div class="part-card-img-wrap">${imgHTML}</div>
    <div class="part-card-body">
      <span class="part-card-title">${title}</span>
      <span class="part-status active">⏱ Termina en ${formatTimeLeft(r.endDate)}</span>
    </div>
    <div class="part-card-badge part-card-badge-join">
      <span class="part-card-badge-n">+</span>
      <span class="part-card-badge-l">UNIRSE</span>
    </div>
  </div>`;
}

// ── Init ──

window.addEventListener('load', function () {
  window.waitForFirebase(function () {
    window.auth.onAuthStateChanged(async function (fbUser) {
      if (!fbUser) {
        window.location.href = typeof withAppFlag === 'function'
          ? withAppFlag('index.html') : 'index.html';
        return;
      }
      if (!fbUser.emailVerified && fbUser.providerData?.[0]?.providerId === 'password') {
        window.location.href = typeof withAppFlag === 'function'
          ? withAppFlag('verify-pending.html') : 'verify-pending.html';
        return;
      }
      currentUser = { uid: fbUser.uid };
      await loadParticipaciones();
    });
  });
});
