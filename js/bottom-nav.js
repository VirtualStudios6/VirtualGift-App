/* =========================================================
   BOTTOM-NAV.JS — VirtualGift
   Inyecta el menú inferior. Se determina el ítem activo
   según la página actual.
   ========================================================= */
(function () {

  const PAGE_TO_ACTIVE = {
    'inicio.html':         'inicio',
    'home.html':           'perfil',
    'puntos.html':         'recompensa',
    'notificaciones.html': null,
  };

  const ITEMS = [
    {
      id:   'inicio',
      label: 'Inicio',
      href:  'inicio.html',
      icon:  '<path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>',
    },
    {
      id:    'recompensa',
      label: 'Recompensa',
      href:  null,
      icon:  '<path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>',
    },
    {
      id:    'comunidad',
      label: 'Comunidad',
      href:  null,
      icon:  '<path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>',
    },
    {
      id:    'perfil',
      label: 'Perfil',
      href:  'home.html',
      icon:  '<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>',
    },
  ];

  function init() {
    if (document.querySelector('.bottom-nav')) return;

    const file = (window.location.pathname.split('/').pop() || 'inicio.html')
      .split('?')[0].split('#')[0];

    const activeId = Object.prototype.hasOwnProperty.call(PAGE_TO_ACTIVE, file)
      ? PAGE_TO_ACTIVE[file]
      : null;

    const nav = document.createElement('nav');
    nav.className = 'bottom-nav';
    nav.setAttribute('role', 'navigation');
    nav.setAttribute('aria-label', 'Navegación principal');

    ITEMS.forEach(function (item) {
      const isActive = item.id === activeId;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bottom-nav-item' + (isActive ? ' active' : '');
      btn.setAttribute('aria-label', item.label);
      if (isActive) btn.setAttribute('aria-current', 'page');
      btn.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true">' + item.icon + '</svg>' +
        '<span>' + item.label + '</span>';
      if (item.href && !isActive) {
        btn.addEventListener('click', function () {
          var dest = item.href;
          if (typeof window.withAppFlag === 'function') dest = window.withAppFlag(dest);
          window.location.href = dest;
        });
      }
      nav.appendChild(btn);
    });

    document.body.appendChild(nav);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
