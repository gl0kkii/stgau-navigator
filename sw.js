/* =====================================================================
   Офлайн-режим навигатора (service worker)
   ---------------------------------------------------------------------
   После первого открытия сайт целиком сохраняется на телефоне и потом
   открывается без интернета: кабинеты, этажи, маршруты, столовые.
   Страница: сначала пробуем сеть (чтобы обновления приходили сразу),
   если сеть не ответила за 3.5 секунды — показываем сохранённую копию.
   Запросы к серверу Студент+ (workers.dev) не трогаем — их данные
   страница сама хранит у себя.
   Чтобы принудительно обновить кэш у всех — поменяйте номер версии.
   ===================================================================== */

const CACHE = 'stgau-nav-v1';
const PAGE = './index.html';
const NETWORK_TIMEOUT = 3500;

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE)
            .then(cache => cache.addAll(['./', PAGE]))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

// При белых списках запрос часто не падает, а висит — поэтому ждём не дольше таймаута
function fetchWithTimeout(request) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT);
        fetch(request).then(
            res => { clearTimeout(timer); resolve(res); },
            err => { clearTimeout(timer); reject(err); }
        );
    });
}

async function pageRequest(request) {
    const cache = await caches.open(CACHE);
    try {
        const res = await fetchWithTimeout(request);
        if (res.ok) cache.put(PAGE, res.clone());
        return res;
    } catch (err) {
        return (await cache.match(PAGE)) || (await cache.match('./')) || Response.error();
    }
}

// Остальное (скрипт Telegram, картинки): отдаём из кэша сразу и тихо обновляем
async function assetRequest(event) {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(event.request);
    const update = fetch(event.request)
        .then(res => { if (res.ok || res.type === 'opaque') cache.put(event.request, res.clone()); return res; })
        .catch(() => cached || Response.error());
    if (cached) { event.waitUntil(update); return cached; }
    return update;
}

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.hostname.endsWith('workers.dev')) return;

    if (request.mode === 'navigate') {
        event.respondWith(pageRequest(request));
    } else if (url.origin === self.location.origin || url.hostname === 'telegram.org') {
        event.respondWith(assetRequest(event));
    }
});
