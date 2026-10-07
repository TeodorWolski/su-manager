// Service worker SU Managera — tylko powiadomienia push (bez cache offline).
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
