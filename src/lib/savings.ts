import type { HourlyMeterData, HourlyPrice } from './types.js';

/**
 * Savings analytics for days with both meter data and prices.
 *
 * "Savings" follows the app's existing definition: what the net consumption
 * would have cost at the fixed "goedkoop" reference price minus what it
 * actually cost at dynamic prices. All per-day figures only count hours
 * that have a price, so actual and reference stay comparable.
 */
export interface DaySavings {
    date: string;
    consumptionKwh: number;   // over priced hours
    injectionKwh: number;
    netKwh: number;
    actualCost: number;       // € net cost at dynamic prices
    refCost: number;          // € net cost at the fixed reference
    savings: number;          // € refCost − actualCost (positive = saved)
    consumptionCost: number;  // € consumption only — the shiftable part
    paidAvgCent: number;      // ¢/kWh actually paid for consumption
    marketAvgCent: number;    // ¢/kWh average of all the day's hourly prices
    optimalCost: number;      // € consumption priced at the avg of the 8 cheapest hours
    shiftPotential: number;   // € consumptionCost − optimalCost
    hoursWithPrice: number;
    totalHours: number;
}

export function computeDaySavings(
    date: string,
    meter: HourlyMeterData[],
    prices: HourlyPrice[],
    cheapRefCent: number
): DaySavings | null {
    if (meter.length === 0 || prices.length === 0) return null;

    const priceByHour = new Map(prices.map((p) => [p.hour, p.centPerKwh]));

    let consumption = 0;
    let injection = 0;
    let actualCost = 0;
    let refCost = 0;
    let consumptionCost = 0;
    let hoursWithPrice = 0;

    for (const m of meter) {
        const cent = priceByHour.get(m.hour);
        if (cent === undefined) continue;
        hoursWithPrice++;
        consumption += m.consumptionKwh;
        injection   += m.injectionKwh;
        const net = m.consumptionKwh - m.injectionKwh;
        actualCost      += (net * cent) / 100;
        refCost         += (net * cheapRefCent) / 100;
        consumptionCost += (m.consumptionKwh * cent) / 100;
    }
    if (hoursWithPrice === 0) return null;

    const sortedCents = prices.map((p) => p.centPerKwh).sort((a, b) => a - b);
    const k = Math.min(8, sortedCents.length);
    const cheap8Avg     = sortedCents.slice(0, k).reduce((s, c) => s + c, 0) / k;
    const marketAvgCent = sortedCents.reduce((s, c) => s + c, 0) / sortedCents.length;
    const optimalCost   = (consumption * cheap8Avg) / 100;

    return {
        date,
        consumptionKwh: consumption,
        injectionKwh: injection,
        netKwh: consumption - injection,
        actualCost,
        refCost,
        savings: refCost - actualCost,
        consumptionCost,
        paidAvgCent: consumption > 0 ? (consumptionCost / consumption) * 100 : 0,
        marketAvgCent,
        optimalCost,
        shiftPotential: consumptionCost - optimalCost,
        hoursWithPrice,
        totalHours: meter.length
    };
}

export interface PeriodSavings {
    days: number;
    consumptionKwh: number;
    injectionKwh: number;
    netKwh: number;
    actualCost: number;
    refCost: number;
    savings: number;
    consumptionCost: number;  // € consumption only — base for shift-potential %
    paidAvgCent: number;      // consumption-weighted
    marketAvgCent: number;    // plain average over the days
    shiftPotential: number;
    isComplete: boolean;      // every meter hour had a price
}

export function aggregateSavings(days: DaySavings[]): PeriodSavings | null {
    if (days.length === 0) return null;

    let consumption = 0, injection = 0, actualCost = 0, refCost = 0;
    let consumptionCost = 0, shiftPotential = 0, marketSum = 0;
    let pricedHours = 0, totalHours = 0;

    for (const d of days) {
        consumption     += d.consumptionKwh;
        injection       += d.injectionKwh;
        actualCost      += d.actualCost;
        refCost         += d.refCost;
        consumptionCost += d.consumptionCost;
        shiftPotential  += d.shiftPotential;
        marketSum       += d.marketAvgCent;
        pricedHours     += d.hoursWithPrice;
        totalHours      += d.totalHours;
    }

    return {
        days: days.length,
        consumptionKwh: consumption,
        injectionKwh: injection,
        netKwh: consumption - injection,
        actualCost,
        refCost,
        savings: refCost - actualCost,
        consumptionCost,
        paidAvgCent: consumption > 0 ? (consumptionCost / consumption) * 100 : 0,
        marketAvgCent: marketSum / days.length,
        shiftPotential,
        isComplete: pricedHours === totalHours
    };
}

/** ISO date of the Monday of the week containing the given date. */
export function mondayOf(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    const ref = new Date(Date.UTC(y, m - 1, d));
    ref.setUTCDate(d - ((ref.getUTCDay() + 6) % 7));
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${ref.getUTCFullYear()}-${pad(ref.getUTCMonth() + 1)}-${pad(ref.getUTCDate())}`;
}
