import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchFromApx, fetchFromEntsoe } from '$lib/apiParser.js';
import { getTodayBelgian } from '$lib/priceUtils.js';
import { DEFAULT_THRESHOLDS } from '$lib/priceUtils.js';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async ({ url }) => {
    const date = url.searchParams.get('date') ?? getTodayBelgian();

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw error(400, 'Invalid date format, expected YYYY-MM-DD');
    }

    const thresholds = DEFAULT_THRESHOLDS;

    // 1. Try APX Group REST API (used by Eneco BE, no auth required)
    try {
        const prices = await fetchFromApx(date, thresholds);
        return json(
            { date, prices },
            {
                headers: {
                    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600'
                }
            }
        );
    } catch (apxErr) {
        console.warn('APX fetch failed, trying ENTSO-E:', apxErr);
    }

    // 2. Fallback: ENTSO-E Transparency Platform (requires API key)
    const entsoeKey = env.ENTSOE_API_KEY;
    if (entsoeKey) {
        try {
            const prices = await fetchFromEntsoe(date, entsoeKey, thresholds);
            return json(
                { date, prices },
                {
                    headers: {
                        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600'
                    }
                }
            );
        } catch (entsoeErr) {
            console.error('ENTSO-E fetch failed:', entsoeErr);
        }
    }

    throw error(
        502,
        'Could not fetch electricity prices. Check APX API availability or configure ENTSOE_API_KEY.'
    );
};
