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

  // ✅ nuevos IDs (según el news.html modificado)
  const contentEl = document.getElementById('content');
  const galleryEl = document.getElementById('gallery');

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
      return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch {
      return '';
    }
  }

  function placeholderImg() {
    return 'https://via.placeholder.com/1200x700/1c1f2f/dcefff?text=VirtualGift';
  }

  function safeTextToHtml(text) {
    // Convierte texto plano a HTML seguro con saltos de línea
    const escaped = String(text ?? '').replace(/[&<>"']/g, (m) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[m]));
    return escaped.replace(/\n/g, "<br>");
  }

  async function load() {
    if (!id) return showError();

    try {
      const docSnap = await window.db.collection('news').doc(id).get();
      if (!docSnap.exists) return showError();

      const data = docSnap.data() || {};

      // Si está despublicada, no mostrar
      if (data.published !== true) return showError();

      // Título + fecha
      titleEl.textContent = data.title || 'Noticia';
      dateEl.textContent = data.date ? fmtDate(data.date) : '';

      // ✅ Imagen principal (coverImageUrl). Fallback a imageUrl viejo si existe.
      const cover =
        (data.coverImageUrl && String(data.coverImageUrl).trim()) ||
        (data.imageUrl && String(data.imageUrl).trim()) ||
        '';

      if (cover) {
        imgEl.src = cover;
        imgEl.style.display = 'block';
      } else {
        imgEl.src = placeholderImg();
        imgEl.style.display = 'block';
      }

      // ✅ Contenido largo (content). Fallback a description por compatibilidad.
      const contentText = (data.content && String(data.content)) || (data.description && String(data.description)) || '';
      if (contentEl) contentEl.innerHTML = safeTextToHtml(contentText);

      // ✅ Galería (array de URLs)
      const gallery = Array.isArray(data.gallery) ? data.gallery.filter(u => !!String(u).trim()) : [];
      if (galleryEl) {
        if (gallery.length) {
          galleryEl.innerHTML = '';
          gallery.forEach((url) => {
            const img = document.createElement('img');
            img.src = url;
            img.alt = '';
            img.loading = 'lazy';
            galleryEl.appendChild(img);
          });
          galleryEl.style.display = 'grid';
        } else {
          galleryEl.style.display = 'none';
          galleryEl.innerHTML = '';
        }
      }

      if (loading) loading.style.display = 'none';
      if (article) article.style.display = 'block';
    } catch (e) {
      console.error('[news-detail] Error:', e);
      showError();
    }
  }

  waitForFirebase(load);
});
