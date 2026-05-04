import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchFromEneco, fetchFromApx, fetchFromEntsoe } from '$lib/apiParser.js';
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

    // 1. Try Eneco BE Dynamic Pricing API (primary source)
    try {
        const prices = await fetchFromEneco(date, thresholds);
        return json(
            { date, prices },
            {
                headers: {
                    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600'
                }
            }
        );
    } catch (enecoErr) {
        console.warn('Eneco fetch failed, trying APX:', enecoErr);
    }

    // 2. Try APX Group REST API (fallback)
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

    // 3. Fallback: ENTSO-E Transparency Platform (requires API key)
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
        'Could not fetch electricity prices. All sources failed (Eneco, APX, ENTSO-E).'
    );
};
