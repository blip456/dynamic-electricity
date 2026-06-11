import type { PageLoad } from './$types';
import { getTodayBelgian } from '$lib/priceUtils.js';
import type { HourlyPrice } from '$lib/types.js';

const pad = (n: number) => String(n).padStart(2, '0');

function isoFromDate(d: Date): string {
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

// Monday..Sunday of the week containing the given date
function weekDays(dateStr: string): string[] {
    const [y, m, d] = dateStr.split('-').map(Number);
    const ref = new Date(Date.UTC(y, m - 1, d));
    const monday = new Date(ref);
    monday.setUTCDate(d - ((ref.getUTCDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => {
        const day = new Date(monday);
        day.setUTCDate(monday.getUTCDate() + i);
        return isoFromDate(day);
    });
}

export const load: PageLoad = async ({ fetch, url }) => {
    const param = url.searchParams.get('week') ?? '';
    const ref   = /^\d{4}-\d{2}-\d{2}$/.test(param) ? param : getTodayBelgian();
    const days  = weekDays(ref);

    let prices: Record<string, HourlyPrice[]> = {};
    try {
        const res = await fetch(`/api/prices/range?from=${days[0]}&to=${days[6]}`);
        if (res.ok) prices = (await res.json()).prices;
    } catch {
        // grid renders empty cells; the page shows a hint when fully empty
    }

    return { days, prices };
};
