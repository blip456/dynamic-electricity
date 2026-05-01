import type { PageLoad } from './$types';
import { getTodayBelgian } from '$lib/priceUtils.js';
import type { PricesResponse } from '$lib/types.js';

export const load: PageLoad = async ({ fetch, url }) => {
    const date = url.searchParams.get('date') ?? getTodayBelgian();

    const res = await fetch(`/api/prices?date=${date}`);
    if (!res.ok) {
        return { date, prices: [], error: `HTTP ${res.status}` };
    }

    const data: PricesResponse = await res.json();
    return { date: data.date, prices: data.prices, error: null };
};
