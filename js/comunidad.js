/* ═══════════════════════════════════════════════
   COMUNIDAD.JS — VirtualGift
   Ranking de Coins + Actividad Reciente + Stats
═══════════════════════════════════════════════ */
'use strict';

let currentUid = null;

// ── Helpers ──

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function timeAgo(ts) {
  if (!ts) return '—';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const diff  = Date.now() - date.getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  <  2) return 'Ahora mismo';
  if (mins  < 60) return `Hace ${mins} min`;
  if (hours < 24) return `Hace ${hours}h`;
  if (days  <  7) return `Hace ${days}d`;
  return date.toLocaleDateString('es-DO', { month: 'short', day: 'numeric' });
}

function anonymize(name) {
  if (!name) return 'Usuario';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 10);
  return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
}

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

const AVATAR_COLORS = [
  'linear-gradient(135deg,#7c3aed,#a855f7)',
  'linear-gradient(135deg,#0369a1,#0ea5e9)',
  'linear-gradient(135deg,#047857,#10b981)',
  'linear-gradient(135deg,#b45309,#f59e0b)',
  'linear-gradient(135deg,#be123c,#f43f5e)',
  'linear-gradient(135deg,#1d4ed8,#60a5fa)',
  'linear-gradient(135deg,#6d28d9,#c084fc)',
  'linear-gradient(135deg,#0f766e,#2dd4bf)',
];

