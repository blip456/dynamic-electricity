import type { StoredSubscription, Thresholds } from '../types.js';

// ---------------------------------------------------------------------------
// In-memory fallback for local development (Vercel KV not available locally)
// ---------------------------------------------------------------------------
const devStore = new Map<string, StoredSubscription>();

function hashEndpoint(endpoint: string): string {
    let hash = 0;
    for (let i = 0; i < endpoint.length; i++) {
        hash = (Math.imul(31, hash) + endpoint.charCodeAt(i)) | 0;
    }
    return Math.abs(hash).toString(36);
}

async function getKv() {
    if (!process.env.KV_REST_API_URL) return null;
    try {
        const { kv } = await import('@vercel/kv');
        return kv;
    } catch {
        return null;
    }
}

export async function saveSubscription(
    subscription: PushSubscriptionJSON,
    thresholds: Thresholds
): Promise<string> {
    const id = hashEndpoint(subscription.endpoint!);
    const data: StoredSubscription = {
        id,
        subscription,
        thresholds,
        createdAt: new Date().toISOString()
    };

    const kv = await getKv();
    if (kv) {
        await kv.set(`ew:sub:${id}`, JSON.stringify(data));
        await kv.sadd('ew:subscriptions', id);
    } else {
        devStore.set(id, data);
    }

    return id;
}

export async function getAllSubscriptions(): Promise<StoredSubscription[]> {
    const kv = await getKv();
    if (kv) {
        const ids = await kv.smembers<string[]>('ew:subscriptions');
        if (!ids || ids.length === 0) return [];
        const results = await Promise.all(ids.map((id) => kv.get<string>(`ew:sub:${id}`)));
        return results
            .filter((r): r is string => typeof r === 'string')
            .map((r) => JSON.parse(r) as StoredSubscription);
    }
    return [...devStore.values()];
}

export async function removeSubscription(endpoint: string): Promise<void> {
    const id = hashEndpoint(endpoint);
    const kv = await getKv();
    if (kv) {
        await kv.del(`ew:sub:${id}`);
        await kv.srem('ew:subscriptions', id);
    } else {
        devStore.delete(id);
    }
}

export async function hasNotifiedThisHour(subscriptionId: string, hour: string): Promise<boolean> {
    const kv = await getKv();
    if (!kv) return false;
    const key = `ew:notified:${subscriptionId}:${hour}`;
    return (await kv.get(key)) !== null;
}

export async function markNotifiedThisHour(subscriptionId: string, hour: string): Promise<void> {
    const kv = await getKv();
    if (!kv) return;
    const key = `ew:notified:${subscriptionId}:${hour}`;
    await kv.set(key, '1', { ex: 7200 }); // expire after 2 hours
}
