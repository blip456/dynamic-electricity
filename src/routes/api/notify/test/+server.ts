import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import webpush from 'web-push';
import { env } from '$env/dynamic/private';

export const POST: RequestHandler = async ({ request }) => {
    const { env: pubEnv } = await import('$env/dynamic/public');
    const PUBLIC_VAPID_KEY = pubEnv.PUBLIC_VAPID_KEY ?? '';

    if (!env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT || !PUBLIC_VAPID_KEY) {
        throw error(500, 'VAPID keys not configured');
    }

    webpush.setVapidDetails(env.VAPID_SUBJECT, PUBLIC_VAPID_KEY, env.VAPID_PRIVATE_KEY);

    let body: { subscription: PushSubscriptionJSON };
    try {
        body = await request.json();
    } catch {
        throw error(400, 'Invalid JSON');
    }

    if (!body.subscription?.endpoint) {
        throw error(400, 'Missing subscription');
    }

    const payload = JSON.stringify({
        title: '🔔 Testmelding',
        body: 'Je meldingen werken correct!',
        alertLevel: 'blue',
        price: 0,
        hour: 0,
        url: '/'
    });

    try {
        await webpush.sendNotification(body.subscription as webpush.PushSubscription, payload);
        return json({ ok: true });
    } catch (err) {
        console.error('Test notification failed:', err);
        throw error(502, 'Failed to send test notification');
    }
};
