import type { AlertLevel, HourlyPrice, PushPayload, Thresholds } from './types.js';

export const DEFAULT_THRESHOLDS: Thresholds = { red: -20, amber: 0 };

export function eurMWhToCentPerKwh(eurMWh: number): number {
    return eurMWh / 10;
}

export function getAlertLevel(centPerKwh: number, thresholds: Thresholds): AlertLevel {
    if (centPerKwh <= thresholds.red) return 'red';
    if (centPerKwh <= thresholds.amber) return 'amber';
    if (centPerKwh <= 10) return 'green';
    return 'normal';
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

export function formatBelgianDate(dateStr: string): string {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return new Intl.DateTimeFormat('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' }).format(
        date
    );
}

export function getPushPayload(price: HourlyPrice): PushPayload {
    const messages: Record<AlertLevel, { title: string; body: string }> = {
        red: {
            title: '🔴 Negatieve stroomprijs!',
            body: `Prijs nu ${price.centPerKwh.toFixed(1)}¢/kWh — u verdient geld bij stroomverbruik!`
        },
        amber: {
            title: '🟡 Stroomprijs onder nul',
            body: `Prijs nu ${price.centPerKwh.toFixed(1)}¢/kWh — bijna gratis stroom!`
        },
        green: {
            title: '🟢 Goedkope stroom',
            body: `Prijs nu ${price.centPerKwh.toFixed(1)}¢/kWh — goedkoop moment!`
        },
        normal: {
            title: 'Stroomprijs update',
            body: `Prijs nu ${price.centPerKwh.toFixed(1)}¢/kWh`
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