function avatarColor(uid) {
  let h = 0;
  for (let i = 0; i < (uid || '').length; i++) h = uid.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

// ── Stats ──

async function loadStats() {
  try {
    const [sorteosSnap, todayGirosSnap] = await Promise.all([
      window.db.collection('raffles').where('active', '==', true).get(),
      window.db.collection('pointsHistory')
        .where('type', '==', 'roulette_win')
        .where('createdAt', '>=', firebase.firestore.Timestamp.fromDate(
          new Date(new Date().setHours(0, 0, 0, 0))
        ))
        .get(),
    ]);

    document.getElementById('statSorteos').textContent = sorteosSnap.size;
    document.getElementById('statGiros').textContent   = todayGirosSnap.size || '0';

    // User count: try stats/global, fallback to a readable approximate
    try {
      const statsDoc = await window.db.collection('stats').doc('global').get();
      const count = statsDoc.exists ? (statsDoc.data().userCount || null) : null;
      document.getElementById('statUsers').textContent = count ? count.toLocaleString() : '500+';
    } catch (_) {
      document.getElementById('statUsers').textContent = '500+';
    }
  } catch (e) {
    console.warn('[comunidad] loadStats', e);
    document.getElementById('statSorteos').textContent = '—';
    document.getElementById('statGiros').textContent   = '—';
    document.getElementById('statUsers').textContent   = '—';
  }
}

// ── Ranking ──

window.loadRanking = async function () {
  const podium = document.getElementById('rankingPodium');
  const list   = document.getElementById('rankingList');
  const myCard = document.getElementById('myRankCard');

  podium.innerHTML = [1, 2, 3].map(() =>
    '<div class="skel" style="height:140px;border-radius:18px;"></div>'
  ).join('');
  list.innerHTML = [1, 2, 3, 4].map(() =>
    '<div class="skel" style="height:54px;border-radius:14px;"></div>'
  ).join('');
  myCard.style.display = 'none';

  try {
    const snap = await window.db.collection('users')
      .orderBy('points', 'desc')
      .limit(12)
      .get();

    if (snap.empty) {
      podium.innerHTML = '<div class="empty-state" style="grid-column:1/-1">Sin datos de ranking aún.</div>';
      list.innerHTML = '';
      return;
    }

    const users = snap.docs.map((d, i) => ({ rank: i + 1, id: d.id, ...d.data() }));
    const top3  = users.slice(0, 3);
    const rest  = users.slice(3, 10);

    // Podium visual order: #2 (left), #1 (center, taller), #3 (right)
    const ORDER  = [top3[1], top3[0], top3[2]];
    const MEDALS = ['🥈', '🥇', '🥉'];
    const CLASSES = ['podium-item--2', 'podium-item--1', 'podium-item--3'];
    const HEIGHTS = ['120px', '146px', '108px'];

    podium.innerHTML = ORDER.map((u, i) => {
      if (!u) return `<div class="podium-item ${CLASSES[i]}" style="min-height:${HEIGHTS[i]};"></div>`;
      const name   = esc(anonymize(u.displayName || u.email || `#${u.id.slice(0, 4)}`));
      const coins  = (u.points || 0).toLocaleString();
      const isMe   = u.id === currentUid;
      const color  = avatarColor(u.id);
      const initls = initials(u.displayName || u.email || 'U');
      const youTag = isMe ? ' <span class="rank-you">Tú</span>' : '';
      return `
        <div class="podium-item ${CLASSES[i]}" style="min-height:${HEIGHTS[i]}">
          <span class="podium-medal">${MEDALS[i]}</span>
          <div class="podium-avatar" style="background:${color}">${initls}</div>
          <span class="podium-name">${name}${youTag}</span>
          <span class="podium-coins">🪙 ${coins}</span>
          <span class="podium-rank-num">#${u.rank}</span>
        </div>`;
    }).join('');

    list.innerHTML = rest.map(u => {
      const name   = esc(anonymize(u.displayName || u.email || `#${u.id.slice(0, 4)}`));
      const coins  = (u.points || 0).toLocaleString();
      const isMe   = u.id === currentUid;
      const color  = avatarColor(u.id);
      const initls = initials(u.displayName || u.email || 'U');
      const youTag = isMe ? ' <span class="rank-you">Tú</span>' : '';
      return `
        <div class="rank-row">
          <span class="rank-num">#${u.rank}</span>
          <div class="rank-avatar" style="background:${color}">${initls}</div>
          <span class="rank-name">${name}${youTag}</span>
          <span class="rank-coins">🪙 ${coins}</span>
        </div>`;
    }).join('') || '';

    // Show user's own card if they're not in the visible top 10
    const inTop10 = users.slice(0, 10).some(u => u.id === currentUid);
    if (!inTop10 && currentUid) {
      try {
        const myDoc  = await window.db.collection('users').doc(currentUid).get();
        const myData = myDoc.data() || {};
        const myName = esc(anonymize(myData.displayName || myData.email || 'Tú'));
        const myInitls = initials(myData.displayName || myData.email || 'U');
        myCard.style.display = 'block';
        myCard.innerHTML = `
          <div class="my-rank-card">
            <span class="rank-num" style="color:#a78bfa;width:auto;">Tú</span>
            <div class="rank-avatar" style="background:${avatarColor(currentUid)}">${myInitls}</div>
            <span class="rank-name">${myName} <span class="rank-you">Tú</span></span>
            <span class="rank-coins">🪙 ${(myData.points || 0).toLocaleString()}</span>
          </div>`;
      } catch (_) { /* ignore */ }
    }

  } catch (e) {
    console.error('[comunidad] loadRanking', e);
    podium.innerHTML = '<div class="empty-state" style="grid-column:1/-1">Error al cargar el ranking.</div>';
    list.innerHTML   = '';
  }
};

// ── Activity ──

async function loadActivity() {
  const actList = document.getElementById('activityList');

  try {
    const snap = await window.db.collection('raffleParticipants')
      .orderBy('enteredAt', 'desc')
      .limit(15)
      .get();

    if (snap.empty) {
      actList.innerHTML = '<div class="empty-state">Nadie ha participado aún. ¡Sé el primero!</div>';
      return;
    }

    // Batch-fetch unique raffles
    const raffleIds = [...new Set(snap.docs.map(d => d.data().raffleId).filter(Boolean))];
    const raffleMap = {};
    if (raffleIds.length) {
      const docs = await Promise.all(raffleIds.map(id => window.db.collection('raffles').doc(id).get()));
      docs.forEach(doc => {
        if (doc.exists) {
          const r = doc.data();
          raffleMap[doc.id] = `${r.title || ''} ${r.value || ''}`.trim() || 'Sorteo';
        }
      });
    }

    // Batch-fetch unique users (up to 10 unique)
    const userIds = [...new Set(snap.docs.map(d => d.data().userId).filter(Boolean))].slice(0, 10);
    const userMap = {};
    if (userIds.length) {
      const docs = await Promise.all(userIds.map(id => window.db.collection('users').doc(id).get()));
      docs.forEach(doc => {
        if (doc.exists) {
          const u = doc.data();
          userMap[doc.id] = u.displayName || u.email || null;
        }
      });
    }

    actList.innerHTML = snap.docs.map(doc => {
      const d          = doc.data();
      const raffleName = esc(raffleMap[d.raffleId] || 'un sorteo');
      const rawName    = userMap[d.userId] || null;
      const isMe       = d.userId === currentUid;
      const displayName = isMe ? 'Tú' : anonymize(rawName || `Usuario #${(d.userId || '').slice(0, 5)}`);
      const color      = avatarColor(d.userId || doc.id);
      const initls     = initials(rawName || 'U');
      const timeStr    = timeAgo(d.enteredAt);

      return `
        <div class="activity-item">
          <div class="activity-avatar" style="background:${color}">${initls}</div>
          <div class="activity-body">
            <div class="activity-text">
              <strong>${esc(displayName)}</strong> participó en <strong>${raffleName}</strong>
            </div>
            <div class="activity-time">${timeStr}</div>
          </div>
          <span class="activity-icon">🎫</span>
        </div>`;
    }).join('');

  } catch (e) {
    console.error('[comunidad] loadActivity', e);
    actList.innerHTML = '<div class="empty-state">Error al cargar la actividad.</div>';
  }
}

// ── Init ──

window.addEventListener('load', () => {
  window.waitForFirebase(() => {
    firebase.auth().onAuthStateChanged(async user => {
      if (!user) {
        window.location.href = typeof withAppFlag === 'function'
          ? withAppFlag('login.html') : 'login.html';
        return;
      }
      currentUid = user.uid;
      loadStats();
      loadRanking();
      loadActivity();
    });
  });
});
