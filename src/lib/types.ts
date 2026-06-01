export type AlertLevel = 'green' | 'blue' | 'amber' | 'red';

export interface HourlyPrice {
    hour: number; // 0–23 local Belgian hour
    eurMWh: number;
    centPerKwh: number; // eurMWh / 10
    alertLevel: AlertLevel;
    isoTimestamp: string; // UTC ISO 8601
}

export interface Thresholds {
    green: number; // ≤ this → making money (green), default -20¢/kWh
    amber: number; // ≤ this → below zero (blue),    default 0¢/kWh
    blue: number;  // ≤ this → cheap (amber),         default 10¢/kWh
    // above blue → expensive (red)
}

export interface PricesResponse {
    date: string; // YYYY-MM-DD (Belgian local)
    prices: HourlyPrice[];
}

export interface StoredSubscription {
    id: string;
    subscription: PushSubscriptionJSON;
    thresholds: Thresholds;
    createdAt: string;
}

export interface HourlyMeterData {
    hour: number;            // 0–23
    consumptionKwh: number;  // Afname Dag + Nacht summed for this hour
    injectionKwh: number;    // Injectie Dag + Nacht (solar export)
}

export interface PushPayload {
    title: string;
    body: string;
    alertLevel: AlertLevel;
    price: number;
    hour: number;
    url: string;
}
