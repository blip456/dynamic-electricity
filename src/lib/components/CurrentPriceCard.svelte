<script lang="ts">
    import type { HourlyPrice } from '$lib/types.js';
    import AlertBadge from './AlertBadge.svelte';
    import { getCurrentBelgianHour } from '$lib/priceUtils.js';

    let { price }: { price: HourlyPrice } = $props();

    const hour = getCurrentBelgianHour();
    const nextHour = (hour + 1) % 24;

    const cardBg: Record<string, string> = {
        red: 'bg-red-50 border-red-200',
        amber: 'bg-amber-50 border-amber-200',
        green: 'bg-green-50 border-green-200',
        normal: 'bg-card border-border'
    };

    const priceColor: Record<string, string> = {
        red: 'text-red-600',
        amber: 'text-amber-600',
        green: 'text-green-600',
        normal: 'text-foreground'
    };
</script>

<div class="rounded-2xl border p-5 {cardBg[price.alertLevel]}">
    <div class="flex items-start justify-between gap-4">
        <div>
            <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Huidige prijs · {String(hour).padStart(2, '0')}:00–{String(nextHour).padStart(2, '0')}:00
            </p>
            <div class="flex items-baseline gap-1">
                <span class="text-4xl font-bold tabular-nums {priceColor[price.alertLevel]}">
                    {price.centPerKwh.toFixed(1)}
                </span>
                <span class="text-lg font-medium text-muted-foreground">¢/kWh</span>
            </div>
            <p class="text-xs text-muted-foreground mt-1">
                {(price.eurMWh).toFixed(2)} €/MWh
            </p>
        </div>

        <AlertBadge level={price.alertLevel} label={{
            red: 'Verdien geld!',
            amber: 'Onder nul',
            green: 'Goedkoop',
            normal: 'Normaal'
        }[price.alertLevel]} />
    </div>
</div>
