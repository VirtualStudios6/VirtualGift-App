// js/news-feed.js
document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('newsGrid');
  const errorEl = document.getElementById('newsError');

  if (!grid) return;

  function isFirebaseReady() {
    return window.db && typeof window.db.collection === 'function';
  }

  function waitForFirebase(cb) {
    const max = 80; // ~8s
    let i = 0;
    const t = setInterval(() => {
      i++;
      if (isFirebaseReady()) {
        clearInterval(t);
        cb();
      } else if (i >= max) {
        clearInterval(t);
        console.warn('[news-feed] Firebase no cargó a tiempo');
        showError();
      }
    }, 100);
  }

  function showError() {
    if (errorEl) errorEl.style.display = 'block';
  }

  function placeholderImg(title = 'Noticia') {
    // Placeholder simple sin depender de imágenes externas
    const text = encodeURIComponent(title);
    return `https://via.placeholder.com/300x300/1c1f2f/dcefff?text=${text}`;
  }

  function escapeAttr(str) {
    return String(str ?? '').replace(/"/g, '&quot;');
  }

  function renderNews(docs) {
    grid.innerHTML = '';

    if (!docs.length) {
      grid.innerHTML = `
        <div style="opacity:.8; padding:10px;">
          No hay noticias publicadas todavía.
        </div>
      `;
      return;
    }

    docs.forEach(({ id, data }) => {
      const title = data.title || 'Noticia';

      // ✅ Usamos coverImageUrl (tu campo nuevo)
      // Fallback: si aún tienes imageUrl viejo, también lo soportamos
      const raw =
        (data.coverImageUrl && String(data.coverImageUrl).trim()) ||
        (data.imageUrl && String(data.imageUrl).trim()) ||
        '';

      const imageUrl = raw ? raw : placeholderImg(title);

      const a = document.createElement('a');
      a.className = 'news-card';
      a.href = `news.html?id=${encodeURIComponent(id)}`; // abre noticia dinámica
      a.innerHTML = `
        <div class="news-image">
          <img src="${imageUrl}" alt="${escapeAttr(title)}" loading="lazy">
        </div>
        <p class="news-label">${title}</p>
      `;

      grid.appendChild(a);
    });
  }

  async function loadNews() {
    try {
      // ✅ Gaming News: solo categoría Gaming
      // Orden por fecha (más nueva primero)
      // where(published) + where(category) + orderBy(date) => puede requerir índice compuesto
      const snap = await window.db
        .collection('news')
        .where('published', '==', true)
        .where('category', '==', 'Gaming')
        .orderBy('date', 'desc')
        .limit(12)
        .get();

      const docs = snap.docs.map(d => ({ id: d.id, data: d.data() }));
      renderNews(docs);
    } catch (e) {
      console.error('[news-feed] Error:', e);
      showError();
    }
  }

  waitForFirebase(loadNews);
});
