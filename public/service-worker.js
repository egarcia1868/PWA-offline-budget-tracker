const FILES_TO_CACHE = [
  "/",
  "/index.html",
  "/styles.css",
  "/index.js",
  "/manifest.webmanifest",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/db.js"
];


const CACHE_NAME = "static-cache-v2";
const DATA_CACHE_NAME = "data-cache-v1";

// install
// this stores all the files designated in "FILE_TO_CACHE" into the CACHE_NAME cache
self.addEventListener("install", function(evt) {
  evt.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log("Your files were pre-cached successfully!");
      return cache.addAll(FILES_TO_CACHE);
    })
  );

  self.skipWaiting();
});

// this will replace the cached data files with the new ones if the their names don't match.
self.addEventListener("activate", function(evt) {
  evt.waitUntil(
    caches.keys().then(keyList => {
      return Promise.all(
        keyList.map(key => {
          if (key !== CACHE_NAME && key !== DATA_CACHE_NAME) {
            console.log("Removing old cache data", key);
            return caches.delete(key);
          }
        })
      );
    })
  );

  self.clients.claim();
});

// fetch
self.addEventListener("fetch", function(evt) {
  if (evt.request.method !== "GET" || !evt.request.url.startsWith(self.location.origin)) {
    evt.respondWith(fetch(evt.request));
    return;
  }
  // cache successful requests to the API
  if (evt.request.url.includes("/api/")) {
    evt.respondWith(
      caches.open(DATA_CACHE_NAME).then(cache => {
        return fetch(evt.request)
          .then(response => {
            // If the response was good, clone it and store it in the cache.
            if (response.status === 200) {
              cache.put(evt.request.url, response.clone());
            }

            return response;
          })
          .catch(err => {
            // Network request failed, try to get it from the cache.
            return cache.match(evt.request);
          });
      }).catch(err => console.log(err))
    );

    return;
  }

  // if the request is not for the API, serve static assets using "offline-first" approach.
  // see https://developers.google.com/web/fundamentals/instant-and-offline/offline-cookbook#cache-falling-back-to-network
  
  evt.respondWith(
    caches.match(evt.request).then(response => {
      // if response is found in cache, pull from cache
      if (response) {
        console.log("cached --> ", response);
        return response;
      }
      // then open the data cache, take the new info and add it to the cache, clone the new "database" to the main database, then return with the updated info.
      return caches.open(DATA_CACHE_NAME).then(cache => {
        return fetch(evt.request).then(response => {
          return cache.put(evt.request, response.clone()).then(() => {
            return response;
          })
        });
      })
    })
  )
});