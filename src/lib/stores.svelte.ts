import { browser } from '$app/environment';
import { DEFAULT_THRESHOLDS } from './priceUtils.js';
import type { Thresholds } from './types.js';

const STORAGE_KEY = 'ew-settings';

class Settings {
    red = $state(DEFAULT_THRESHOLDS.red);
    amber = $state(DEFAULT_THRESHOLDS.amber);
    notificationsEnabled = $state(false);

    load() {
        if (!browser) return;
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);
            if (typeof data.red === 'number') this.red = data.red;
            if (typeof data.amber === 'number') this.amber = data.amber;
            if (typeof data.notificationsEnabled === 'boolean')
                this.notificationsEnabled = data.notificationsEnabled;
        } catch {}
    }

    save() {
        if (!browser) return;
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                red: this.red,
                amber: this.amber,
                notificationsEnabled: this.notificationsEnabled
            })
        );
    }

    get thresholds(): Thresholds {
        return { red: this.red, amber: this.amber };
    }
}

export const settings = new Settings();
