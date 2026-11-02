/* Nomad Club — service worker (Lot 6).
 * - Ressources statiques (/_next/static, /img, /icons) : cache d'abord (fichiers versionnés).
 * - Pages : réseau d'abord, copie en cache pour les pages publiques et l'espace membre (hors messages et données),
 *   page « Hors ligne » si rien n'est disponible. Les espaces fondatrices, partenaire et pro ne sont jamais mis en cache.
 * - Le cache des pages est vidé à la déconnexion (?au-revoir ou ?deconnexion).
 * - Notifications push : affichage et ouverture du lien.
 */
const VERSION = "nc-v1";
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;
const OFFLINE = "/hors-ligne";
const PRECACHE = [OFFLINE, "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/img/logotype-clair.png", "/img/monogramme-clair.png"];
const MAX_PAGES = 40;

const NEVER_CACHE = [/^\/fondatrices/, /^\/partenaire/, /^\/pro(\/|$)/, /^\/api\//, /^\/auth\//, /^\/connexion/, /^\/espace\/cercle/, /^\/espace\/moi\/donnees/, /^\/mes-donnees/, /^\/billet\//];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC);
      await Promise.all(PRECACHE.map((u) => cache.add(new Request(u, { cache: "reload" })).catch(() => undefined)));
      // ressources de la page hors ligne (CSS, polices, scripts) pour qu'elle s'affiche sans réseau
      try {
        const html = await (await fetch(OFFLINE, { cache: "reload" })).text();
        const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s)]+/g) || [])];
        await Promise.all(assets.map((u) => cache.add(u).catch(() => undefined)));
      } catch {
        /* hors ligne pendant l'installation : on réessaiera à la prochaine version */
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "logout") event.waitUntil(caches.delete(PAGES));
});

async function trimPages() {
  const cache = await caches.open(PAGES);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_PAGES; i++) await cache.delete(keys[i]);
}

async function handleNavigation(request, url) {
  if (url.searchParams.has("au-revoir") || url.searchParams.has("deconnexion")) await caches.delete(PAGES);
  const cacheable = !NEVER_CACHE.some((re) => re.test(url.pathname));
  try {
    const response = await fetch(request);
    if (cacheable && response.ok && response.type === "basic") {
      const copy = response.clone();
      const cache = await caches.open(PAGES);
      await cache.put(url.pathname, copy);
      trimPages();
    }
    return response;
  } catch {
    const cached = cacheable ? await caches.match(url.pathname, { cacheName: PAGES }) : undefined;
    return cached || (await caches.match(OFFLINE)) || new Response("Hors ligne", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}

async function handleStatic(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC);
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request, url));
    return;
  }
  if (/^\/(_next\/static|img|icons)\//.test(url.pathname) || url.pathname === "/manifest.webmanifest") {
    event.respondWith(handleStatic(request));
  }
  // le reste (données des pages, API) passe directement par le réseau
});

/* ---------- notifications push ---------- */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Nomad Club", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Nomad Club";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag || undefined,
      data: { link: typeof data.link === "string" && data.link.startsWith("/") && !data.link.startsWith("//") ? data.link : "/espace/notifications" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of all) {
        if (new URL(c.url).origin === self.location.origin && "focus" in c) {
          await c.focus();
          if ("navigate" in c) await c.navigate(link);
          return;
        }
      }
      await self.clients.openWindow(link);
    })(),
  );
});
