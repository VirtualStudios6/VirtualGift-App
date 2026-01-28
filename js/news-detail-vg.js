// js/news-detail-vg.js
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');

  const titleEl = document.getElementById('titleText');
  const dateEl = document.getElementById('dateText');
  const categoryEl = document.getElementById('categoryText');

  const statusBadge = document.getElementById('statusBadge');
  const statusTextEl = document.getElementById('statusText');

  const blocksContainer = document.getElementById('blocksContainer');

  const headerImageEl = document.getElementById('headerImage');
  const headerFallbackEl = document.getElementById('headerFallback');

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
    console.error('[news-detail-vg] ', msg || 'Error');
    if (titleEl) titleEl.textContent = 'No se pudo cargar la noticia.';
    if (blocksContainer) {
      blocksContainer.innerHTML = `<p style="opacity:.85;">${escapeHtml(msg || 'Error cargando noticia')}</p>`;
    }
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (m) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[m]));
  }

  function fmtDate(ts) {
    if (!ts) return '—';
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleDateString('es-ES', { day:'2-digit', month:'long', year:'numeric' });
    } catch { return '—'; }
  }

  function setHeaderImage(url) {
    const clean = (url && String(url).trim()) ? String(url).trim() : '';
    if (!clean) {
      // fallback
      if (headerImageEl) headerImageEl.style.display = 'none';
      if (headerFallbackEl) headerFallbackEl.style.display = 'flex';
      return;
    }

    if (headerImageEl) {
      headerImageEl.src = clean;
      headerImageEl.style.display = 'block';
      headerImageEl.style.width = '100%';
      headerImageEl.style.height = '100%';
      headerImageEl.style.objectFit = 'cover';
    }
    if (headerFallbackEl) headerFallbackEl.style.display = 'none';
  }

  function renderBlocks(blocks) {
    if (!blocksContainer) return;
    blocksContainer.innerHTML = '';

    if (!Array.isArray(blocks) || blocks.length === 0) {
      blocksContainer.innerHTML = `<p style="opacity:.85;">Esta noticia no tiene contenido todavía.</p>`;
      return;
    }

    blocks.forEach((b) => {
      const type = String(b?.type || '').trim();

      if (type === 'p') {
        const p = document.createElement('p');
        p.textContent = String(b.text || '');
        blocksContainer.appendChild(p);
        return;
      }

      if (type === 'h2') {
        const h2 = document.createElement('h2');
        h2.textContent = String(b.text || '');
        blocksContainer.appendChild(h2);
        return;
      }

      if (type === 'highlight') {
        const box = document.createElement('div');
        box.className = 'highlight-box';
        const p = document.createElement('p');
        p.textContent = String(b.text || '');
        box.appendChild(p);
        blocksContainer.appendChild(box);
        return;
      }

      if (type === 'img') {
        const url = String(b.url || '').trim();
        if (!url) return;

        const wrap = document.createElement('div');
        wrap.className = 'image-section';

        const img = document.createElement('img');
        img.src = url;
        img.alt = 'Imagen de la noticia';
        wrap.appendChild(img);

        const cap = String(b.caption || '').trim();
        if (cap) {
          const caption = document.createElement('div');
          caption.className = 'image-caption';
          caption.textContent = cap;
          wrap.appendChild(caption);
        }

        blocksContainer.appendChild(wrap);
        return;
      }

      // Tipos desconocidos => ignora
    });
  }

  async function load() {
    if (!id) return showError('Falta el id en la URL.');

    try {
      const doc = await window.db.collection('news').doc(id).get();
      if (!doc.exists) return showError('La noticia no existe.');

      const data = doc.data() || {};

      // si está despublicada, oculta
      if (data.published !== true) return showError('Esta noticia no está publicada.');

      // Title
      if (titleEl) titleEl.textContent = data.title || 'Noticia';

      // Date (para orden del feed)
      if (dateEl) dateEl.textContent = fmtDate(data.date || data.updatedAt || data.createdAt);

      // Category
      if (categoryEl) categoryEl.textContent = data.category || 'Gaming';

      // Status
      const st = String(data.statusText || '').trim();
      if (st) {
        statusTextEl.textContent = st;
        statusBadge.style.display = 'inline-flex';
      } else {
        statusBadge.style.display = 'none';
      }

      // ✅ Header Image
      setHeaderImage(data.headerImageUrl);

      // ✅ Blocks
      renderBlocks(data.blocks);

    } catch (e) {
      console.error('[news-detail-vg] Error:', e);
      showError(e.message || 'Error cargando noticia.');
    }
  }

  waitForFirebase(load);
});
