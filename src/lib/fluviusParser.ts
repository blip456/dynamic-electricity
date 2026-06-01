import type { HourlyMeterData } from './types.js';

export interface ParseResult {
    data: Record<string, HourlyMeterData[]>; // keyed by YYYY-MM-DD
    rowsRead: number;
    daysFound: number;
}

/**
 * Parse a Fluvius digital-meter CSV/TSV export.
 * Handles both tab-separated and semicolon-separated files.
 * Aggregates 15-min intervals into hourly totals.
 */
export function parseFluviusCsv(text: string): ParseResult {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return { data: {}, rowsRead: 0, daysFound: 0 };

    // Auto-detect separator from header line
    const sep = lines[0].includes('\t') ? '\t' : ';';
    const dataLines = lines.slice(1); // skip header

    // Accumulate per date → hour → {consumption, injection}
    const acc: Record<string, Record<number, { consumption: number; injection: number }>> = {};
    let rowsRead = 0;

    for (const line of dataLines) {
        const cols = line.split(sep);
        if (cols.length < 10) continue;

        const fromDate  = cols[0].trim(); // DD-MM-YYYY
        const fromTime  = cols[1].trim(); // HH:MM:SS
        const register  = cols[7].trim(); // "Afname Nacht", "Injectie Dag", …
        const volumeStr = cols[8].trim(); // "0,026" (Belgian decimal comma)

        if (!fromDate || !fromTime || !register || !volumeStr) continue;

        // "01-05-2026" → "2026-05-01"
        const parts = fromDate.split('-');
        if (parts.length !== 3) continue;
        const isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;

        const hour = parseInt(fromTime.split(':')[0], 10);
        if (isNaN(hour)) continue;

        const volume = parseFloat(volumeStr.replace(',', '.'));
        if (isNaN(volume)) continue;

        const isConsumption = register.startsWith('Afname');
        const isInjection   = register.startsWith('Injectie');
        if (!isConsumption && !isInjection) continue;

        acc[isoDate] ??= {};
        acc[isoDate][hour] ??= { consumption: 0, injection: 0 };

        if (isConsumption) acc[isoDate][hour].consumption += volume;
        if (isInjection)   acc[isoDate][hour].injection   += volume;

        rowsRead++;
    }

    const data: Record<string, HourlyMeterData[]> = {};
    for (const [date, hours] of Object.entries(acc)) {
        data[date] = Object.entries(hours)
            .map(([h, v]) => ({
                hour:            parseInt(h, 10),
                consumptionKwh:  Math.round(v.consumption * 1000) / 1000,
                injectionKwh:    Math.round(v.injection   * 1000) / 1000
            }))
            .sort((a, b) => a.hour - b.hour);
    }

    return { data, rowsRead, daysFound: Object.keys(data).length };
}
