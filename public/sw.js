var CACHE = "classfund-v11";

var PRECACHE_URLS = [
  "/",
  "/index.html",
  "/landing.html",
  "/admin.html",
  "/style.css",
  "/navbar.css",
  "/app.js",
  "/data-provider-firebase.js",
  "/firebase-config.js",
  "/firebase-auth.js",
  "/class-storage.js",
  "/data-provider-localstorage.js",
  "/xlsx-export.js",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-icon.png",
  "/favicon.ico",
  "/vendor/lucide.min.js",
  "/vendor/firebase-app-compat.js",
  "/vendor/firebase-auth-compat.js",
  "/vendor/firebase-firestore-compat.js",
];

function isClassRoute(url) {
  var path = url.replace(/^https?:\/\/[^\/]+/, "");
  return /^\/class\/[^/]+/.test(path);
}

function isApiRoute(url) {
  var path = url.replace(/^https?:\/\/[^\/]+/, "");
  return path.startsWith("/api/");
}

function isStaticAsset(url) {
  var path = url.replace(/^https?:\/\/[^\/]+/, "").split("?")[0];
  return /\.(css|js|json|png|ico|svg|jpg|jpeg|gif|woff|woff2|ttf|eot|webmanifest)$/.test(path);
}

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(PRECACHE_URLS);
    }).then(function () {
      return self.skipWaiting();
    }).catch(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;

  var reqUrl = e.request.url;

  if (isClassRoute(reqUrl)) {
    e.respondWith(fetch(e.request));
    return;
  }

  if (isApiRoute(reqUrl)) {
    e.respondWith(fetch(e.request));
    return;
  }

  if (isStaticAsset(reqUrl)) {
    e.respondWith(
      fetch(e.request).then(function (response) {
        if (response && response.status === 200) {
          var copy = response.clone();
          caches.open(CACHE).then(function (cache) { cache.put(e.request, copy); });
        }
        return response;
      }).catch(function () {
        return caches.match(e.request);
      })
    );
    return;
  }

  e.respondWith(
    fetch(e.request).then(function (response) {
      if (response && response.status === 200) {
        var copy = response.clone();
        caches.open(CACHE).then(function (cache) { cache.put(e.request, copy); });
      }
      return response;
    }).catch(function () {
      return caches.match(e.request).then(function (match) {
        return match || caches.match("/");
      });
    })
  );
});
