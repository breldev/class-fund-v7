var CACHE = "classfund-v7";

var PRECACHE = [
  "./index.html",
  "./landing.html",
  "./style.css",
  "./app.js",
  "./firebase-config.js",
  "./firebase-auth.js",
  "./data-provider-firebase.js",
  "./class-storage.js",
  "./xlsx-export.js",
  "./data-provider-localstorage.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./favicon.ico",
  "./apple-icon.png",
  "https://unpkg.com/lucide@latest"
];

function isIndexRequest(url) {
  var path = url.replace(/^https?:\/\/[^\/]+/, "");
  return path === "/index.html" || path.endsWith("/index.html");
}

// Class routes should always be fetched from server (never cached)
function isClassRoute(url) {
  var path = url.replace(/^https?:\/\/[^\/]+/, "");
  return /^\/class\/[^/]+/.test(path);
}

// API routes should always be fetched from server (never cached)
function isApiRoute(url) {
  var path = url.replace(/^https?:\/\/[^\/]+/, "");
  return path.startsWith("/api/");
}

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(PRECACHE);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("message", function (e) {
  if (e.data === "skipWaiting") {
    self.skipWaiting();
  }
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

  // Class routes: always fetch from server (never cache)
  if (isClassRoute(reqUrl)) {
    e.respondWith(fetch(e.request));
    return;
  }

  // API routes: always fetch from server (never cache)
  if (isApiRoute(reqUrl)) {
    e.respondWith(fetch(e.request));
    return;
  }

  if (isIndexRequest(reqUrl)) {
    e.respondWith(
      caches.match("./index.html").then(function (cached) {
        return cached || fetch(e.request).then(function (r) {
          var copy = r.clone();
          caches.open(CACHE).then(function (cache) { cache.put("./index.html", copy); });
          return r;
        });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(function (cached) {
      var fetched = fetch(e.request).then(function (response) {
        if (response && response.status === 200) {
          var copy = response.clone();
          caches.open(CACHE).then(function (cache) { cache.put(e.request, copy); });
        }
        return response;
      }).catch(function () { return cached; });
      return cached || fetched;
    })
  );
});