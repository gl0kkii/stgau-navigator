/* =====================================================================
   Офлайн-режим навигатора (service worker)
   ---------------------------------------------------------------------
   После первого открытия сайт целиком сохраняется на телефоне и потом
   открывается без интернета: кабинеты, этажи, маршруты, столовые.
   Страница: если копия уже есть, показываем её мгновенно и тихо проверяем сервер.
   Нашлась новая версия — страница сама перезагрузится, пока её ещё не трогали.
   При самом первом открытии ждём сеть.
   Запросы к серверу Студент+ (workers.dev) не трогаем — их данные
   страница сама хранит у себя.
   Чтобы принудительно обновить кэш у всех — поменяйте номер версии.
   ===================================================================== */

const CACHE = 'stgau-nav-v5';
const PAGE = './index.html';   // запускатор (лёгкий)
const APP = './app.html';      // сам навигатор
const NETWORK_TIMEOUT = 3500;

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE)
            .then(cache => cache.addAll(['./', PAGE, APP, './watermark.png']))
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
function withTimeout(promise) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT);
        promise.then(
            res => { clearTimeout(timer); resolve(res); },
            err => { clearTimeout(timer); reject(err); }
        );
    });
}

// key — под каким именем храним копию: запускатор или навигатор
async function networkFirst(request, key) {
    const cache = await caches.open(CACHE);
    // no-cache: браузер переспрашивает сервер, а не берёт свою 10-минутную копию
    const network = fetch(request.url, { cache: 'no-cache', credentials: 'same-origin' })
        .then(res => { if (res.ok) cache.put(key, res.clone()); return res; });
    // Копия уже есть — открываем мгновенно. Если на сервере новее — сообщаем странице
    const ready = (await cache.match(key)) || (key === PAGE && await cache.match('./'));
    if (ready) {
        const old = ready.clone();
        network.then(async (res) => {
            if (!res.ok || key !== APP) return;
            const [a, b] = await Promise.all([old.text(), res.clone().text()]);
            if (a === b) return;
            const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
            clients.forEach(c => c.postMessage({ type: 'stgau-updated' }));
        }).catch(() => {});
        return ready;
    }
    try {
        return await withTimeout(network);
    } catch (err) {
        const saved = (await cache.match(key)) || (key === PAGE && await cache.match('./'));
        if (saved) return saved;
        // Сохранённой копии ещё нет — ждём сеть сколько потребуется, не обрываем медленную загрузку
        return network.catch(() => Response.error());
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
    if (url.pathname.startsWith('/api/')) return;   // запросы к серверу Студент+ — мимо кэша

    if (request.mode === 'navigate') {
        event.respondWith(networkFirst(request, url.pathname.endsWith('app.html') ? APP : PAGE));
    } else if (url.origin === self.location.origin && url.pathname.endsWith('app.html')) {
        event.respondWith(networkFirst(request, APP));
    } else if (url.origin === self.location.origin || url.hostname === 'telegram.org') {
        event.respondWith(assetRequest(event));
    }
});
