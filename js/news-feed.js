// js/news-feed.js
document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('newsGrid');
  const errorEl = document.getElementById('newsError');
  if (!grid) return;

  function isFirebaseReady() {
    return window.db && typeof window.db.collection === 'function';
  }

  function waitForFirebase(cb) {
    const max = 80;
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

  function localPlaceholder() {
    // ✅ usa una imagen local para evitar problemas DNS con via.placeholder.com
    return 'images/news-placeholder.png';
  }

  function getCover(data) {
    const url = (data.coverImageUrl || data.imageUrl || '').trim();
    return url || localPlaceholder();
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
      const imageUrl = getCover(data);

      const a = document.createElement('a');
      a.className = 'news-card';
      a.href = `news.html?id=${encodeURIComponent(id)}`;
      a.innerHTML = `
        <div class="news-image">
          <img src="${imageUrl}" alt="${title.replace(/"/g, '&quot;')}" loading="lazy">
        </div>
        <p class="news-label">${title}</p>
      `;
      grid.appendChild(a);
    });
  }

  async function loadNews() {
    try {
      const snap = await window.db
        .collection('news')
        .where('published', '==', true)
        .where('category', '==', 'Gaming')  // ✅ SOLO Gaming News
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
