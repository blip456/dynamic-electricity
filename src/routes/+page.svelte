<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { Settings, Maximize2, X, RotateCcw, CalendarDays } from '@lucide/svelte';
    import PriceChart from '$lib/components/PriceChart.svelte';
    import CurrentPriceCard from '$lib/components/CurrentPriceCard.svelte';
    import CheapestWindowCard from '$lib/components/CheapestWindowCard.svelte';
    import AlertBadge from '$lib/components/AlertBadge.svelte';
    import { settings } from '$lib/stores.svelte.js';
    import { meterStore } from '$lib/meterStore.svelte.js';
    import {
        getTodayBelgian,
        getTomorrowBelgian,
        getCurrentBelgianHour,
        formatBelgianDate,
        formatEuroPrice,
        getAlertLegendLabel
    } from '$lib/priceUtils.js';

    let { data } = $props();

    const today       = getTodayBelgian();
    const tomorrow    = getTomorrowBelgian();
    const currentHour = getCurrentBelgianHour();

    // Optimistic navigation: localDate updates immediately on click;
    // isNavigating shows a spinner until SvelteKit delivers new data.
    // The initial-value capture is intentional — the $effect below re-syncs
    // localDate whenever data.date changes.
    // svelte-ignore state_referenced_locally
    let localDate    = $state(data.date);
    let isNavigating = $state(false);

    $effect(() => {
        // Runs whenever data.date changes (new load completed or browser back/fwd)
        localDate    = data.date;
        isNavigating = false;
    });

    const isToday      = $derived(localDate === today);
    const isTomorrow   = $derived(localDate === tomorrow);
    const canGoBack    = $derived(localDate > '2022-01-01');
    const canGoForward = true;

    const dateLabel = $derived(
        isToday    ? `Vandaag, ${formatBelgianDate(localDate)}`  :
        isTomorrow ? `Morgen, ${formatBelgianDate(localDate)}`   :
                     formatBelgianDate(localDate)
    );

    // Only show the live price card when we're on today AND the fresh data is loaded
    const currentPrice = $derived(
        isToday && !isNavigating
            ? (data.prices.find((p) => p.hour === currentHour) ?? null)
            : null
    );

    let fullscreen = $state(false);
    let isLandscape = $state(false);
    let orientationLockSupported = $state(true);

    function updateOrientation() {
        isLandscape = window.innerWidth > window.innerHeight;
    }

    async function openFullscreen() {
        fullscreen = true;
        updateOrientation();
        try {
            await (screen.orientation as unknown as { lock(o: string): Promise<void> }).lock('landscape');
        } catch {
            orientationLockSupported = false;
        }
    }

    function closeFullscreen() {
        fullscreen = false;
        orientationLockSupported = true;
        try {
            screen.orientation.unlock();
        } catch { /* ignore on unsupported browsers */ }
    }

    onMount(() => {
        updateOrientation();
        window.addEventListener('resize', updateOrientation);
        return () => window.removeEventListener('resize', updateOrientation);
    });

    const pad = (n: number) => String(n).padStart(2, '0');

    function navigate(dir: -1 | 1) {
        const [y, m, d] = localDate.split('-').map(Number);
        const next = new Date(y, m - 1, d);
        next.setDate(next.getDate() + dir);
        const newDate = `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
        localDate    = newDate;
        isNavigating = true;
        goto(`?date=${newDate}`, { replaceState: false, noScroll: true });
    }

    function goToday() {
        localDate    = today;
        isNavigating = true;
        goto('/', { replaceState: false, noScroll: true });
    }

    // ── Period overview ───────────────────────────────────────────────────────

    type Period = 'dag' | 'week' | 'maand';
    let overviewPeriod   = $state<Period>('dag');
    let isLoadingPeriod  = $state(false);

    // price cache keyed by date — direct property write avoids reactive self-loop
    let priceCache = $state<Record<string, import('$lib/types.js').HourlyPrice[]>>({});
    $effect(() => {
        if (data.prices.length > 0) priceCache[data.date] = data.prices;
    });

    function isoFromDate(d: Date) {
        return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    }

    const periodRange = $derived.by((): { from: string; to: string } => {
        const [y, m, d] = localDate.split('-').map(Number);
        if (overviewPeriod === 'dag') return { from: localDate, to: localDate };
        if (overviewPeriod === 'week') {
            const ref = new Date(Date.UTC(y, m - 1, d));
            const dow = ref.getUTCDay(); // 0=Sun
            const mon = new Date(ref); mon.setUTCDate(d - ((dow + 6) % 7));
            const sun = new Date(mon); sun.setUTCDate(mon.getUTCDate() + 6);
            return { from: isoFromDate(mon), to: isoFromDate(sun) };
        }
        // maand
        const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
        return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(last)}` };
    });

    // Fetch prices for week/month ranges when dates are missing from cache
    $effect(() => {
        const { from, to } = periodRange;
        if (overviewPeriod === 'dag') return; // already in cache from page load

        // Collect which dates in range still need prices
        const missing: string[] = [];
        const cursor = new Date(from + 'T00:00:00Z');
        const end    = new Date(to   + 'T00:00:00Z');
        while (cursor <= end) {
            const iso = isoFromDate(cursor);
            if (!priceCache[iso]) missing.push(iso);
            cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
        if (missing.length === 0) return;

        isLoadingPeriod = true;
        fetch(`/api/prices/range?from=${from}&to=${to}`)
            .then((r) => r.json())
            .then((body: { prices: Record<string, import('$lib/types.js').HourlyPrice[]> }) => {
                // Assign per-key to avoid stale-closure overwrite and avoid reactive self-loop
                for (const [d, prices] of Object.entries(body.prices)) priceCache[d] = prices;
            })
            .catch(() => { /* silently ignore — totals will just lack cost data */ })
            .finally(() => { isLoadingPeriod = false; });
    });

    // Aggregate totals for the selected period
    const periodTotals = $derived.by(() => {
        if (isNavigating) return null;
        const { from, to } = periodRange;

        // Collect meter days that fall in range
        const dayEntries = Object.entries(meterStore.data).filter(([d]) => d >= from && d <= to);
        if (dayEntries.length === 0) return null;

        let totalConsumption = 0;
        let totalInjection   = 0;
        let actualCost       = 0;
        let goedkoopCost     = 0;
        let costHours        = 0;
        let totalHours       = 0;

        for (const [date, dayData] of dayEntries) {
            const dayPrices = priceCache[date] ?? [];

            for (const m of dayData) {
                totalConsumption += m.consumptionKwh;
                totalInjection   += m.injectionKwh;
                const netKwh = m.consumptionKwh - m.injectionKwh;
                goedkoopCost += (netKwh * settings.thresholds.blue) / 100;
                totalHours++;

                const price = dayPrices.find((p) => p.hour === m.hour);
                if (price) {
                    actualCost += (netKwh * price.centPerKwh) / 100;
                    costHours++;
                }
            }
        }

        const netKwh         = totalConsumption - totalInjection;
        const hasCost        = costHours > 0;
        const costIsComplete = costHours === totalHours;
        const savings        = goedkoopCost - actualCost;
        const savingsPct     = hasCost && goedkoopCost !== 0 ? (savings / Math.abs(goedkoopCost)) * 100 : 0;
        const avgCentPerKwh  = hasCost && netKwh !== 0 ? (actualCost / netKwh) * 100 : 0;

        return {
            totalConsumption: Math.round(totalConsumption * 1000) / 1000,
            totalInjection:   Math.round(totalInjection   * 1000) / 1000,
            netKwh:           Math.round(netKwh           * 1000) / 1000,
            actualCost,
            goedkoopCost,
            savings,
            savingsPct,
            avgCentPerKwh,
            hasCost,
            costIsComplete,
            dayCount:         dayEntries.length,
        };
    });

    const MONTHS_NL = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];

    const periodLabel = $derived.by(() => {
        if (overviewPeriod === 'dag') return null; // date already shown in chart nav
        const { from, to } = periodRange;
        const [fy, fm, fd] = from.split('-').map(Number);
        const [ty, tm, td] = to.split('-').map(Number);
        if (overviewPeriod === 'maand') return `${MONTHS_NL[fm - 1]} ${fy}`;
        // week
        const fromStr = `${fd} ${MONTHS_NL[fm - 1]}`;
        const toStr   = fm === tm ? `${td} ${MONTHS_NL[tm - 1]}` : `${td} ${MONTHS_NL[tm - 1]} ${ty}`;
        return `${fromStr} – ${toStr}`;
    });
