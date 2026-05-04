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
// Primary source: Fraunhofer ISE energy-charts.info (no auth required)
// Provides EPEX SPOT day-ahead prices for Belgium.
// ---------------------------------------------------------------------------
const ENERGY_CHARTS_URL = 'https://api.energy-charts.info/price';

export async function fetchFromEnergyCharts(
    dateStr: string,
    thresholds: Thresholds = DEFAULT_THRESHOLDS
): Promise<HourlyPrice[]> {
    // Build start/end in ISO 8601 local time for Brussels (UTC+1/+2)
    const midnight = getMidnightBrusselsAsUTC(dateStr);
    const nextMidnight = new Date(midnight.getTime() + 24 * 3_600_000);

    const fmt = (d: Date) => d.toISOString().replace('.000Z', '+00:00');
    const params = new URLSearchParams({
        bzn: 'BE',
        start: fmt(midnight),
        end: fmt(nextMidnight)
    });

    const res = await fetch(`${ENERGY_CHARTS_URL}?${params}`, {
        headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error(`energy-charts HTTP ${res.status}`);

    const body: { unix_seconds: number[]; price: number[] } = await res.json();

    if (!Array.isArray(body.unix_seconds) || body.unix_seconds.length === 0) {
        throw new Error('energy-charts: empty response');
    }

    return body.unix_seconds.map((unixSec, i) => {
        const eurMWh = body.price[i];
        const centPerKwh = eurMWhToCentPerKwh(eurMWh);
        const ts = new Date(unixSec * 1000);
        const localHour = Number(
            new Intl.DateTimeFormat('en', {
                hour: 'numeric',
                hour12: false,
                timeZone: 'Europe/Brussels'
            }).format(ts)
        );
        return {
            hour: localHour,
            eurMWh,
            centPerKwh,
            alertLevel: getAlertLevel(centPerKwh, thresholds),
            isoTimestamp: ts.toISOString()
        };
    });
}

// ---------------------------------------------------------------------------
// Fallback: ENTSO-E Transparency Platform (requires free API key)
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

    const res = await fetch(`${ENTSOE_URL}?${params}`);
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`ENTSO-E HTTP ${res.status}: ${body.slice(0, 200)}`);
    }

    const xml = await res.text();
    return parseEntsoeXml(xml, start, thresholds);
}

function parseEntsoeXml(
    xml: string,
    periodStart: Date,
    thresholds: Thresholds
): HourlyPrice[] {
    const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: true });
    const doc = parser.parse(xml);

    const root = doc['Publication_MarketDocument'] ?? doc['GL_MarketDocument'] ?? doc;
    const timeSeries = root?.TimeSeries ?? root?.timeSeries;
    const series = Array.isArray(timeSeries) ? timeSeries[0] : timeSeries;
    const period = series?.Period ?? series?.period;

    if (!period) throw new Error('ENTSO-E: no Period found in XML');

    const points = period?.Point ?? period?.point;
    const pointArray: Array<{ position: number; 'price.amount': number }> =
        Array.isArray(points) ? points : [points];

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
