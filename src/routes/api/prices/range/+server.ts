import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchFromEneco, fetchFromApx, fetchFromEntsoe } from '$lib/apiParser.js';
import { DEFAULT_THRESHOLDS, getTodayBelgian } from '$lib/priceUtils.js';
import { env } from '$env/dynamic/private';
import type { HourlyPrice } from '$lib/types.js';

async function fetchDay(date: string, entsoeKey: string | undefined): Promise<HourlyPrice[]> {
    try { return await fetchFromEneco(date, DEFAULT_THRESHOLDS); } catch { /* try next */ }
    try { return await fetchFromApx(date, DEFAULT_THRESHOLDS); } catch { /* try next */ }
    if (entsoeKey) {
        try { return await fetchFromEntsoe(date, entsoeKey, DEFAULT_THRESHOLDS); } catch { /* give up */ }
    }
    return [];
}

export const GET: RequestHandler = async ({ url }) => {
    const from = url.searchParams.get('from') ?? '';
    const to   = url.searchParams.get('to')   ?? '';

    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
        throw error(400, 'Expected from and to as YYYY-MM-DD with from ≤ to');
    }

    const today   = getTodayBelgian();
    const entsoeKey = env.ENTSOE_API_KEY;

    // Collect dates in range, capped at today and max 31 days
    const dates: string[] = [];
    const cursor = new Date(from + 'T00:00:00Z');
    const end    = new Date(to   + 'T00:00:00Z');
    while (cursor <= end && dates.length < 31) {
        const iso = cursor.toISOString().slice(0, 10);
        if (iso <= today) dates.push(iso);
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    const results = await Promise.all(dates.map((d) => fetchDay(d, entsoeKey)));

    const prices: Record<string, HourlyPrice[]> = {};
    dates.forEach((d, i) => { if (results[i].length > 0) prices[d] = results[i]; });

    return json({ prices }, {
        headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600' }
    });
};
