<script lang="ts">
    import type { HourlyPrice, Thresholds } from '$lib/types.js';
    import AlertBadge from './AlertBadge.svelte';
    import { getCurrentBelgianHour, formatEuroPrice, getAlertLevel, ALERT_NAMES } from '$lib/priceUtils.js';

    let { price, thresholds }: { price: HourlyPrice; thresholds: Thresholds } = $props();

    const alertLevel = $derived(getAlertLevel(price.centPerKwh, thresholds));

    const hour = getCurrentBelgianHour();
    const nextHour = (hour + 1) % 24;

    const cardBg: Record<string, string> = {
        green: 'bg-green-50 border-green-200',
        blue: 'bg-blue-50 border-blue-200',
        amber: 'bg-amber-50 border-amber-200',
        red: 'bg-red-50 border-red-200'
    };

    const priceColor: Record<string, string> = {
        green: 'text-green-600',
        blue: 'text-blue-600',
        amber: 'text-amber-600',
        red: 'text-red-600'
    };
</script>

<div class="rounded-2xl border p-5 {cardBg[alertLevel]}">
    <div class="flex items-start justify-between gap-4">
        <div>
            <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Huidige prijs · {String(hour).padStart(2, '0')}:00–{String(nextHour).padStart(2, '0')}:00
            </p>
            <div class="flex items-baseline gap-1">
                <span class="text-4xl font-bold tabular-nums {priceColor[alertLevel]}">
                    {formatEuroPrice(price.centPerKwh)}
                </span>
                <span class="text-lg font-medium text-muted-foreground">/kWh</span>
            </div>
            <p class="text-xs text-muted-foreground mt-1">
                {(price.eurMWh).toFixed(2).replace('.', ',')} €/MWh
            </p>
        </div>

        <AlertBadge level={alertLevel} label={ALERT_NAMES[alertLevel]} />
    </div>
</div>
