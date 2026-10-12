// Service worker SU Managera — powiadomienia push i strona „bez zasięgu” (offline.html) z logiem grania.
// Bez cache stron apki: dane zawsze z sieci, a bez sieci tylko offline.html (kolejka logów w localStorage).
const OFFLINE_CACHE = "su-offline-v1";
const OFFLINE_URL = "/offline.html";
const cacheOffline = () => caches.open(OFFLINE_CACHE).then((c) => c.add(new Request(OFFLINE_URL, { cache: "reload" })));

self.addEventListener("install", (event) => {
  event.waitUntil(cacheOffline());
  self.skipWaiting();
});
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
// OfflineSync prosi o świeżą kopię przy otwarciu apki (po wdrożeniu strona mogła się zmienić).
self.addEventListener("message", (event) => {
  if (event.data === "refresh-offline") event.waitUntil(cacheOffline().catch(() => {}));
});
// Nawigacja bez sieci → offline.html. Wszystko inne idzie zwykle do sieci.
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag, // ten sam tag zastępuje starsze powiadomienie zamiast dokładać kolejne
      data: { url: data.url || "/" },
    }),
  );
});

// Tap w powiadomienie: otwórz (albo przełącz na) apkę na właściwym ekranie.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => c.url.startsWith(self.location.origin));
      if (open) return open.navigate(url).then((c) => c && c.focus());
      return self.clients.openWindow(url);
    }),
  );
});
