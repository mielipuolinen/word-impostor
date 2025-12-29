/*
  Service Worker (no external libs)

  Goals:
  - Reliable offline support (app-shell fallback for navigations)
  - Safe precaching (install doesn't fail because one file 404s)
  - Runtime caching with sensible strategies
  - Fast updates (skipWaiting + clientsClaim + cache cleanup)
  - Use platform features when available (Navigation Preload)

  Notes for iOS:
  - Service Worker support exists, but background features are limited.
  - Navigation Preload may not be available; code below guards it.
*/

// Shared version constant (also used by the page).
// This keeps the icon filename tag in one place.
importScripts("./version.js");

const APP_PREFIX = "sanahuijari";

const ICON_VERSION = globalThis.SANAHUIJARI_ICON_VERSION || "v3.0";

// Bump this when you change the list of precached files.
// (In bigger apps this is usually replaced by a build-generated hash.)
const APP_VERSION = "3.0.6";

const CACHE_NAMES = {
  precache: `${APP_PREFIX}-precache-v${APP_VERSION}`,
  runtime: `${APP_PREFIX}-runtime-v${APP_VERSION}`
};

// App-shell used as offline fallback for navigations.
const APP_SHELL_URL = "./index.html";

// Keep this list small and stable.
// Anything frequently changing should be runtime-cached instead.
function iconPath(baseName) {
  return `./icons/${baseName}.${ICON_VERSION}.png`;
}

const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./version.js",
  "./vendor/jquery-3.7.1.min.js",
  "./app.js",
  "./styles.css",
  "./i18n.json",
  "./words.json",
  "./Sanahuijari.md",
  "./manifest.v3.0.json",
  iconPath("icon-192"),
  iconPath("icon-512"),
  iconPath("apple-touch-icon"),
  iconPath("favicon-32"),
  iconPath("favicon-16"),
  iconPath("logo")
];

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isNavigationRequest(request) {
  if (request.mode === "navigate") return true;
  if (request.destination === "document") return true;
  const accept = request.headers.get("accept") || "";
  return accept.includes("text/html");
}

function isAssetRequest(request, url) {
  const dest = request.destination;
  if (dest === "script" || dest === "style" || dest === "image" || dest === "font") return true;

  return (
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".jpeg") ||
    url.pathname.endsWith(".webp") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico")
  );
}

function isDataRequest(url) {
  return (
    url.pathname.endsWith(".json") ||
    url.pathname.endsWith(".md")
  );
}

async function cachePutSafe(cache, request, response) {
  // Cache only successful same-origin responses.
  if (!response) return;
  if (response.type !== "basic") return;
  if (!response.ok) return;
  await cache.put(request, response);
}

async function precacheAll() {
  const cache = await caches.open(CACHE_NAMES.precache);

  // Avoid install failures due to a single missing file.
  // Also bypass the HTTP cache so updates propagate.
  const results = await Promise.allSettled(
    PRECACHE_URLS.map(async (url) => {
      const request = new Request(url, { cache: "reload" });
      const response = await fetch(request);
      await cachePutSafe(cache, request, response.clone());
    })
  );

  // Surface failures in DevTools while still allowing install.
  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length) {
    // eslint-disable-next-line no-console
    console.warn(
      `[SW] Precache finished with ${failed.length} failure(s).`,
      failed.map((f) => f.reason)
    );
  }
}

async function cleanupCaches() {
  const expected = new Set(Object.values(CACHE_NAMES));
  const keys = await caches.keys();
  await Promise.all(
    keys.map((key) => {
      if (expected.has(key)) return null;
      if (!key.startsWith(`${APP_PREFIX}-`)) return null;
      return caches.delete(key);
    })
  );
}

async function enableNavigationPreload() {
  // Speeds up navigations by starting the network request in parallel.
  if (!self.registration?.navigationPreload) return;
  try {
    await self.registration.navigationPreload.enable();
  } catch {
    // Ignore unsupported/blocked environments.
  }
}

async function networkFirst(request, { cacheName, timeoutMs } = {}) {
  const cache = await caches.open(cacheName);

  const tryNetwork = async () => {
    const response = await fetch(request);
    await cachePutSafe(cache, request, response.clone());
    return response;
  };

  if (!timeoutMs) {
    try {
      return await tryNetwork();
    } catch {
      return cache.match(request);
    }
  }

  // Optional timeout for flaky connections.
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("network-timeout")), timeoutMs)
  );

  try {
    return await Promise.race([tryNetwork(), timeout]);
  } catch {
    return cache.match(request);
  }
}

async function cacheFirst(request, { cacheName } = {}) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;

  try {
    const response = await fetch(request);
    await cachePutSafe(cache, request, response.clone());
    return response;
  } catch {
    return cached;
  }
}

async function staleWhileRevalidate(request, { cacheName } = {}) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreSearch: true });

  const revalidate = (async () => {
    try {
      const response = await fetch(request);
      await cachePutSafe(cache, request, response.clone());
      return response;
    } catch {
      return null;
    }
  })();

  return cached || (await revalidate);
}

async function handleNavigation(event) {
  // Prefer Navigation Preload response if available.
  const preloadResponse = await event.preloadResponse;
  if (preloadResponse) return preloadResponse;

  // Network-first for navigations so content stays fresh.
  const response = await networkFirst(event.request, {
    cacheName: CACHE_NAMES.runtime,
    timeoutMs: 3000
  });

  if (response) return response;

  // Offline fallback.
  const precache = await caches.open(CACHE_NAMES.precache);
  const shell = await precache.match(APP_SHELL_URL, { ignoreSearch: true });
  if (shell) return shell;

  return new Response("Offline", {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  });
}

async function handleRequest(event) {
  const request = event.request;
  if (request.method !== "GET") return fetch(request);

  const url = new URL(request.url);
  if (!isSameOrigin(url)) return fetch(request);

  if (isNavigationRequest(request)) return handleNavigation(event);

  // If it was precached, serve it quickly.
  const precache = await caches.open(CACHE_NAMES.precache);
  const precached = await precache.match(request, { ignoreSearch: true });
  if (precached) return precached;

  // Runtime strategies.
  if (isAssetRequest(request, url)) {
    return staleWhileRevalidate(request, { cacheName: CACHE_NAMES.runtime });
  }

  if (isDataRequest(url)) {
    return networkFirst(request, { cacheName: CACHE_NAMES.runtime, timeoutMs: 4000 });
  }

  // Default: cache-first to keep things snappy.
  return cacheFirst(request, { cacheName: CACHE_NAMES.runtime });
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheAll());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await cleanupCaches();
      await enableNavigationPreload();
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event));
});

// Allow the page to trigger an immediate update.
// In the app you can do:
// navigator.serviceWorker.controller?.postMessage({ type: 'SKIP_WAITING' })
self.addEventListener("message", (event) => {
  const msg = event.data;
  if (!msg || typeof msg !== "object") return;

  if (msg.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (msg.type === "GET_VERSION") {
    event.source?.postMessage({
      type: "VERSION",
      version: APP_VERSION,
      caches: CACHE_NAMES
    });
  }
});
