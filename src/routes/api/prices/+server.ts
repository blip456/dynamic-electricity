import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchFromEnergyCharts, fetchFromEntsoe } from '$lib/apiParser.js';
import { getTodayBelgian } from '$lib/priceUtils.js';
import { DEFAULT_THRESHOLDS } from '$lib/priceUtils.js';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async ({ url }) => {
    const date = url.searchParams.get('date') ?? getTodayBelgian();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw error(400, 'Invalid date format, expected YYYY-MM-DD');
    }

    const thresholds = DEFAULT_THRESHOLDS;

    // 1. Fraunhofer ISE energy-charts.info — EPEX SPOT Belgium, no auth required
    try {
        const prices = await fetchFromEnergyCharts(date, thresholds);
        return json({ date, prices }, {
            headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600' }
        });
    } catch (err) {
        console.warn('energy-charts fetch failed, trying ENTSO-E:', err);
    }

    // 2. ENTSO-E Transparency Platform — requires free API key (ENTSOE_API_KEY env var)
    const entsoeKey = env.ENTSOE_API_KEY;
    if (entsoeKey) {
        try {
            const prices = await fetchFromEntsoe(date, entsoeKey, thresholds);
            return json({ date, prices }, {
                headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600' }
            });
        } catch (err) {
            console.error('ENTSO-E fetch failed:', err);
        }
    }

    throw error(502, 'Could not fetch electricity prices. Sources: energy-charts.info, ENTSO-E.');
};
