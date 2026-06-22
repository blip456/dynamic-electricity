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

    // Did the consumption land below the day's average hourly price?
    const cheaperThanMarket = $derived(stats ? stats.paidAvgCent <= stats.marketAvgCent : true);
    const timingPct = $derived(
        stats && stats.marketAvgCent !== 0
            ? ((stats.paidAvgCent - stats.marketAvgCent) / Math.abs(stats.marketAvgCent)) * 100
            : 0
    );
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

        <div class="p-4 flex flex-col gap-3">
            <!-- Cost comparison: actual (dynamic) vs fixed reference -->
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <p class="text-xs text-muted-foreground mb-0.5">Werkelijke kost</p>
                    <p class="font-bold text-xl tabular-nums {stats.actualCost < 0 ? 'text-green-600' : 'text-foreground'}">
                        {fmtEur(stats.actualCost)}
                    </p>
                </div>
                <div>
                    <p class="text-xs text-muted-foreground mb-0.5">Aan vaste prijs</p>
                    <p class="font-semibold text-xl tabular-nums text-muted-foreground">{fmtEur(stats.refCost)}</p>
                    <p class="text-[10px] text-muted-foreground">{formatEuroPrice(thresholds.cheap)}/kWh</p>
                </div>
            </div>

            <div class="border-t"></div>

            <!-- Savings vs fixed price -->
            <div class="flex items-center justify-between gap-3">
                <span class="text-xs text-muted-foreground">
                    {stats.savings >= 0 ? 'Bespaard t.o.v. vaste prijs' : 'Meer betaald dan vaste prijs'}
                </span>
                <span class="inline-flex items-center gap-1.5">
                    <span class="font-bold text-lg tabular-nums {stats.savings >= 0 ? 'text-green-600' : 'text-red-600'}">
                        {fmtEur(stats.savings)}
                    </span>
                    <span class="text-[11px] font-medium tabular-nums {stats.savings >= 0 ? 'text-green-600' : 'text-red-600'}">
                        ({savingsPct >= 0 ? '−' : '+'}{Math.abs(savingsPct).toFixed(0)}%)
                    </span>
                </span>
            </div>

            <!-- Your avg price vs the day's average hourly price (color-coded) -->
            <div class="flex items-center justify-between gap-3">
                <span class="text-xs text-muted-foreground">Gem. betaald vs gem. uurprijs</span>
                <span class="inline-flex items-center gap-1.5 text-sm tabular-nums">
                    <span class="font-semibold {cheaperThanMarket ? 'text-green-600' : 'text-red-600'}">
                        {formatEuroPrice(stats.paidAvgCent)}
                    </span>
                    <span class="text-muted-foreground/70">vs {formatEuroPrice(stats.marketAvgCent)}</span>
                    <span class="inline-flex items-center {cheaperThanMarket ? 'text-green-600' : 'text-red-600'}">
                        {#if cheaperThanMarket}<TrendingDown size={14} />{:else}<TrendingUp size={14} />{/if}
                        <span class="text-[11px] font-medium">{Math.abs(timingPct).toFixed(0)}%</span>
                    </span>
                </span>
            </div>
        </div>
    </div>
{/if}
