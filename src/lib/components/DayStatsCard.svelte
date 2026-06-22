<script lang="ts">
    import { TrendingDown, TrendingUp, ChartColumn } from '@lucide/svelte';
    import type { HourlyPrice, HourlyMeterData, Thresholds } from '$lib/types.js';
    import { computeDaySavings } from '$lib/savings.js';
    import { formatEuroPrice } from '$lib/priceUtils.js';

    let {
        date,
        prices,
        meter,
        thresholds,
        isToday = false
    }: {
        date: string;
        prices: HourlyPrice[];
        meter: HourlyMeterData[];
        thresholds: Thresholds;
        isToday?: boolean;
    } = $props();

    const stats = $derived(computeDaySavings(date, meter, prices, thresholds.cheap));

    function fmtEur(v: number): string {
        return `${v < 0 ? '−' : ''}€${Math.abs(v).toFixed(2)}`;
    }

    // Savings as a share of the fixed-price reference cost
    const savingsPct = $derived(
        stats && stats.refCost !== 0
            ? (stats.savings / Math.abs(stats.refCost)) * 100
            : 0
    );

    // Width of each cost bar relative to the larger of the two, so the bars
    // give an at-a-glance feel for "actual vs fixed".
    const barMax = $derived(stats ? Math.max(Math.abs(stats.actualCost), Math.abs(stats.refCost), 0.01) : 0.01);
    const actualWidth = $derived(stats ? Math.max(2, (Math.abs(stats.actualCost) / barMax) * 100) : 0);
    const fixedWidth  = $derived(stats ? Math.max(2, (Math.abs(stats.refCost)   / barMax) * 100) : 0);
</script>

{#if stats}
    <div class="bg-card rounded-2xl border shadow-sm overflow-hidden">
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b">
            <div>
                <h2 class="text-sm font-medium text-foreground">
                    {isToday ? 'Wat kostte je vandaag tot nu toe?' : 'Wat heeft deze dag je gekost?'}
                </h2>
                <p class="text-[11px] text-muted-foreground mt-0.5">
                    {stats.netKwh.toFixed(2)} kWh netto
                    {#if stats.injectionKwh > 0.005}
                        · {stats.consumptionKwh.toFixed(2)} verbruik · {stats.injectionKwh.toFixed(2)} injectie
                    {/if}
                    {#if !(stats.hoursWithPrice === stats.totalHours)}
                        · {stats.hoursWithPrice}/{stats.totalHours} u met prijs
                    {/if}
                </p>
            </div>
            <a
                href="/stats"
                class="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                aria-label="Naar statistieken"
            >
                <ChartColumn size={13} />
                Meer
            </a>
        </div>

        <div class="p-4 flex flex-col gap-4">
            <!-- Cost comparison: actual (dynamic) vs fixed reference -->
            <div class="flex flex-col gap-2">
                <div class="flex items-center justify-between gap-3">
                    <span class="text-xs text-muted-foreground">Werkelijke kost</span>
                    <span class="font-bold text-lg tabular-nums {stats.actualCost < 0 ? 'text-green-600' : 'text-foreground'}">
                        {fmtEur(stats.actualCost)}
                    </span>
                </div>
                <div class="h-2 rounded-full bg-muted/60 overflow-hidden">
                    <div
                        class="h-full rounded-full {stats.actualCost < 0 ? 'bg-green-500' : 'bg-amber-400'}"
                        style="width: {actualWidth}%"
                    ></div>
                </div>

                <div class="flex items-center justify-between gap-3 mt-1">
                    <span class="text-xs text-muted-foreground">
                        Aan vaste prijs ({formatEuroPrice(thresholds.cheap)}/kWh)
                    </span>
                    <span class="font-semibold text-lg tabular-nums text-muted-foreground">
                        {fmtEur(stats.refCost)}
                    </span>
                </div>
                <div class="h-2 rounded-full bg-muted/60 overflow-hidden">
                    <div class="h-full rounded-full bg-slate-400/70" style="width: {fixedWidth}%"></div>
                </div>
            </div>

            <div class="border-t"></div>

            <!-- Savings -->
            <div class="flex items-end justify-between gap-3">
                <div>
                    <p class="text-xs text-muted-foreground mb-0.5">
                        {stats.savings >= 0 ? 'Bespaard t.o.v. vaste prijs' : 'Meer betaald dan vaste prijs'}
                    </p>
                    <p class="font-bold text-2xl tabular-nums {stats.savings >= 0 ? 'text-green-600' : 'text-red-600'}">
                        {fmtEur(stats.savings)}
                    </p>
                </div>
                <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border
                    {stats.savings >= 0
                        ? 'bg-green-100 text-green-700 border-green-200'
                        : 'bg-red-100 text-red-700 border-red-200'}">
                    {#if stats.savings >= 0}<TrendingDown size={12} />{:else}<TrendingUp size={12} />{/if}
                    {savingsPct >= 0 ? '−' : '+'}{Math.abs(savingsPct).toFixed(0)}%
                </span>
            </div>

            <!-- Avg paid vs market avg -->
            <div class="grid grid-cols-2 gap-3 text-center">
                <div class="rounded-xl bg-muted/40 py-2">
                    <p class="text-[11px] text-muted-foreground">Gem. betaald</p>
                    <p class="font-semibold tabular-nums text-sm mt-0.5">{formatEuroPrice(stats.paidAvgCent)}/kWh</p>
                </div>
                <div class="rounded-xl bg-muted/40 py-2">
                    <p class="text-[11px] text-muted-foreground">Gem. uurprijs</p>
                    <p class="font-semibold tabular-nums text-sm mt-0.5">{formatEuroPrice(stats.marketAvgCent)}/kWh</p>
                </div>
            </div>
        </div>
    </div>
{/if}
