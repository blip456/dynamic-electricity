import { browser } from '$app/environment';

// Google Analytics 4 (gtag.js). Initialised from the root layout with the
// measurement ID supplied via PUBLIC_GA_MEASUREMENT_ID; every function is a
// no-op when the ID is missing (local dev) or on the server.

type EventParams = Record<string, string | number | boolean | undefined>;

declare global {
    interface Window {
        dataLayer: unknown[];
        gtag: (...args: unknown[]) => void;
    }
}

let initialized = false;

export function initAnalytics(measurementId: string): void {
    if (!browser || !measurementId || initialized) return;
    initialized = true;

    window.dataLayer = window.dataLayer || [];
    // gtag requires the Arguments object itself on the dataLayer — a spread
    // array is silently ignored by the GA library.
    window.gtag = function () {
        // eslint-disable-next-line prefer-rest-params
        window.dataLayer.push(arguments);
    };
    window.gtag('js', new Date());
    // Page views are sent manually from the layout's afterNavigate hook,
    // so SPA navigations are counted exactly once.
    window.gtag('config', measurementId, { send_page_view: false });

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);
}

export function trackPageView(path: string): void {
    if (!initialized) return;
    window.gtag('event', 'page_view', {
        page_path: path,
        page_location: location.origin + path,
        page_title: document.title
    });
}

export function trackEvent(name: string, params: EventParams = {}): void {
    if (!initialized) return;
    window.gtag('event', name, params);
}
