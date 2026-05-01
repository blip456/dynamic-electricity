<script lang="ts">
    import { goto } from '$app/navigation';
    import { Settings } from '@lucide/svelte';
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

    const today = getTodayBelgian();
    const tomorrow = getTomorrowBelgian();
    const currentHour = getCurrentBelgianHour();

    const isToday = $derived(data.date === today);
    const isTomorrow = $derived(data.date === tomorrow);
    const canGoForward = true;
    const canGoBack = $derived(data.date > '2022-01-01'); // ENTSO-E has ~2 years history

    const dateLabel = $derived(
        isToday
            ? `Vandaag, ${formatBelgianDate(data.date)}`
            : isTomorrow
              ? `Morgen, ${formatBelgianDate(data.date)}`
              : formatBelgianDate(data.date)
    );

    const currentPrice = $derived(
        isToday ? data.prices.find((p) => p.hour === currentHour) ?? null : null
    );

    function navigate(dir: -1 | 1) {
        const [y, m, d] = data.date.split('-').map(Number);
        const next = new Date(y, m - 1, d);
        next.setDate(next.getDate() + dir);
        const pad = (n: number) => String(n).padStart(2, '0');
        const newDate = `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
        goto(`?date=${newDate}`, { replaceState: false });
    }

    function goToday() {
        goto('/', { replaceState: false });
    }
</script>

<svelte:head>
    <title>Stroom — Stroomprijzen</title>
</svelte:head>

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
            <div class="p-4">
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
