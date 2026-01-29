// js/news-feed.js
document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('newsGrid');
  const errorEl = document.getElementById('newsError');
  if (!grid) return;

  const FEED_LIMIT = 12;

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
        showError('Firebase no cargó a tiempo.');
      }
    }, 100);
  }

  function showError(msg) {
    if (!errorEl) return;
    errorEl.style.display = 'block';
    if (msg) errorEl.textContent = msg;
  }

  function localPlaceholder() {
    return 'images/news-placeholder.png';
  }

  function getCover(data) {
    const url = String(data?.coverImageUrl || '').trim();
    return url || localPlaceholder();
  }

  function renderEmpty() {
    grid.innerHTML = '';
    const div = document.createElement('div');
    div.style.opacity = '.85';
    div.style.padding = '10px';
    div.textContent = 'No hay noticias publicadas todavía.';
    grid.appendChild(div);
  }

  function renderNews(items) {
    grid.innerHTML = '';

    if (!items.length) {
      renderEmpty();
      return;
    }

    items.forEach(({ id, data }) => {
      const title = String(data?.title || 'Noticia');
      const imageUrl = getCover(data);

      const a = document.createElement('a');
      a.className = 'news-card';
      a.href = `news.html?id=${encodeURIComponent(id)}`;

      const imgWrap = document.createElement('div');
      imgWrap.className = 'news-image';

      const img = document.createElement('img');
      img.loading = 'lazy';
      img.alt = title;
      img.src = imageUrl;
      img.onerror = () => img.src = localPlaceholder();

      const p = document.createElement('p');
      p.className = 'news-label';
      p.textContent = title;

      imgWrap.appendChild(img);
      a.appendChild(imgWrap);
      a.appendChild(p);

      grid.appendChild(a);
    });
  }

  async function loadNews() {
    try {
      // 🔥 ORDENAMOS POR updatedAt (SIEMPRE EXISTE)
      const snap = await window.db
        .collection('news')
        .where('published', '==', true)
        .orderBy('updatedAt', 'desc')
        .limit(FEED_LIMIT)
        .get();

      const items = snap.docs.map(d => ({ id: d.id, data: d.data() }));
      renderNews(items);
    } catch (e) {
      console.error('[news-feed] Error real:', e);
      showError('No se pudieron cargar las noticias.');
    }
  }

  waitForFirebase(loadNews);
});
