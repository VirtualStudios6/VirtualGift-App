// js/news-feed.js - VERSIÓN OPTIMIZADA
document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('newsGrid');
  const errorEl = document.getElementById('newsError');
  if (!grid) return;

  const FEED_LIMIT = 12;
  const CACHE_KEY = 'vg_news_cache';
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

  // ✅ OPTIMIZACIÓN 1: Sistema de caché para noticias
  function getCachedNews() {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const data = JSON.parse(cached);
      const age = Date.now() - data.timestamp;

      if (age < CACHE_DURATION) {
        console.log('✅ Usando noticias en caché (edad:', Math.floor(age/1000), 's)');
        return data.items;
      }

      localStorage.removeItem(CACHE_KEY);
      return null;
    } catch (e) {
      console.warn('Error al leer caché de noticias:', e);
      return null;
    }
  }

  function setCachedNews(items) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        items: items,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.warn('Error al guardar caché de noticias:', e);
    }
  }

  function isFirebaseReady() {
    return window.db && typeof window.db.collection === 'function';
  }

  function waitForFirebase(cb) {
    const max = 30; // ✅ Reducido de 80 a 30
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
    // Ocultar skeleton
    removeSkeleton();
  }

  // ✅ OPTIMIZACIÓN 2: Mostrar skeleton mientras carga
  function renderSkeleton() {
    grid.innerHTML = `
      ${Array(6).fill(0).map(() => `
        <div class="news-card skeleton-news">
          <div class="news-image"></div>
          <p class="news-label"></p>
        </div>
      `).join('')}
    `;
  }

  function removeSkeleton() {
    const skeletons = grid.querySelectorAll('.skeleton-news');
    skeletons.forEach(s => s.remove());
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
    // ✅ Limpiar skeleton primero
    removeSkeleton();

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

    console.log('✅ Noticias renderizadas:', items.length);
  }

  async function loadNews() {
    try {
      // ✅ OPTIMIZACIÓN 3: Intentar cargar desde caché primero
      const cachedItems = getCachedNews();
      if (cachedItems) {
        renderNews(cachedItems);
        // Actualizar en segundo plano
        fetchAndUpdateNews(true);
        return;
      }

      // Si no hay caché, cargar de Firestore
      await fetchAndUpdateNews(false);

    } catch (e) {
      console.error('[news-feed] Error:', e);
      showError('No se pudieron cargar las noticias.');
    }
  }

  async function fetchAndUpdateNews(silent = false) {
    try {
      const snap = await window.db
        .collection('news')
        .where('published', '==', true)
        .orderBy('updatedAt', 'desc')
        .limit(FEED_LIMIT)
        .get();

      const items = snap.docs.map(d => ({ id: d.id, data: d.data() }));

      // Guardar en caché
      setCachedNews(items);

      // Renderizar si no es silent
      if (!silent) {
        renderNews(items);
      }

      if (!silent) console.log('✅ Noticias cargadas desde Firestore');

    } catch (e) {
      console.error('[news-feed] Error fetchAndUpdateNews:', e);
      if (!silent) {
        showError('No se pudieron cargar las noticias.');
      }
    }
  }

  // ✅ OPTIMIZACIÓN 4: Mostrar skeleton inmediatamente
  // Ya no es necesario porque el HTML ya tiene el skeleton initial
  // Solo necesitamos cargar
  waitForFirebase(loadNews);
});
