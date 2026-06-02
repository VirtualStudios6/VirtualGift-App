// Neutral service worker used to replace and unregister the old ad worker.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.registration.unregister().then(() =>
      self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clients) => clients.forEach((client) => client.navigate(client.url)))
    )
  );
});
