/* DriveChat service worker: makes the app installable, loads it instantly,
   shows a friendly offline page, and delivers notifications on Android. */
const VERSION = 'dc-v16';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'favicon-32.png', 'privacy.html', 'terms.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;   // never touch Google APIs
  if (req.mode === 'navigate') {
    // network first so updates show up immediately; cached copy when offline
    e.respondWith(fetch(req.url, { cache: 'no-store', credentials: 'same-origin' }).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put('index.html', copy)); return r; })
      .catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(r => { if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return r; }).catch(() => hit);
    return hit || net;
  }));
});
/* Push: the payload was end-to-end encrypted by the sender's browser; the browser
   decrypts it for us. Shows Messenger-style notifications even when DriveChat is closed. */
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch {}
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    wins.forEach(w => w.postMessage({ type: 'poll' }));              // open app fetches right away
    if (d.t === 'missed') (await self.registration.getNotifications({ tag: 'call' })).forEach(n => n.close());
    const isApp = w => !/\/(privacy|terms)\.html$/.test(new URL(w.url).pathname);
    const onScreen = wins.some(w => isApp(w) && w.visibilityState === 'visible' && w.focused);
    if (onScreen) return;                                             // the app shows its own UI / ringtone
    const call = d.t === 'call';
    await self.registration.showNotification(d.title || 'DriveChat', {
      body: d.body || 'New message', icon: d.icon || 'icon-192.png', badge: 'icon-maskable-192.png',
      tag: call ? 'call' : (d.cid || 'drivechat'), renotify: true, requireInteraction: call,
      vibrate: call ? [600, 300, 600, 300, 600, 300, 600, 300, 600] : [120, 60, 120],
      timestamp: Date.now(), data: { cid: d.cid, call },
      actions: call ? [{ action: 'answer', title: d.video ? '📹 Answer' : '📞 Answer' }, { action: 'decline', title: 'Decline' }] : [{ action: 'open', title: 'Reply' }]
    });
  })());
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'decline') return;
  const cid = e.notification.data?.cid;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const apps = list.filter(w => !/\/(privacy|terms)\.html$/.test(new URL(w.url).pathname));
    const c = apps.find(w => w.visibilityState === 'visible') || apps[0];
    const answer = e.notification.data?.call && e.action !== 'open';   // tapping a call (iPhone shows no buttons) = answer
    if (c) { c.postMessage({ type: answer ? 'answer' : 'open', cid }); c.postMessage({ type: 'poll' }); return c.focus(); }
    return self.clients.openWindow('./' + (cid ? (answer ? '#answer=' : '#open=') + cid : ''));
  }));
});
