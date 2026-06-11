import { browser } from '$app/environment';
import { DEFAULT_THRESHOLDS } from './priceUtils.js';
import type { Thresholds } from './types.js';

const STORAGE_KEY = 'ew-settings';

class Settings {
    green = $state(DEFAULT_THRESHOLDS.green);
    amber = $state(DEFAULT_THRESHOLDS.amber);
    blue = $state(DEFAULT_THRESHOLDS.blue);
    notificationsEnabled = $state(false);
    windowHours = $state(3); // cheapest-window planner block duration (1–4)

    load() {
        if (!browser) return;
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);
            if (typeof data.green === 'number') this.green = data.green;
            if (typeof data.amber === 'number') this.amber = data.amber;
            if (typeof data.blue === 'number') this.blue = data.blue;
            if (typeof data.notificationsEnabled === 'boolean')
                this.notificationsEnabled = data.notificationsEnabled;
            if (typeof data.windowHours === 'number' && data.windowHours >= 1 && data.windowHours <= 4)
                this.windowHours = data.windowHours;
        } catch {}
    }

    save() {
        if (!browser) return;
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                green: this.green,
                amber: this.amber,
                blue: this.blue,
                notificationsEnabled: this.notificationsEnabled,
                windowHours: this.windowHours
            })
        );
    }

    reset() {
        this.green = DEFAULT_THRESHOLDS.green;
        this.amber = DEFAULT_THRESHOLDS.amber;
        this.blue = DEFAULT_THRESHOLDS.blue;
        this.save();
    }

    get thresholds(): Thresholds {
        return { green: this.green, amber: this.amber, blue: this.blue };
    }
}

export const settings = new Settings();
