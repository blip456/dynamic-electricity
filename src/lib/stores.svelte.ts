import { browser } from '$app/environment';
import { DEFAULT_THRESHOLDS, normalizeThresholds } from './priceUtils.js';
import type { Thresholds } from './types.js';

const STORAGE_KEY = 'ew-settings';

class Settings {
    earn = $state(DEFAULT_THRESHOLDS.earn);
    nearFree = $state(DEFAULT_THRESHOLDS.nearFree);
    cheap = $state(DEFAULT_THRESHOLDS.cheap);
    notificationsEnabled = $state(false);
    windowHours = $state(3); // cheapest-window planner block duration (1–4)

    load() {
        if (!browser) return;
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);

            // Thresholds: accepts both the current shape and the legacy
            // colour-named one ({green, amber, blue}); the next save()
            // persists the current shape, completing the migration.
            const t = normalizeThresholds(data);
            this.earn = t.earn;
            this.nearFree = t.nearFree;
            this.cheap = t.cheap;

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
                earn: this.earn,
                nearFree: this.nearFree,
                cheap: this.cheap,
                notificationsEnabled: this.notificationsEnabled,
                windowHours: this.windowHours
            })
        );
    }

    reset() {
        this.earn = DEFAULT_THRESHOLDS.earn;
        this.nearFree = DEFAULT_THRESHOLDS.nearFree;
        this.cheap = DEFAULT_THRESHOLDS.cheap;
        this.save();
    }

    get thresholds(): Thresholds {
        return { earn: this.earn, nearFree: this.nearFree, cheap: this.cheap };
    }
}

export const settings = new Settings();
