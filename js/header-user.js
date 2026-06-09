// Carga foto de perfil y puntos en el header
(function () {
  const POINTS_CACHE_KEY = 'vg_points_cache';
  const POINTS_CACHE_TTL = 2 * 60 * 1000;

  function getCachedPoints() {
    try {
      const raw = localStorage.getItem(POINTS_CACHE_KEY);
      if (!raw) return null;
      const { points, timestamp } = JSON.parse(raw);
      return Date.now() - timestamp < POINTS_CACHE_TTL ? Number(points) : null;
    } catch { return null; }
  }

  function setPoints(pts) {
    const el = document.getElementById('headerPoints');
    if (el) el.textContent = Math.floor(pts).toLocaleString();
  }

  function setPhoto(url) {
    const img      = document.getElementById('headerAvatarImg');
    const fallback = document.getElementById('headerAvatarFallback');
    if (!img || !url) return;
    img.onload  = () => { img.style.display = 'block'; if (fallback) fallback.style.display = 'none'; };
    img.onerror = () => { img.style.display = 'none';  if (fallback) fallback.style.display = '';     };
    img.src = url;
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Puntos desde caché — aparecen al instante
    const cached = getCachedPoints();
    if (cached !== null) setPoints(cached);

    if (typeof window.waitForFirebase !== 'function') return;

    window.waitForFirebase(() => {
      firebase.auth().onAuthStateChanged(async (user) => {
        if (!user) return;

        // Foto desde Firebase Auth (respuesta inmediata)
        if (user.photoURL) setPhoto(user.photoURL);

        // Puntos y foto personalizada desde Firestore
        try {
          const snap = await window.db.collection('users').doc(user.uid).get();
          if (!snap.exists) return;
          const data = snap.data();

          const pts = Number(data.points) || 0;
          setPoints(pts);

          // Si subió foto personalizada, tiene prioridad sobre la de Auth
          if (data.photoURL) setPhoto(data.photoURL);
        } catch {}
      });
    });
  });
})();
