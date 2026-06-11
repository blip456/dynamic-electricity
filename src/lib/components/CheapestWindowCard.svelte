<script lang="ts">
    import type { HourlyPrice, Thresholds } from '$lib/types.js';
    import { findCheapestWindow, getAlertLevel, formatEuroPrice } from '$lib/priceUtils.js';
    import { settings } from '$lib/stores.svelte.js';

    let {
        prices,
        thresholds,
        fromHour = 0,
        isToday = false
    }: {
        prices: HourlyPrice[];
        thresholds: Thresholds;
        fromHour?: number;
        isToday?: boolean;
    } = $props();

    const pad = (n: number) => String(n).padStart(2, '0');

    const win   = $derived(findCheapestWindow(prices, settings.windowHours, fromHour));
    const level = $derived(win ? getAlertLevel(win.avgCentPerKwh, thresholds) : null);

    const LEVEL_TEXT: Record<string, string> = {
        green: 'text-green-600',
        blue:  'text-blue-600',
        amber: 'text-amber-600',
        red:   'text-red-600'
    };

    const startsIn = $derived.by(() => {
        if (!win || !isToday) return null;
        const diff = win.startHour - fromHour;
        return diff <= 0 ? 'nu bezig' : diff === 1 ? 'over 1 uur' : `over ${diff} uur`;
    });
</script>

<div class="bg-card rounded-2xl border shadow-sm p-4 flex flex-col gap-2">
    <div class="flex items-center justify-between">
        <h2 class="text-sm font-medium text-muted-foreground">
            Goedkoopste blok {isToday ? '(rest van vandaag)' : ''}
        </h2>
        <div class="flex gap-1">
            {#each [1, 2, 3, 4] as h}
                <button
                    onclick={() => settings.windowHours = h}
                    class="text-xs font-medium px-2 py-1 rounded-lg transition-colors tabular-nums
                        {settings.windowHours === h
                            ? 'bg-foreground text-background'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground'}"
                >{h}u</button>
            {/each}
        </div>
    </div>

    {#if win && level}
        <div class="flex items-baseline gap-3 flex-wrap">
            <span class="text-2xl font-bold tabular-nums">
                {pad(win.startHour)}:00–{pad(win.endHour)}:00
            </span>
            <span class="text-sm font-semibold tabular-nums {LEVEL_TEXT[level]}">
                gem. {formatEuroPrice(win.avgCentPerKwh)}/kWh
            </span>
            {#if startsIn}
                <span class="text-xs text-muted-foreground">{startsIn}</span>
            {/if}
        </div>
    {:else}
        <p class="text-sm text-muted-foreground">
            Geen blok van {settings.windowHours} uur meer {isToday ? 'vandaag' : 'op deze dag'}.
        </p>
    {/if}
</div>
