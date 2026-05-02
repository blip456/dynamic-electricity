/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

declare let self: ServiceWorkerGlobalScope;

const CACHE = `stroom-${version}`;
const ASSETS = [...build, ...files];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(CACHE)
            .then((cache) => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
            )
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    if (event.request.url.includes('/api/')) return; // never cache API calls

    event.respondWith(
        caches.match(event.request).then((cached) => cached ?? fetch(event.request))
    );
});

// ---------------------------------------------------------------------------
// Web Push
// ---------------------------------------------------------------------------
self.addEventListener('push', (event) => {
    if (!event.data) return;

    let data: { title: string; body: string; alertLevel: string; hour: number; url?: string };
    try {
        data = event.data.json();
    } catch {
        return;
    }

    const options: NotificationOptions = {
        body: data.body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: `price-alert-${data.hour}`,
        renotify: data.alertLevel === 'green' || data.alertLevel === 'red',
        data: { url: data.url ?? '/' }
    };

    event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url: string = event.notification.data?.url ?? '/';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            const existing = clients.find((c) => c.url.includes(url));
            if (existing) return existing.focus();
            return self.clients.openWindow(url);
        })
    );
});

self.addEventListener('pushsubscriptionchange', (event) => {
    event.waitUntil(
        self.registration.pushManager
            .getSubscription()
            .then((sub) => sub?.unsubscribe())
            .then(() =>
                fetch('/api/subscribe')
                    .then((r) => r.json())
                    .then(({ key }: { key: string }) => {
                        const padding = '='.repeat((4 - (key.length % 4)) % 4);
                        const base64 = (key + padding).replace(/-/g, '+').replace(/_/g, '/');
                        const rawData = atob(base64);
                        const buf = new ArrayBuffer(rawData.length);
                        const view = new Uint8Array(buf);
                        for (let i = 0; i < rawData.length; i++) view[i] = rawData.charCodeAt(i);
                        return self.registration.pushManager.subscribe({
                            userVisibleOnly: true,
                            applicationServerKey: buf
                        });
                    })
            )
            .then((subscription) =>
                fetch('/api/subscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ subscription: subscription.toJSON() })
                })
            )
    );
});
