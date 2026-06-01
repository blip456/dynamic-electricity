import { browser } from '$app/environment';
import type { HourlyMeterData } from './types.js';

const STORAGE_KEY = 'ew-meter-data';

class MeterStore {
    data = $state<Record<string, HourlyMeterData[]>>({});

    load() {
        if (!browser) return;
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) this.data = JSON.parse(raw);
        } catch {}
    }

    merge(incoming: Record<string, HourlyMeterData[]>) {
        this.data = { ...this.data, ...incoming };
        this.persist();
    }

    clear() {
        this.data = {};
        if (browser) localStorage.removeItem(STORAGE_KEY);
    }

    forDate(date: string): HourlyMeterData[] {
        return this.data[date] ?? [];
    }

    get dateCount() { return Object.keys(this.data).length; }

    get dateRange(): { from: string; to: string } | null {
        const dates = Object.keys(this.data).sort();
        if (dates.length === 0) return null;
        return { from: dates[0], to: dates[dates.length - 1] };
    }

    private persist() {
        if (browser) localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    }
}

export const meterStore = new MeterStore();