</script>

<svelte:head>
    <title>Stroom — Stroomprijzen</title>
</svelte:head>

<!-- ─── Fullscreen overlay ───────────────────────────────────────────────── -->
{#if fullscreen}
    <div class="fixed inset-0 z-50 bg-background flex flex-col" role="dialog" aria-modal="true">

        <!-- Fullscreen header -->
        <div class="flex items-center justify-between px-4 py-3 border-b flex-shrink-0">
            <div class="flex items-center gap-1">
                <button
                    onclick={() => navigate(-1)}
                    class="p-2 rounded-xl hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                    aria-label="Vorige dag"
                >
                    <svg viewBox="0 0 24 24" class="w-4 h-4 stroke-current fill-none" stroke-width="2">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>
                {#if !isToday}
                    <button
                        onclick={goToday}
                        class="text-xs font-medium px-2 py-1 rounded-lg bg-accent text-accent-foreground hover:bg-border transition-colors"
                    >
                        Vandaag
                    </button>
                {/if}
                <span class="text-sm font-medium text-foreground">{dateLabel}</span>
                <button
                    onclick={() => navigate(1)}
                    class="p-2 rounded-xl hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                    aria-label="Volgende dag"
                >
                    <svg viewBox="0 0 24 24" class="w-4 h-4 stroke-current fill-none" stroke-width="2">
                        <polyline points="9 18 15 12 9 6" />
                    </svg>
                </button>
            </div>

            <button
                onclick={closeFullscreen}
                class="p-2 rounded-xl hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                aria-label="Sluiten"
            >
                <X size={20} />
            </button>
        </div>

        <!-- Fullscreen chart -->
        <div class="flex-1 min-h-0 px-4 pb-4 pt-2 relative">
            {#if isNavigating}
                <div class="flex items-center justify-center h-full">
                    <div class="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
            {:else if data.error}
                <div class="flex items-center justify-center h-full text-muted-foreground text-sm">
                    {data.date > today ? 'Geen prijzen beschikbaar voor deze datum.' : 'Kon prijzen niet laden.'}
                </div>
            {:else if data.prices.length === 0}
                <div class="flex items-center justify-center h-full">
                    <div class="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
            {:else}
                <PriceChart
                    prices={data.prices}
                    thresholds={settings.thresholds}
                    currentHour={isToday ? currentHour : -1}
                    containerClass="h-full"
                />
            {/if}

            <!-- Rotate hint: shown on iOS (lock unsupported) while still portrait -->
            {#if !orientationLockSupported && !isLandscape}
                <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div class="flex items-center gap-2 bg-foreground/80 text-background rounded-2xl px-4 py-3 text-sm backdrop-blur-sm">
                        <RotateCcw size={16} class="animate-spin" style="animation-duration:2s" />
                        <span>Draai je telefoon voor volledig scherm</span>
                    </div>
                </div>
            {/if}
        </div>
    </div>
{/if}

<!-- ─── Normal page ──────────────────────────────────────────────────────── -->
<div class="min-h-screen bg-background">
    <div class="mx-auto max-w-2xl px-4 py-6 pb-safe flex flex-col gap-5">

        <!-- Header -->
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
                <div class="w-8 h-8 bg-amber-400 rounded-lg flex items-center justify-center">
                    <svg viewBox="0 0 24 24" class="w-5 h-5 fill-white" xmlns="http://www.w3.org/2000/svg">
                        <path d="M13 2 L4.5 13.5 H11 L11 22 L19.5 10.5 H13 Z" />
                    </svg>
                </div>
                <span class="font-semibold text-lg text-foreground">Stroom</span>
            </div>
            <div class="flex items-center gap-1">
                <a
                    href="/week"
                    class="p-2 rounded-xl hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                    aria-label="Weekoverzicht"
                >
                    <CalendarDays size={20} />
                </a>
                <a
                    href="/settings"
                    class="p-2 rounded-xl hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                    aria-label="Instellingen"
                >
                    <Settings size={20} />
                </a>
            </div>
        </div>

        <!-- Current price card (today only, not while navigating) -->
        {#if currentPrice}
            <CurrentPriceCard price={currentPrice} thresholds={settings.thresholds} />
        {/if}

        <!-- Date navigation + chart card -->
        <div class="bg-card rounded-2xl border shadow-sm overflow-hidden">

            <!-- Date navigation -->
            <div class="flex items-center justify-between px-4 py-3 border-b">
                <button
                    onclick={() => navigate(-1)}
                    disabled={!canGoBack}
                    class="p-2 rounded-xl hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-muted-foreground hover:text-foreground"
                    aria-label="Vorige dag"
                >
                    <svg viewBox="0 0 24 24" class="w-4 h-4 stroke-current fill-none" stroke-width="2">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>

                <div class="flex items-center gap-2">
                    {#if !isToday}
                        <button
                            onclick={goToday}
                            class="text-xs font-medium px-2 py-1 rounded-lg bg-accent text-accent-foreground hover:bg-border transition-colors"
                        >
                            Vandaag
                        </button>
                    {/if}
                    <span class="text-sm font-medium text-foreground">{dateLabel}</span>
                </div>

                    <button
                        onclick={() => navigate(1)}
                        disabled={!canGoForward}
                        class="p-2 rounded-xl hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-muted-foreground hover:text-foreground"
                        aria-label="Volgende dag"
                    >
                        <svg viewBox="0 0 24 24" class="w-4 h-4 stroke-current fill-none" stroke-width="2">
                            <polyline points="9 18 15 12 9 6" />
                        </svg>
                    </button>
            </div>

            <!-- Chart -->
            <div class="px-4 pt-4 pb-2 relative">
                <!-- Fullscreen button overlaid top-right of chart -->
                <button
                    onclick={openFullscreen}
                    class="absolute top-2 right-2 z-10 p-1.5 rounded-lg bg-background/80 backdrop-blur-sm border shadow-sm hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                    aria-label="Volledig scherm"
                >
                    <Maximize2 size={14} />
                </button>

                {#if isNavigating}
                    <div class="flex items-center justify-center h-48">
                        <div class="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                {:else if data.error}
                    <div class="flex items-center justify-center h-48 text-muted-foreground text-sm">
                        {data.date > today ? 'Geen prijzen beschikbaar voor deze datum.' : 'Kon prijzen niet laden. Probeer later opnieuw.'}
                    </div>
                {:else if data.prices.length === 0}
                    <div class="flex items-center justify-center h-48">
                        <div class="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                {:else}
                    <PriceChart
                        prices={data.prices}
                        thresholds={settings.thresholds}
                        meterData={meterStore.forDate(data.date)}
                        currentHour={isToday ? currentHour : -1}
                    />
                {/if}
            </div>
        </div>

        <!-- Cheapest-window planner -->
        {#if !isNavigating && !data.error && data.prices.length > 0}
            <CheapestWindowCard
                prices={data.prices}
                thresholds={settings.thresholds}
                fromHour={isToday ? currentHour : 0}
                {isToday}
            />
        {/if}

        <!-- Legend (boundaries follow the user's thresholds) -->
        <div class="flex flex-wrap gap-2">
            {#each (['green', 'blue', 'amber', 'red'] as const) as level}
                <AlertBadge {level} label={getAlertLegendLabel(level, settings.thresholds)} />
            {/each}
        </div>

        <!-- Period overview (shown only when any meter data is present) -->
        {#if meterStore.dateCount > 0}
        <div class="bg-card rounded-2xl border shadow-sm overflow-hidden">

            <!-- Header: period tabs -->
            <div class="flex items-center justify-between px-4 py-3 border-b">
                <div class="flex gap-1">
                    {#each (['dag', 'week', 'maand'] as const) as p}
                        <button
                            onclick={() => overviewPeriod = p}
                            class="text-xs font-medium px-2.5 py-1 rounded-lg transition-colors capitalize
                                {overviewPeriod === p
                                    ? 'bg-foreground text-background'
                                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'}"
                        >{p}</button>
                    {/each}
                </div>
                {#if periodLabel}
                    <span class="text-xs text-muted-foreground">{periodLabel}</span>
                {/if}
            </div>

            <!-- Body -->
            {#if isLoadingPeriod && !periodTotals}
                <div class="flex items-center justify-center h-32">
                    <div class="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
            {:else if !periodTotals}
                <div class="flex items-center justify-center h-24 text-muted-foreground text-xs">
                    Geen verbruiksdata voor {overviewPeriod === 'dag' ? 'deze dag' : overviewPeriod === 'week' ? 'deze week' : 'deze maand'}.
                    Upload data via instellingen.
                </div>
            {:else}
                <div class="px-4 py-4 flex flex-col gap-4">

                    <!-- kWh row -->
                    <div class="flex gap-3">
                        <div class="flex-1">
                            <p class="text-xs text-muted-foreground mb-0.5">Verbruik</p>
                            <p class="font-semibold tabular-nums text-sm">{periodTotals.totalConsumption.toFixed(2)} kWh</p>
                        </div>
                        {#if periodTotals.totalInjection > 0}
                        <div class="flex-1">
                            <p class="text-xs text-muted-foreground mb-0.5">Injectie (zon)</p>
                            <p class="font-semibold tabular-nums text-sm text-blue-500">{periodTotals.totalInjection.toFixed(2)} kWh</p>
                        </div>
                        {/if}
                        <div class="flex-1">
                            <p class="text-xs text-muted-foreground mb-0.5">Netto</p>
                            <p class="font-semibold tabular-nums text-sm">{periodTotals.netKwh.toFixed(2)} kWh</p>
                        </div>
                        {#if overviewPeriod !== 'dag'}
                        <div class="flex-1">
                            <p class="text-xs text-muted-foreground mb-0.5">Dagen</p>
                            <p class="font-semibold tabular-nums text-sm">{periodTotals.dayCount}</p>
                        </div>
                        {/if}
                    </div>

                    <!-- Cost comparison (always shown — goedkoop always available; actual cost when prices cached) -->
                    <div class="grid grid-cols-2 gap-2">
                        <div class="bg-accent rounded-xl p-3">
                            <p class="text-xs text-muted-foreground mb-1">
                                Werkelijke kost
                                {#if !periodTotals.costIsComplete && periodTotals.hasCost}
                                    <span class="opacity-60">(gedeeltelijk)</span>
                                {/if}
                            </p>
                            {#if periodTotals.hasCost}
                                <p class="font-bold text-xl tabular-nums {periodTotals.actualCost < 0 ? 'text-green-500' : ''}">
                                    {periodTotals.actualCost < 0 ? '−' : ''}€{Math.abs(periodTotals.actualCost).toFixed(2)}
                                </p>
                            {:else}
                                <p class="text-sm text-muted-foreground italic">–</p>
                            {/if}
                        </div>
                        <div class="bg-accent rounded-xl p-3">
                            <p class="text-xs text-muted-foreground mb-1">Bij goedkoop tarief</p>
                            <p class="font-bold text-xl tabular-nums">
                                {periodTotals.goedkoopCost < 0 ? '−' : ''}€{Math.abs(periodTotals.goedkoopCost).toFixed(2)}
                            </p>
                            <p class="text-xs text-muted-foreground mt-0.5">{formatEuroPrice(settings.thresholds.blue)}/kWh</p>
                        </div>
                    </div>

                    <!-- Savings + avg price (only when we have actual cost data) -->
                    {#if periodTotals.hasCost}
                    <div class="flex gap-3">
                        <div class="flex-1">
                            <p class="text-xs text-muted-foreground mb-0.5">Besparing vs goedkoop</p>
                            <p class="font-semibold tabular-nums text-sm {periodTotals.savings >= 0 ? 'text-green-500' : 'text-red-400'}">
                                {periodTotals.savings >= 0 ? '+' : '−'}€{Math.abs(periodTotals.savings).toFixed(2)}
                                <span class="text-xs font-normal opacity-70">({periodTotals.savings >= 0 ? '+' : ''}{periodTotals.savingsPct.toFixed(0)}%)</span>
                            </p>
                        </div>
                        <div class="flex-1">
                            <p class="text-xs text-muted-foreground mb-0.5">Gem. prijs betaald</p>
                            <p class="font-semibold tabular-nums text-sm">{formatEuroPrice(periodTotals.avgCentPerKwh)}/kWh</p>
                        </div>
                    </div>
                    {/if}

                    <!-- Loading indicator while prices complete in background -->
                    {#if isLoadingPeriod}
                    <div class="flex items-center gap-2 text-xs text-muted-foreground">
                        <div class="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
                        Prijzen laden…
                    </div>
                    {/if}

                </div>
            {/if}
        </div>
        {/if}

    </div>
</div>
