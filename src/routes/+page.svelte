<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { Settings, Maximize2, X, RotateCcw, CalendarDays, ChevronDown, ChartColumn } from '@lucide/svelte';
    import PriceChart from '$lib/components/PriceChart.svelte';
    import CurrentPriceCard from '$lib/components/CurrentPriceCard.svelte';
    import CheapestWindowCard from '$lib/components/CheapestWindowCard.svelte';
    import AlertBadge from '$lib/components/AlertBadge.svelte';
    import Seo from '$lib/components/Seo.svelte';
    import { settings } from '$lib/stores.svelte.js';
    import { meterStore } from '$lib/meterStore.svelte.js';
    import { trackEvent } from '$lib/analytics.js';
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
        trackEvent('chart_fullscreen_open');
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
        trackEvent('date_navigate', { method: 'arrow', date: newDate });
        goto(`?date=${newDate}`, { replaceState: false, noScroll: true });
    }

    function goToday() {
        localDate    = today;
        isNavigating = true;
        trackEvent('date_navigate', { method: 'today', date: today });
        goto('/', { replaceState: false, noScroll: true });
    }

    // Date picker: an invisible <input type="date"> overlays the date label,
    // so tapping it opens the platform's native picker.
    function pickDate(e: Event) {
        const value = (e.currentTarget as HTMLInputElement).value;
        if (!value || value === localDate) return;
        localDate    = value;
        isNavigating = true;
        trackEvent('date_navigate', { method: 'picker', date: value });
        goto(value === today ? '/' : `?date=${value}`, { replaceState: false, noScroll: true });
    }

</script>

<Seo
    title="Dynamische stroomprijzen per uur in België — vandaag & morgen | Stroom"
    description="Volg de dynamische elektriciteitsprijzen (Belpex / EPEX Spot) per uur in België. Zie wanneer stroom goedkoop, bijna gratis of zelfs negatief is, vind het goedkoopste blok en bespaar met je dynamisch energiecontract."
    keywords="dynamische stroomprijzen, elektriciteitsprijs per uur, Belpex, EPEX Spot België, dynamisch energiecontract, dynamische energieprijzen vandaag, goedkoopste uren stroom, negatieve stroomprijzen, uurprijzen elektriciteit België"
/>

<svelte:head>
    {@html '<script type="application/ld+json">' + JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'Stroom',
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Web',
        inLanguage: 'nl-BE',
        description:
            'Gratis web-app die de dynamische stroomprijzen (Belpex day-ahead) per uur toont voor België, met prijswaarschuwingen en een planner voor de goedkoopste uren.',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' }
    }) + '<\/script>'}
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
                <span class="relative inline-flex items-center gap-1 text-sm font-medium text-foreground">
                        {dateLabel}
                        <ChevronDown size={14} class="text-muted-foreground" />
                        <input
                            type="date"
                            value={localDate}
                            min="2022-01-01"
                            max={tomorrow}
                            onchange={pickDate}
                            aria-label="Kies een datum"
                            class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                    </span>
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
                <h1 class="font-semibold text-lg text-foreground">Stroom</h1>
            </div>
            <div class="flex items-center gap-1">
                <a
                    href="/stats"
                    class="p-2 rounded-xl hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                    aria-label="Statistieken"
                >
                    <ChartColumn size={20} />
                </a>
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
                    <span class="relative inline-flex items-center gap-1 text-sm font-medium text-foreground">
                        {dateLabel}
                        <ChevronDown size={14} class="text-muted-foreground" />
                        <input
                            type="date"
                            value={localDate}
                            min="2022-01-01"
                            max={tomorrow}
                            onchange={pickDate}
                            aria-label="Kies een datum"
                            class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                    </span>
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

        <!-- Info / SEO copy -->
        <section class="flex flex-col gap-2 pt-2 text-xs text-muted-foreground leading-relaxed">
            <h2 class="text-sm font-medium text-foreground">Dynamische stroomprijzen in België</h2>
            <p>
                Met een dynamisch energiecontract volgt je elektriciteitsprijs de uurprijzen van de
                Belgische groothandelsmarkt Belpex (EPEX Spot Belgium). Elke namiddag worden de
                day-ahead prijzen voor morgen bekendgemaakt — die zie je hier meteen, uur per uur.
            </p>
            <p>
                Stroom toont de stroomprijs per uur voor vandaag en morgen, stuurt prijswaarschuwingen
                bij goedkope, bijna gratis of zelfs negatieve stroomprijzen, en vindt het goedkoopste
                blok om je wasmachine, droogkast, warmtepomp of elektrische auto te laten draaien.
                Zo verschuif je je verbruik naar de goedkoopste uren en bespaar je op je energiefactuur.
            </p>
            <p>
                Gratis te gebruiken met elk dynamisch contract in Vlaanderen, Brussel en Wallonië.
                Koppel je verbruiksdata van de digitale meter (Mijn Fluvius) en zie precies wat elk
                uur je kost.
            </p>
        </section>

    </div>
</div>
