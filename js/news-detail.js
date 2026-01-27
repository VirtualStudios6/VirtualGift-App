// js/news-detail.js
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');

  const loading = document.getElementById('loading');
  const article = document.getElementById('article');
  const errorEl = document.getElementById('error');

  const titleEl = document.getElementById('title');
  const dateEl = document.getElementById('date');
  const imgEl = document.getElementById('image');
  const descEl = document.getElementById('desc');

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
        showError();
      }
    }, 100);
  }

  function showError() {
    if (loading) loading.style.display = 'none';
    if (article) article.style.display = 'none';
    if (errorEl) errorEl.style.display = 'block';
  }

  function fmtDate(ts) {
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleDateString('es-ES', { day:'2-digit', month:'long', year:'numeric' });
    } catch {
      return '';
    }
  }

  async function load() {
    if (!id) return showError();

    try {
      const doc = await window.db.collection('news').doc(id).get();
      if (!doc.exists) return showError();

      const data = doc.data();

      // Si está despublicada, no mostrar
      if (data.published !== true) return showError();

      titleEl.textContent = data.title || 'Noticia';
      dateEl.textContent = data.date ? fmtDate(data.date) : '';
      descEl.textContent = data.description || '';

      const imageUrl = (data.imageUrl && data.imageUrl.trim()) ? data.imageUrl.trim() : 'https://via.placeholder.com/1200x700/1c1f2f/dcefff?text=VirtualGift';
      imgEl.src = imageUrl;

      if (loading) loading.style.display = 'none';
      article.style.display = 'block';
    } catch (e) {
      console.error('[news-detail] Error:', e);
      showError();
    }
  }

  waitForFirebase(load);
});
