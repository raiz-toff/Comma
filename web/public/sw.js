/**
 * COMMA service worker — static shell only.
 * IndexedDB / app data never flows through fetch; this worker does not cache mutations,
 * cross-origin, query-string, or non-GET requests.
 */
import { CACHE_NAME, CACHE_FILES } from './sw-manifest.js';

/** Paths allowed for runtime cache updates (same as precache list). */
function shellPathnames() {
  return new Set(
    CACHE_FILES.map((rel) => {
      const u = new URL(rel, self.location.href);
      return u.pathname;
    }),
  );
}

function isWebManifestPath(pathname) {
  return pathname.endsWith('/manifest.json');
}

/**
 * The HTML entry document (and the unhashed `bundle.css`). These MUST stay network-first (like
 * manifest.json) because they are NOT content-hashed in their filenames. The prod build fingerprints
 * the JS bundle (`bundle-<hash>.js`, safe to cache-first — a new build mints a new filename), but
 * `index.html` — which references whichever bundle is current — keeps a stable URL. Serve a stale
 * `index.html` cache-first and the browser loads the OLD bundle filename → old JS whose declared
 * Dexie/IndexedDB schema version is LOWER than the DB the browser already upgraded on a prior visit
 * → IndexedDB refuses to open it (VersionError) → the app dead-ends at "Could not open local
 * database." Network-first keeps the running code in lockstep with the on-disk schema; cache is the
 * offline fallback only. (initDatabase() still auto-recovers if skew slips through anyway.)
 */
function isAppCodePath(pathname) {
  return (
    pathname.endsWith('/index.html') ||
    pathname.endsWith('/') ||
    pathname.endsWith('/bundle.css')
  );
}

/** Network-first + cache fallback so app code/HTML never goes stale against an upgraded local DB. */
async function handleAppCodeGet(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const networkRes = await fetch(request);
    if (networkRes.ok) {
      await cache.put(request, networkRes.clone());
    }
    return networkRes;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const shell = await cache.match(new Request(new URL('./index.html', self.location.href)));
      if (shell) return shell;
    }
    return new Response('', { status: 503, statusText: 'Offline' });
  }
}

/** Network-first + cache fallback so manifest changes propagate without a full SW bump. */
async function handleManifestGet(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const networkRes = await fetch(request);
    if (networkRes.ok) {
      await cache.put(request, networkRes.clone());
    }
    return networkRes;
  } catch {
    const cached =
      (await cache.match(request)) ||
      (await cache.match(new Request(new URL('./manifest.json', self.location.href))));
    if (cached) return cached;
    return new Response('', { status: 503, statusText: 'Offline' });
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(CACHE_FILES);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

/* Feature 241 — Background Sync hook (P12).
 * SW NEVER touches IndexedDB; instead it posts a message to all controlled
 * clients telling the page to replay any queued exports from Dexie appState.
 */
self.addEventListener('sync', (event) => {
  if (!event || event.tag !== 'comma-deferred-exports') return;
  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ includeUncontrolled: false, type: 'window' });
      for (const client of clientsList) {
        client.postMessage({ type: 'comma:replay-deferred', tag: event.tag });
      }
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') {
    event.respondWith(fetch(req));
    return;
  }
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(req));
    return;
  }
  if (url.search !== '') {
    event.respondWith(fetch(req));
    return;
  }
  // IndexedDB does not use the fetch API; no URL branch needed.

  if (isWebManifestPath(url.pathname)) {
    event.respondWith(handleManifestGet(req));
    return;
  }

  // App code + HTML entry: network-first so running code stays in lockstep with the on-disk
  // IndexedDB schema version (prevents the stale-bundle VersionError → "could not open database").
  if (req.mode === 'navigate' || isAppCodePath(url.pathname)) {
    event.respondWith(handleAppCodeGet(req));
    return;
  }

  event.respondWith(handleShellGet(req));
});

async function handleShellGet(request) {
  const allowedPaths = shellPathnames();
  const pathname = new URL(request.url).pathname;
  const inShell = allowedPaths.has(pathname);

  const cache = await caches.open(CACHE_NAME);

  // Cache-first shell: offline reads hit precache; network refreshes entries in CACHE_FILES.
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const networkRes = await fetch(request);
    if (networkRes.ok && inShell) {
      await cache.put(request, networkRes.clone());
    }
    return networkRes;
  } catch (err) {
    if (request.mode === 'navigate') {
      const indexReq = new Request(new URL('./index.html', self.location.href));
      const shell = await cache.match(indexReq);
      if (shell) return shell;
    }
    if (inShell) {
      const normalized = new Request(new URL(pathname, self.location.href));
      const fromCache = await cache.match(normalized);
      if (fromCache) return fromCache;
    }
    throw err;
  }
}

self.addEventListener('notificationclick', (event) => {
  const action = event.action;
  if (!action || action === 'open_big_clock') {
    event.notification.close();
  }

  event.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({ type: 'comma:shift-action', action: action || 'open_big_clock' });
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('./#/dashboard').then((client) => {
          if (client) {
            setTimeout(() => {
              client.postMessage({ type: 'comma:shift-action', action: action || 'open_big_clock' });
            }, 1000);
          }
        });
      }
    })
  );
});
