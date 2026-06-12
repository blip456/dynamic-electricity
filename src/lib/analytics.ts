import { browser, dev } from '$app/environment';

// The Google tag (gtag.js) itself is installed in src/app.html, exactly as
// Google's setup snippet prescribes, so page views — including SPA
// navigations via GA4's enhanced measurement — are tracked automatically.
// This module only sends custom feature events on top of that.

type EventParams = Record<string, string | number | boolean | undefined>;

declare global {
    interface Window {
        gtag?: (...args: unknown[]) => void;
    }
}

export function trackEvent(name: string, params: EventParams = {}): void {
    if (!browser || dev || !window.gtag) return;
    window.gtag('event', name, params);
}
