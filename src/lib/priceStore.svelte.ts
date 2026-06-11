import { browser } from '$app/environment';
import type { HourlyPrice } from './types.js';
import { getTodayBelgian } from './priceUtils.js';

const STORAGE_KEY = 'ew-price-cache';

/**
 * Client-side price cache. Day-ahead prices for past days are immutable,
 * so they persist in localStorage — the stats page can aggregate months of
 * history without re-fetching on every visit. Today/tomorrow are kept in
 * memory only.
 */
class PriceStore {
    data = $state<Record<string, HourlyPrice[]>>({});

    load() {
        if (!browser) return;
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) this.data = JSON.parse(raw);
        } catch {}
    }

    merge(incoming: Record<string, HourlyPrice[]>) {
        let pastChanged = false;
        const today = getTodayBelgian();
        for (const [date, prices] of Object.entries(incoming)) {
            if (!prices || prices.length === 0) continue;
            this.data[date] = prices;
            if (date < today) pastChanged = true;
        }
        if (pastChanged) this.persist();
    }

    forDate(date: string): HourlyPrice[] | null {
        return this.data[date] ?? null;
    }

    private persist() {
        if (!browser) return;
        const today = getTodayBelgian();
        const past: Record<string, HourlyPrice[]> = {};
        for (const [date, prices] of Object.entries(this.data)) {
            if (date < today) past[date] = prices;
        }
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(past));
        } catch {
            // quota exceeded — cache is an optimization, never fatal
        }
    }
}

export const priceStore = new PriceStore();
