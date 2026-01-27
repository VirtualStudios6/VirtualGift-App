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

  const contentEl = document.getElementById('content');
  const readingEl = document.getElementById('readingTime');

  const galleryWrap = document.getElementById('galleryWrap');
  const galleryEl = document.getElementById('gallery');

  const btnShare = document.getElementById('btnShare');
  const btnShare2 = document.getElementById('btnShare2');
  const btnSave = document.getElementById('btnSave');

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

  function getCover(data) {
    const url = (data.coverImageUrl || data.imageUrl || '').trim();
    return url || 'images/news-placeholder-wide.png';
  }

  function calcReadingMinutes(text) {
    // 200 palabras/min aprox
    const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
  }

  // Convierte "## Título" a h2 y el resto a párrafos
  function renderContent(text) {
    const raw = String(text || '').replace(/\r\n/g, '\n').trim();
    if (!raw) return '<p></p>';

    const lines = raw.split('\n');
    let html = '';
    let buffer = [];

    const flushParagraph = () => {
      const t = buffer.join('\n').trim();
      if (t) html += `<p>${escapeHtml(t)}</p>`;
      buffer = [];
    };

    lines.forEach((line) => {
      const l = line.trim();

      if (l.startsWith('## ')) {
        flushParagraph();
        html += `<div class="h2">${escapeHtml(l.slice(3))}</div>`;
        return;
      }
      if (l.startsWith('### ')) {
        flushParagraph();
        html += `<div class="h3">${escapeHtml(l.slice(4))}</div>`;
        return;
      }

      if (l === '') {
        flushParagraph();
        return;
      }

      buffer.push(line);
    });

    flushParagraph();
    return html;
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (m) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[m]));
  }

  function renderGallery(gallery) {
    if (!Array.isArray(gallery) || gallery.length === 0) {
      galleryWrap.style.display = 'none';
      return;
    }

    galleryEl.innerHTML = '';
    galleryWrap.style.display = 'block';

    gallery.forEach((item) => {
      // Soporta: "url|caption" (opcional)
      const [urlRaw, capRaw] = String(item || '').split('|');
      const url = (urlRaw || '').trim();
      const cap = (capRaw || '').trim();

      if (!url) return;

      const div = document.createElement('div');
      div.className = 'g-item';
      div.innerHTML = `
        <img src="${url}" alt="" loading="lazy">
        ${cap ? `<div class="g-cap">${escapeHtml(cap)}</div>` : ''}
      `;
      galleryEl.appendChild(div);
    });

    if (!galleryEl.children.length) galleryWrap.style.display = 'none';
  }

  async function share(title) {
    const shareData = { title: title || 'VirtualGift News', url: location.href };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(location.href);
        alert('Link copiado ✅');
      }
    } catch {}
  }

  function saveLocal(id) {
    try {
      const key = 'vg_saved_news';
      const list = JSON.parse(localStorage.getItem(key) || '[]');
      if (!list.includes(id)) list.unshift(id);
      localStorage.setItem(key, JSON.stringify(list.slice(0, 100)));
      alert('Guardado ✅');
    } catch {
      alert('No se pudo guardar 😕');
    }
  }

  async function load() {
    if (!id) return showError();

    try {
      const doc = await window.db.collection('news').doc(id).get();
      if (!doc.exists) return showError();

      const data = doc.data() || {};
      if (data.published !== true) return showError();

      const title = data.title || 'Noticia';

      titleEl.textContent = title;
      dateEl.textContent = data.date ? fmtDate(data.date) : '';
      imgEl.src = getCover(data);

      const bodyText = data.content || data.description || '';
      readingEl.textContent = String(calcReadingMinutes(bodyText));

      contentEl.innerHTML = renderContent(bodyText);

      renderGallery(data.gallery || []);

      btnShare?.addEventListener('click', () => share(title));
      btnShare2?.addEventListener('click', () => share(title));
      btnSave?.addEventListener('click', () => saveLocal(id));

      if (loading) loading.style.display = 'none';
      article.style.display = 'block';
    } catch (e) {
      console.error('[news-detail] Error:', e);
      showError();
    }
  }

  waitForFirebase(load);
});
