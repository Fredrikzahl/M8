// Liten tjenestearbeider som gjør at appen kan installeres og åpnes uten nett.
// Selve siden hentes fra nettet først, slik at en ny versjon alltid slår gjennom.
// Filer med innholdsbasert navn (assets/) endrer seg aldri og hentes fra lageret.
const CACHE = 'planm8-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'
  if (url.origin !== self.location.origin && !fonts) return

  const keep = res => {
    if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)) }
    return res
  }
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(keep).catch(() => caches.match(req).then(r => r || caches.match('./'))))
    return
  }
  if (url.pathname.includes('/assets/') || fonts) {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(keep)))
    return
  }
  e.respondWith(fetch(req).then(keep).catch(() => caches.match(req)))
})
