export type AlertLevel = 'red' | 'amber' | 'green' | 'normal';

export interface HourlyPrice {
    hour: number; // 0–23 local Belgian hour
    eurMWh: number;
    centPerKwh: number; // eurMWh / 10
    alertLevel: AlertLevel;
    isoTimestamp: string; // UTC ISO 8601
}

export interface Thresholds {
    red: number; // default -20 c/kWh
    amber: number; // default 0 c/kWh
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

export interface PushPayload {
    title: string;
    body: string;
    alertLevel: AlertLevel;
    price: number;
    hour: number;
    url: string;
}
