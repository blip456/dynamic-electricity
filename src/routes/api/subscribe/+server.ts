import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
    saveSubscription,
    removeSubscription
} from '$lib/server/subscriptions.js';
import { DEFAULT_THRESHOLDS } from '$lib/priceUtils.js';
import type { Thresholds } from '$lib/types.js';

export const GET: RequestHandler = async () => {
    const { env: pubEnv } = await import('$env/dynamic/public');
    return json({ key: pubEnv.PUBLIC_VAPID_KEY ?? '' });
};

export const POST: RequestHandler = async ({ request }) => {
    let body: { subscription: PushSubscriptionJSON; thresholds?: Thresholds };
    try {
        body = await request.json();
    } catch {
        throw error(400, 'Invalid JSON');
    }

    if (!body.subscription?.endpoint) {
        throw error(400, 'Missing subscription endpoint');
    }

    const thresholds = body.thresholds ?? DEFAULT_THRESHOLDS;
    const id = await saveSubscription(body.subscription, thresholds);

    return json({ ok: true, id }, { status: 201 });
};

export const DELETE: RequestHandler = async ({ request }) => {
    let body: { endpoint: string };
    try {
        body = await request.json();
    } catch {
        throw error(400, 'Invalid JSON');
    }

    if (!body.endpoint) throw error(400, 'Missing endpoint');

    await removeSubscription(body.endpoint);
    return json({ ok: true });
};
