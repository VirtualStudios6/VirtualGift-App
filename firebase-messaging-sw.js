/* ============================================================ */
/* FIREBASE MESSAGING SERVICE WORKER                            */
/* Coloca este archivo en la RAÍZ del dominio (mismo nivel      */
/* que index.html) para que el scope sea correcto.              */
/* ============================================================ */

importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

firebase.initializeApp({
  apiKey:            'AIzaSyDFn7fJPpOzuyiBKBXh7Lm8pHN6TwY8K-g',
  authDomain:        'virtualgift-login.firebaseapp.com',
  projectId:         'virtualgift-login',
  storageBucket:     'virtualgift-login.firebasestorage.app',
  messagingSenderId: '807245369735',
  appId:             '1:807245369735:web:b52a8412bfb23c8ad28322',
});

const messaging = firebase.messaging();

// Notificaciones cuando la app está en BACKGROUND o cerrada
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'VirtualGift';
  const body  = payload.notification?.body  || '';
  const icon  = payload.notification?.icon  || '/images/logo-virtual-login.png';

  return self.registration.showNotification(title, {
    body,
    icon,
    badge: '/images/logo-virtual-login.png',
    tag:   'vg-notif',
    data:  payload.data || {},
    vibrate: [200, 100, 200],
  });
});

// Click en la notificación → abrir/enfocar la app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/inicio.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
