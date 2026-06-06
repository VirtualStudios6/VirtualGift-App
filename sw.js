/* ============================================================
   VirtualGift Service Worker — Cache-First para assets estáticos
   Version: v4 — actualizar CACHE_VER al desplegar cambios grandes
   ============================================================ */

const CACHE_VER     = 'vg-v4';
const CACHE_STATIC  = CACHE_VER + '-static';
const CACHE_DYNAMIC = CACHE_VER + '-dynamic';

// Assets pre-cacheados en el install (siempre disponibles offline)
const PRE_CACHE = [
  '/index.html',
  '/inicio.html',
  '/css/splash.css',
  '/css/inicio.css',
  '/css/header.css',
  '/css/bottom-nav.css',
  '/css/games.css',
  '/js/app-mode.js',
  '/js/firebase-config.js',
  '/js/unity-ads.js',
  '/js/unity-banner.js',
  '/images/logo-virtual-login.png',
  '/manifest.json',
];

// Dominios que NUNCA se cachean (siempre red)
const SKIP_CACHE_HOSTS = [
  'firebaseio.com',
  'googleapis.com',
  'firebase.google.com',
  'gstatic.com',
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'cloudfunctions.net',
  'wall.offermaru.com',
  'offers.cpx-research.com',
  'fortnite-api.com',
];

// ── Install: pre-cachear assets críticos ──────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then(cache =>
      cache.addAll(PRE_CACHE).catch(err => {
        // Si algún asset falla, no bloquear instalación
        console.warn('[SW] Pre-cache parcial:', err.message);
      })
    )
  );
  self.skipWaiting();
});

// ── Activate: limpiar caches viejas ──────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_STATIC && k !== CACHE_DYNAMIC)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: estrategia por tipo de recurso ─────────────────
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // No cachear llamadas externas (Firebase, APIs, offerwalls)
  if (SKIP_CACHE_HOSTS.some(h => url.hostname.includes(h))) return;

  // No cachear chrome-extension, data URIs, etc.
  if (!url.protocol.startsWith('http')) return;

  const isAsset = /\.(js|css|png|jpg|jpeg|webp|svg|gif|ico|woff2?|ttf)(\?.*)?$/.test(url.pathname);
  const isHTML  = url.pathname.endsWith('.html') || url.pathname === '/';

  if (isAsset) {
    // Cache-First: sirve desde cache, actualiza en background
    event.respondWith(cacheFirst(req));
  } else if (isHTML) {
    // Network-First: HTML siempre fresco, fallback a cache
    event.respondWith(networkFirst(req));
  }
  // Resto (no-match): deja que el browser lo maneje normal
});

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const response = await fetch(req);
    if (response.ok) {
      const cache = await caches.open(CACHE_DYNAMIC);
      cache.put(req, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 503, statusText: 'Offline' });
  }
}

async function networkFirst(req) {
  try {
    const response = await fetch(req);
    if (response.ok) {
      const cache = await caches.open(CACHE_DYNAMIC);
      cache.put(req, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(req);
    return cached || new Response('<h1>Sin conexión</h1>', {
      headers: { 'Content-Type': 'text/html' },
    });
  }
}
