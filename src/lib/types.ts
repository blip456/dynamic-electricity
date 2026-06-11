export type AlertLevel = 'green' | 'blue' | 'amber' | 'red';

export interface HourlyPrice {
    hour: number; // 0–23 local Belgian hour
    eurMWh: number;
    centPerKwh: number; // eurMWh / 10
    alertLevel: AlertLevel;
    isoTimestamp: string; // UTC ISO 8601
}

export interface Thresholds {
    earn: number;     // ≤ this → green "verdien geld", default −20 ¢/kWh
    nearFree: number; // ≤ this → blue "bijna gratis",  default 0 ¢/kWh
    cheap: number;    // ≤ this → amber "goedkoop",     default 15 ¢/kWh
    // above cheap → red "duur"
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
