<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { Settings, Maximize2, X, RotateCcw } from '@lucide/svelte';
    import PriceChart from '$lib/components/PriceChart.svelte';
    import CurrentPriceCard from '$lib/components/CurrentPriceCard.svelte';
    import AlertBadge from '$lib/components/AlertBadge.svelte';
    import { settings } from '$lib/stores.svelte.js';
    import {
        getTodayBelgian,
        getTomorrowBelgian,
        getCurrentBelgianHour,
        formatBelgianDate
    } from '$lib/priceUtils.js';

    let { data } = $props();

    const today       = getTodayBelgian();
    const tomorrow    = getTomorrowBelgian();
    const currentHour = getCurrentBelgianHour();

    // Optimistic navigation: localDate updates immediately on click;
    // isNavigating shows a spinner until SvelteKit delivers new data.
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

    function navigate(dir: -1 | 1) {
        const [y, m, d] = localDate.split('-').map(Number);
        const next = new Date(y, m - 1, d);
        next.setDate(next.getDate() + dir);
        const pad = (n: number) => String(n).padStart(2, '0');
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
            <a
                href="/settings"
                class="p-2 rounded-xl hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                aria-label="Instellingen"
            >
                <Settings size={20} />
            </a>
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
                        currentHour={isToday ? currentHour : -1}
                    />
                {/if}
            </div>
        </div>

        <!-- Legend -->
        <div class="flex flex-wrap gap-2">
            <AlertBadge level="green" label="Verdien geld (< €−0,2000)" />
            <AlertBadge level="blue" label="Onder nul" />
            <AlertBadge level="amber" label="Goedkoop (≤ €0,1500)" />
            <AlertBadge level="red" label="Duur (> €0,1500)" />
        </div>

    </div>
</div>
