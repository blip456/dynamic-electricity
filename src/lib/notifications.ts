import type { Thresholds } from './types.js';

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const buf = new ArrayBuffer(rawData.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < rawData.length; i++) view[i] = rawData.charCodeAt(i);
    return buf;
}

export async function subscribeToPush(
    vapidPublicKey: string,
    thresholds: Thresholds
): Promise<boolean> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('Push not supported in this browser');
        return false;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const registration = await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        });
    }

    const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON(), thresholds })
    });

    return res.ok;
}

export async function unsubscribeFromPush(): Promise<void> {
    if (!('serviceWorker' in navigator)) return;
    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.getSubscription();
    if (!sub) return;

    await sub.unsubscribe();
    await fetch('/api/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint })
    });
}

export async function getNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) return 'denied';
    return Notification.permission;
}
