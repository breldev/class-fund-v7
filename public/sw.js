var CACHE = "classfund-v10";

// No precache — everything is fetched on demand from the network.
// This prevents SW install failure from breaking the page.

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
  // Activate immediately — no precache needed
  self.skipWaiting();
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

  // Class routes: always fetch from server (never cached)
  if (isClassRoute(reqUrl)) {
    e.respondWith(fetch(e.request));
    return;
  }

  // API routes: always fetch from server (never cached)
  if (isApiRoute(reqUrl)) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Static assets: network-first, fall back to cache
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

  // Everything else: network-first, fall back to cache
  e.respondWith(
    fetch(e.request).then(function (response) {
      if (response && response.status === 200) {
        var copy = response.clone();
        caches.open(CACHE).then(function (cache) { cache.put(e.request, copy); });
      }
      return response;
    }).catch(function () {
      return caches.match(e.request) || new Response("Offline", { status: 503, statusText: "Offline" });
    })
  );
});
