import type { AlertLevel, HourlyPrice, PushPayload, Thresholds } from './types.js';

export const DEFAULT_THRESHOLDS: Thresholds = { earn: -20, nearFree: 0, cheap: 15 };

// Shape used before the thresholds were renamed: the fields were named after
// colours, and confusingly `amber` bounded the blue level and `blue` the
// amber level. Persisted data (localStorage, KV subscriptions) may still
// carry this shape.
interface LegacyThresholds {
    green: number;
    amber: number;
    blue: number;
}

/** Accept current, legacy, or unknown threshold data and return the current shape. */
export function normalizeThresholds(raw: unknown): Thresholds {
    const r = raw as Partial<Thresholds & LegacyThresholds> | null | undefined;
    if (r && typeof r.earn === 'number' && typeof r.nearFree === 'number' && typeof r.cheap === 'number') {
        return { earn: r.earn, nearFree: r.nearFree, cheap: r.cheap };
    }
    if (r && typeof r.green === 'number' && typeof r.amber === 'number' && typeof r.blue === 'number') {
        return { earn: r.green, nearFree: r.amber, cheap: r.blue };
    }
    return { ...DEFAULT_THRESHOLDS };
}

export function eurMWhToCentPerKwh(eurMWh: number): number {
    return eurMWh / 10;
}

export function formatEuroPrice(centPerKwh: number): string {
    return '€' + (centPerKwh / 100).toFixed(4).replace('.', ',');
}

// Compact 2-decimal variant for legends and labels
export function formatEuroPriceShort(centPerKwh: number): string {
    return '€' + (centPerKwh / 100).toFixed(2).replace('.', ',');
}

// Display names for the four price categories — single source of truth for
// the legends, the current-price badge, and the settings page.
export const ALERT_NAMES: Record<AlertLevel, string> = {
    green: 'Verdien geld',
    blue:  'Bijna gratis',
    amber: 'Goedkoop',
    red:   'Duur'
};

/**
 * Legend label with the user's actual threshold boundary,
 * e.g. "Goedkoop (≤ €0,15)".
 */
export function getAlertLegendLabel(level: AlertLevel, thresholds: Thresholds): string {
    const bounds: Record<AlertLevel, string> = {
        green: `≤ ${formatEuroPriceShort(thresholds.earn)}`,
        blue:  `≤ ${formatEuroPriceShort(thresholds.nearFree)}`,
        amber: `≤ ${formatEuroPriceShort(thresholds.cheap)}`,
        red:   `> ${formatEuroPriceShort(thresholds.cheap)}`
    };
    return `${ALERT_NAMES[level]} (${bounds[level]})`;
}

export function getAlertLevel(centPerKwh: number, thresholds: Thresholds): AlertLevel {
    if (centPerKwh <= thresholds.earn) return 'green';     // making money
    if (centPerKwh <= thresholds.nearFree) return 'blue';  // (nearly) free
    if (centPerKwh <= thresholds.cheap) return 'amber';    // cheap
    return 'red';                                          // expensive
}

export function getTodayBelgian(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' }).format(new Date());
}

export function getTomorrowBelgian(): string {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' }).format(d);
}

export function getCurrentBelgianHour(): number {
    return Number(
        new Intl.DateTimeFormat('en', {
            hour: 'numeric',
            hour12: false,
            timeZone: 'Europe/Brussels'
        }).format(new Date())
    );
}

export function isTomorrowAvailable(): boolean {
    return getCurrentBelgianHour() >= 14;
}

export interface CheapestWindow {
    startHour: number;     // inclusive
    endHour: number;       // exclusive
    avgCentPerKwh: number;
}

/**
 * Find the cheapest contiguous block of `durationHours` within a day,
 * considering only windows starting at or after `fromHour` (e.g. the current
 * hour, so "run the dishwasher now or later" advice never points backwards).
 * Windows with missing hours are skipped. Returns null when no complete
 * window fits.
 */
export function findCheapestWindow(
    prices: HourlyPrice[],
    durationHours: number,
    fromHour = 0
): CheapestWindow | null {
    const byHour = new Map(prices.map((p) => [p.hour, p.centPerKwh]));
    let best: CheapestWindow | null = null;

    for (let start = fromHour; start + durationHours <= 24; start++) {
        let sum = 0;
        let complete = true;
        for (let h = start; h < start + durationHours; h++) {
            const cent = byHour.get(h);
            if (cent === undefined) { complete = false; break; }
            sum += cent;
        }
        if (!complete) continue;
        const avg = sum / durationHours;
        if (!best || avg < best.avgCentPerKwh) {
            best = { startHour: start, endHour: start + durationHours, avgCentPerKwh: avg };
        }
    }
    return best;
}

export function formatBelgianDate(dateStr: string): string {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return new Intl.DateTimeFormat('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' }).format(
        date
    );
}

export function getPushPayload(price: HourlyPrice): PushPayload {
    const messages: Record<AlertLevel, { title: string; body: string }> = {
        green: {
            title: '🟢 Negatieve stroomprijs!',
            body: `Prijs nu ${formatEuroPrice(price.centPerKwh)}/kWh — u verdient geld bij stroomverbruik!`
        },
        blue: {
            title: '🔵 Stroom bijna gratis',
            body: `Prijs nu ${formatEuroPrice(price.centPerKwh)}/kWh — bijna gratis stroom!`
        },
        amber: {
            title: '🟡 Goedkope stroom',
            body: `Prijs nu ${formatEuroPrice(price.centPerKwh)}/kWh — goedkoop moment!`
        },
        red: {
            title: '🔴 Dure stroom!',
            body: `Prijs nu ${formatEuroPrice(price.centPerKwh)}/kWh — stroomprijs is hoog!`
        }
    };
    const msg = messages[price.alertLevel];
    return {
        title: msg.title,
        body: msg.body,
        alertLevel: price.alertLevel,
        price: price.centPerKwh,
        hour: price.hour,
        url: '/'
    };
}

export function getBrusselsUtcOffset(dateStr: string): number {
    const [year, month, day] = dateStr.split('-').map(Number);
    // Check Brussels offset at 11:00 UTC on the given day (avoids DST boundary at midnight)
    const ref = new Date(Date.UTC(year, month - 1, day, 11, 0, 0));
    const brusselsHour = Number(
        new Intl.DateTimeFormat('en', {
            hour: 'numeric',
            hour12: false,
            timeZone: 'Europe/Brussels'
        }).format(ref)
    );
    // CET = UTC+1 → hour 12; CEST = UTC+2 → hour 13
    return brusselsHour - 11;
}

export function getMidnightBrusselsAsUTC(dateStr: string): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    const offset = getBrusselsUtcOffset(dateStr);
    // midnight Brussels = UTC(year, month-1, day, -offset)
    return new Date(Date.UTC(year, month - 1, day, -offset, 0, 0));
}

export function formatEntsoePeriod(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}`;
}
