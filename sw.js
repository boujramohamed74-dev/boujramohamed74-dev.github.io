/* يحفظ ملفات التطبيق على الهاتف ليعمل بدون إنترنت.
   عند تعديل أي ملف: غيّر رقم VERSION ليصل التحديث للمستخدمين. */
var VERSION = 'rattib-v1';
var SHELL = [
  './', './index.html', './style.css', './store.js', './app.js',
  './manifest.webmanifest', './icon-192.png', './icon-512.png'
];
var FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  /* الخطوط: نحفظها عند أول تحميل لتعمل لاحقاً بدون نت */
  if (FONT_HOSTS.indexOf(url.hostname) !== -1) {
    e.respondWith(
      caches.open(VERSION).then(function (c) {
        return c.match(req).then(function (hit) {
          var net = fetch(req).then(function (res) { c.put(req, res.clone()); return res; }).catch(function () { return hit; });
          return hit || net;
        });
      })
    );
    return;
  }

  if (url.origin !== location.origin) return;

  /* ملفات التطبيق: من الذاكرة أولاً */
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(VERSION).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        if (req.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});
