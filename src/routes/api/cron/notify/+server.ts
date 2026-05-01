import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import webpush from 'web-push';
import { env } from '$env/dynamic/private';
import { fetchFromApx, fetchFromEntsoe } from '$lib/apiParser.js';
import {
    getCurrentBelgianHour,
    getTodayBelgian,
    getAlertLevel,
    getPushPayload
} from '$lib/priceUtils.js';
import {
    getAllSubscriptions,
    removeSubscription,
    hasNotifiedThisHour,
    markNotifiedThisHour
} from '$lib/server/subscriptions.js';

export const GET: RequestHandler = async () => {
    const { env: pubEnv } = await import('$env/dynamic/public');
    const PUBLIC_VAPID_KEY = pubEnv.PUBLIC_VAPID_KEY ?? '';

    if (!env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT || !PUBLIC_VAPID_KEY) {
        throw error(500, 'VAPID keys not configured');
    }

    webpush.setVapidDetails(env.VAPID_SUBJECT, PUBLIC_VAPID_KEY, env.VAPID_PRIVATE_KEY);

    const today = getTodayBelgian();
    const currentHour = getCurrentBelgianHour();
    const hourKey = `${today}:${currentHour}`;

    // Fetch today's prices
    let prices;
    try {
        const result = await fetchFromApx(today);
        prices = result;
    } catch {
        if (env.ENTSOE_API_KEY) {
            const result = await fetchFromEntsoe(today, env.ENTSOE_API_KEY);
            prices = result;
        } else {
            throw error(502, 'Could not fetch prices');
        }
    }

    const currentPrice = prices.find((p) => p.hour === currentHour);
    if (!currentPrice) {
        return json({ notified: 0, skipped: 0, reason: 'no price for current hour' });
    }

    // Only notify for red and amber
    if (currentPrice.alertLevel !== 'red' && currentPrice.alertLevel !== 'amber') {
        return json({ notified: 0, skipped: 0, reason: `alert level ${currentPrice.alertLevel}` });
    }

    const subscriptions = await getAllSubscriptions();
    let notified = 0;
    let skipped = 0;

    await Promise.all(
        subscriptions.map(async (stored) => {
            const subHourKey = `${stored.id}:${hourKey}`;

            // Re-compute alert level with subscription's own thresholds
            const alertLevel = getAlertLevel(currentPrice.centPerKwh, stored.thresholds);
            if (alertLevel !== 'red' && alertLevel !== 'amber') {
                skipped++;
                return;
            }

            // Deduplicate: don't send more than once per hour per subscription
            if (await hasNotifiedThisHour(stored.id, hourKey)) {
                skipped++;
                return;
            }

            const payload = getPushPayload({ ...currentPrice, alertLevel });

            try {
                await webpush.sendNotification(
                    stored.subscription as webpush.PushSubscription,
                    JSON.stringify(payload)
                );
                await markNotifiedThisHour(stored.id, subHourKey);
                notified++;
            } catch (err: unknown) {
                const httpErr = err as { statusCode?: number };
                if (httpErr.statusCode === 410 || httpErr.statusCode === 404) {
                    await removeSubscription(stored.subscription.endpoint!);
                } else {
                    console.error('Push send failed:', err);
                }
                skipped++;
            }
        })
    );

    return json({ notified, skipped, date: today, hour: currentHour });
};
