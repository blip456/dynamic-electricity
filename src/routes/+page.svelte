<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
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

    const isToday    = $derived(data.date === today);
    const isTomorrow = $derived(data.date === tomorrow);
    const canGoBack  = $derived(data.date > '2022-01-01');

    const dateLabel = $derived(
        isToday    ? `Vandaag, ${formatBelgianDate(data.date)}`  :
        isTomorrow ? `Morgen, ${formatBelgianDate(data.date)}`   :
                     formatBelgianDate(data.date)
    );

    const currentPrice = $derived(
        isToday ? data.prices.find((p) => p.hour === currentHour) ?? null : null
    );

    let fullscreen = $state(false);
    // true once the device is in landscape (or lock succeeded)
    let isLandscape = $state(false);
    // false when screen.orientation.lock threw (iOS) → show rotate hint
    let orientationLockSupported = $state(true);

    function updateOrientation() {
        isLandscape = window.innerWidth > window.innerHeight;
    }

    async function openFullscreen() {
        fullscreen = true;
        updateOrientation();
        try {
            // Works on Chrome/Android PWA; throws NotSupportedError on iOS Safari
            await (screen.orientation as unknown as { lock(o: string): Promise<void> }).lock('landscape');
        } catch {
            orientationLockSupported = false;
        }
    }

    function closeFullscreen() {
        fullscreen = false;
        orientationLockSupported = true; // reset for next open
        try {
            screen.orientation.unlock();
        } catch { /* ignore on unsupported browsers */ }
    }

    onMount(() => {
        updateOrientation();
        window.addEventListener('resize', updateOrientation);
    });

    onDestroy(() => {
        window.removeEventListener('resize', updateOrientation);
    });

    function navigate(dir: -1 | 1) {
        const [y, m, d] = data.date.split('-').map(Number);
        const next = new Date(y, m - 1, d);
        next.setDate(next.getDate() + dir);
        const pad = (n: number) => String(n).padStart(2, '0');
        goto(`?date=${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`, { replaceState: false });
    }

    function goToday() { goto('/', { replaceState: false }); }
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
            {#if data.error}
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

        <!-- Current price card (today only) -->
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

                <div class="flex items-center gap-1">
                    <button
                        onclick={() => navigate(1)}
                        class="p-2 rounded-xl hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                        aria-label="Volgende dag"
                    >
                        <svg viewBox="0 0 24 24" class="w-4 h-4 stroke-current fill-none" stroke-width="2">
                            <polyline points="9 18 15 12 9 6" />
                        </svg>
                    </button>
                    <button
                        onclick={openFullscreen}
                        class="p-2 rounded-xl hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                        aria-label="Volledig scherm"
                    >
                        <Maximize2 size={16} />
                    </button>
                </div>
            </div>

            <!-- Chart -->
            <div class="px-4 pt-4 pb-2">
                {#if data.error}
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
