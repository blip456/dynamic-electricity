<script lang="ts">
    import { goto } from '$app/navigation';
    import { ArrowLeft } from '@lucide/svelte';
    import AlertBadge from '$lib/components/AlertBadge.svelte';
    import { settings } from '$lib/stores.svelte.js';
    import {
        getAlertLevel,
        getTodayBelgian,
        getCurrentBelgianHour,
        formatEuroPrice
    } from '$lib/priceUtils.js';

    let { data } = $props();

    const today       = getTodayBelgian();
    const currentHour = getCurrentBelgianHour();
    const pad         = (n: number) => String(n).padStart(2, '0');

    const DAYS_NL   = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
    const MONTHS_NL = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];

    const CELL: Record<string, string> = {
        green: 'bg-green-500/80',
        blue:  'bg-blue-500/80',
        amber: 'bg-amber-400/90',
        red:   'bg-red-500/80'
    };

    function priceAt(date: string, hour: number) {
        return data.prices[date]?.find((p) => p.hour === hour) ?? null;
    }

    const weekLabel = $derived.by(() => {
        const [fy, fm, fd] = data.days[0].split('-').map(Number);
        const [ty, tm, td] = data.days[6].split('-').map(Number);
        const from = fm === tm ? `${fd}` : `${fd} ${MONTHS_NL[fm - 1]}`;
        return `${from} – ${td} ${MONTHS_NL[tm - 1]} ${ty}`;
    });

    const hasAnyData = $derived(data.days.some((d) => (data.prices[d]?.length ?? 0) > 0));

    function shiftWeek(dir: -1 | 1) {
        const [y, m, d] = data.days[0].split('-').map(Number);
        const next = new Date(Date.UTC(y, m - 1, d + dir * 7));
        const iso  = `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
        selected = null;
        goto(`/week?week=${iso}`, { noScroll: true });
    }

    const canGoBack    = $derived(data.days[0] > '2022-01-01');
    // Day-ahead prices never exist beyond tomorrow — don't navigate into emptiness
    const canGoForward = $derived(data.days[6] < today);
    const isCurrentWeek = $derived(data.days[0] <= today && today <= data.days[6]);

    let selected = $state<{ date: string; hour: number } | null>(null);

    const selectedPrice = $derived(selected ? priceAt(selected.date, selected.hour) : null);

    function selectCell(date: string, hour: number) {
        selected = selected?.date === date && selected?.hour === hour ? null : { date, hour };
    }

    function selectedLabel(date: string, hour: number): string {
        const [, m, d] = date.split('-').map(Number);
        const dow = DAYS_NL[(new Date(date + 'T00:00:00Z').getUTCDay() + 6) % 7];
        return `${dow} ${d} ${MONTHS_NL[m - 1]}, ${pad(hour)}:00–${pad(hour + 1)}:00`;
    }
</script>

<svelte:head>
    <title>Stroom — Weekoverzicht</title>
</svelte:head>

<div class="min-h-screen bg-background">
    <div class="mx-auto max-w-2xl px-4 py-6 pb-safe flex flex-col gap-5">

        <!-- Header -->
        <div class="flex items-center gap-2">
            <a
                href="/"
                class="p-2 -ml-2 rounded-xl hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                aria-label="Terug"
            >
                <ArrowLeft size={20} />
            </a>
            <span class="font-semibold text-lg text-foreground">Weekoverzicht</span>
        </div>

        <!-- Week navigation + heatmap card -->
        <div class="bg-card rounded-2xl border shadow-sm overflow-hidden">

            <div class="flex items-center justify-between px-4 py-3 border-b">
                <button
                    onclick={() => shiftWeek(-1)}
                    disabled={!canGoBack}
                    class="p-2 rounded-xl hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-muted-foreground hover:text-foreground"
                    aria-label="Vorige week"
                >
                    <svg viewBox="0 0 24 24" class="w-4 h-4 stroke-current fill-none" stroke-width="2">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                </button>

                <div class="flex items-center gap-2">
                    {#if !isCurrentWeek}
                        <button
                            onclick={() => { selected = null; goto('/week', { noScroll: true }); }}
                            class="text-xs font-medium px-2 py-1 rounded-lg bg-accent text-accent-foreground hover:bg-border transition-colors"
                        >
                            Deze week
                        </button>
                    {/if}
                    <span class="text-sm font-medium text-foreground">{weekLabel}</span>
                </div>

                <button
                    onclick={() => shiftWeek(1)}
                    disabled={!canGoForward}
                    class="p-2 rounded-xl hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-muted-foreground hover:text-foreground"
                    aria-label="Volgende week"
                >
                    <svg viewBox="0 0 24 24" class="w-4 h-4 stroke-current fill-none" stroke-width="2">
                        <polyline points="9 18 15 12 9 6" />
                    </svg>
                </button>
            </div>

            <div class="p-4">
                {#if !hasAnyData}
                    <div class="flex items-center justify-center h-48 text-muted-foreground text-sm">
                        Geen prijzen beschikbaar voor deze week.
                    </div>
                {:else}
                    <!-- Heatmap: hour rows × day columns -->
                    <div class="grid gap-px" style="grid-template-columns: 2.75rem repeat(7, 1fr);">
                        <div></div>
                        {#each data.days as date, i}
                            <div class="text-center text-[10px] pb-1 {date === today ? 'font-semibold text-foreground' : 'text-muted-foreground'}">
                                {DAYS_NL[i]} {Number(date.slice(8))}
                            </div>
                        {/each}

                        {#each Array.from({ length: 24 }, (_, h) => h) as hour}
                            <div class="text-[10px] text-muted-foreground text-right pr-1.5 leading-none self-center tabular-nums">
                                {hour % 3 === 0 ? `${pad(hour)}:00` : ''}
                            </div>
                            {#each data.days as date}
                                {@const price = priceAt(date, hour)}
                                {@const isSelected = selected?.date === date && selected?.hour === hour}
                                {@const isNow = date === today && hour === currentHour}
                                <button
                                    onclick={() => price && selectCell(date, hour)}
                                    aria-label="{selectedLabel(date, hour)}{price ? `, ${formatEuroPrice(price.centPerKwh)}/kWh` : ''}"
                                    class="h-3.5 rounded-[3px] transition-transform
                                        {price ? CELL[getAlertLevel(price.centPerKwh, settings.thresholds)] : 'bg-muted cursor-default'}
                                        {isSelected ? 'ring-2 ring-foreground z-10 scale-110' : ''}
                                        {isNow && !isSelected ? 'ring-2 ring-foreground/40' : ''}"
                                ></button>
                            {/each}
                        {/each}
                    </div>

                    <!-- Info strip -->
                    <div class="h-9 mt-2 flex items-center justify-center gap-3 text-sm select-none">
                        {#if selected && selectedPrice}
                            <span class="text-muted-foreground text-xs">{selectedLabel(selected.date, selected.hour)}</span>
                            <span class="font-semibold tabular-nums">{formatEuroPrice(selectedPrice.centPerKwh)}/kWh</span>
                        {:else}
                            <span class="text-muted-foreground/40 text-xs">tik op een vakje voor details</span>
                        {/if}
                    </div>
                {/if}
            </div>
        </div>

        <!-- Legend -->
        <div class="flex flex-wrap gap-2">
            <AlertBadge level="green" label="Verdien geld" />
            <AlertBadge level="blue" label="Onder nul" />
            <AlertBadge level="amber" label="Goedkoop" />
            <AlertBadge level="red" label="Duur" />
        </div>
    </div>
</div>
