import type { PageLoad } from './$types';
import { getTodayBelgian } from '$lib/priceUtils.js';
import { browser } from '$app/environment';
import type { PricesResponse } from '$lib/types.js';

function offsetDate(date: string, days: number): string {
    const [y, m, d] = date.split('-').map(Number);
    const dt = new Date(y, m - 1, d + days);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

export const load: PageLoad = async ({ fetch, url }) => {
    const date = url.searchParams.get('date') ?? getTodayBelgian();

    // Warm adjacent days into the browser's HTTP cache so navigating ±1 day is instant.
    // Only runs client-side — browser cache only exists there, and we don't want
    // unnecessary upstream requests during SSR.
    if (browser) {
        fetch(`/api/prices?date=${offsetDate(date, -1)}`).catch(() => {});
        fetch(`/api/prices?date=${offsetDate(date,  1)}`).catch(() => {});
    }

    const res = await fetch(`/api/prices?date=${date}`);
    if (!res.ok) {
        return { date, prices: [], error: `HTTP ${res.status}` };
    }

    const data: PricesResponse = await res.json();
    return { date: data.date, prices: data.prices, error: null };
};
