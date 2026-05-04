import { XMLParser } from 'fast-xml-parser';
import {
    eurMWhToCentPerKwh,
    formatEntsoePeriod,
    getAlertLevel,
    getMidnightBrusselsAsUTC
} from './priceUtils.js';
import { DEFAULT_THRESHOLDS } from './priceUtils.js';
import type { HourlyPrice, Thresholds } from './types.js';

// ---------------------------------------------------------------------------
// Primary source: Eneco BE Dynamic Pricing API (no auth required)
// ---------------------------------------------------------------------------
const ENECO_URL =
    'https://api-prd.be-digitalcore.enecogroup.com/eneco-be/xapi/site/api/v1/pricing/dynamic';

export async function fetchFromEneco(
    dateStr: string,
    thresholds: Thresholds = DEFAULT_THRESHOLDS
): Promise<HourlyPrice[]> {
    const params = new URLSearchParams({
        startDate: dateStr,
        endDate: dateStr,
        aggregation: 'hourly'
    });

    const res = await fetch(`${ENECO_URL}?${params}`, {
        next: { revalidate: 3600 }
    } as RequestInit);
    if (!res.ok) throw new Error(`Eneco HTTP ${res.status}`);

    const body = await res.json();
    const records: Array<{ date: string; time: string; price: number }> =
        body?.data?.records;

    if (!Array.isArray(records) || records.length === 0) {
        throw new Error('Eneco: no records found in response');
    }

    return records.map((record) => {
        const hour = Number(record.time.split(':')[0]);
        const eurMWh = record.price;
        const centPerKwh = eurMWhToCentPerKwh(eurMWh);
        const utcMs =
            getMidnightBrusselsAsUTC(dateStr).getTime() + hour * 3_600_000;
        return {
            hour,
            eurMWh,
            centPerKwh,
            alertLevel: getAlertLevel(centPerKwh, thresholds),
            isoTimestamp: new Date(utcMs).toISOString()
        };
    });
}

// ---------------------------------------------------------------------------
// Secondary source: APX Group REST API (used by Eneco BE, no auth required)
// ---------------------------------------------------------------------------
const APX_URL = 'http://www.apxgroup.com/rest-api/quotes/';

export async function fetchFromApx(
    dateStr: string,
    thresholds: Thresholds = DEFAULT_THRESHOLDS
): Promise<HourlyPrice[]> {
    const res = await fetch(APX_URL, { next: { revalidate: 3600 } } as RequestInit);
    if (!res.ok) throw new Error(`APX HTTP ${res.status}`);
    const data = await res.json();

    // APX returns an array sorted newest-first. Find the entry for our date.
    const entry = (Array.isArray(data) ? data : [data]).find((item: Record<string, unknown>) => {
        const d = item['date'] ?? item['Date'] ?? item['deliveryDate'] ?? '';
        return String(d).startsWith(dateStr);
    });

    if (!entry) throw new Error(`APX: no data found for ${dateStr}`);

    // Prices may be under entry.values.BE or entry.belpexPrices or entry.prices.BE
    const rawPrices: number[] =
        entry?.values?.BE ??
        entry?.belpex ??
        entry?.prices?.BE ??
        entry?.BE ??
        entry?.belpexPrices;

    if (!Array.isArray(rawPrices) || rawPrices.length === 0) {
        throw new Error('APX: could not extract Belgian prices from response');
    }

    return rawPrices.map((eurMWh: number, index: number) => {
        const centPerKwh = eurMWhToCentPerKwh(eurMWh);
        return {
            hour: index,
            eurMWh,
            centPerKwh,
            alertLevel: getAlertLevel(centPerKwh, thresholds),
            isoTimestamp: new Date(
                getMidnightBrusselsAsUTC(dateStr).getTime() + index * 3_600_000
            ).toISOString()
        };
    });
}

// ---------------------------------------------------------------------------
// Fallback source: ENTSO-E Transparency Platform (requires API key)
// ---------------------------------------------------------------------------
const ENTSOE_URL = 'https://web-api.tp.entsoe.eu/api';
const BE_DOMAIN = '10YBE----------2';

export async function fetchFromEntsoe(
    dateStr: string,
    apiKey: string,
    thresholds: Thresholds = DEFAULT_THRESHOLDS
): Promise<HourlyPrice[]> {
    const start = getMidnightBrusselsAsUTC(dateStr);
    const end = new Date(start.getTime() + 24 * 3_600_000);

    const params = new URLSearchParams({
        securityToken: apiKey,
        documentType: 'A44',
        in_Domain: BE_DOMAIN,
        out_Domain: BE_DOMAIN,
        periodStart: formatEntsoePeriod(start),
        periodEnd: formatEntsoePeriod(end)
    });

    const res = await fetch(`${ENTSOE_URL}?${params}`, { next: { revalidate: 3600 } } as RequestInit);
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`ENTSO-E HTTP ${res.status}: ${body.slice(0, 200)}`);
    }

    const xml = await res.text();
    return parseEntsoeXml(xml, dateStr, start, thresholds);
}

function parseEntsoeXml(
    xml: string,
    dateStr: string,
    periodStart: Date,
    thresholds: Thresholds
): HourlyPrice[] {
    const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: true });
    const doc = parser.parse(xml);

    const root =
        doc['Publication_MarketDocument'] ?? doc['GL_MarketDocument'] ?? doc;
    const timeSeries = root?.TimeSeries ?? root?.timeSeries;
    const series = Array.isArray(timeSeries) ? timeSeries[0] : timeSeries;
    const period = series?.Period ?? series?.period;

    if (!period) throw new Error('ENTSO-E: no Period found in XML');

    const points = period?.Point ?? period?.point;
    const pointArray: Array<{ position: number; 'price.amount': number }> = Array.isArray(points)
        ? points
        : [points];

    return pointArray.map((pt) => {
        const position = Number(pt['position']);
        const eurMWh = Number(pt['price.amount']);
        const utcMs = periodStart.getTime() + (position - 1) * 3_600_000;
        const localHour = Number(
            new Intl.DateTimeFormat('en', {
                hour: 'numeric',
                hour12: false,
                timeZone: 'Europe/Brussels'
            }).format(new Date(utcMs))
        );
        const centPerKwh = eurMWhToCentPerKwh(eurMWh);
        return {
            hour: localHour,
            eurMWh,
            centPerKwh,
            alertLevel: getAlertLevel(centPerKwh, thresholds),
            isoTimestamp: new Date(utcMs).toISOString()
        };
    });
}
