<script lang="ts">
    import { ArrowLeft, TrendingUp, TrendingDown, Upload } from '@lucide/svelte';
    import Seo from '$lib/components/Seo.svelte';
    import { settings } from '$lib/stores.svelte.js';
    import { meterStore } from '$lib/meterStore.svelte.js';
    import { priceStore } from '$lib/priceStore.svelte.js';
    import { computeDaySavings, aggregateSavings, mondayOf, type DaySavings } from '$lib/savings.js';
    import { getTodayBelgian, formatEuroPrice } from '$lib/priceUtils.js';
    import { trackEvent } from '$lib/analytics.js';

    const today = getTodayBelgian();
    const pad   = (n: number) => String(n).padStart(2, '0');

    const MONTHS_NL = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
    const DAYS_NL   = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];

    function isoOffset(dateStr: string, days: number): string {
        const [y, m, d] = dateStr.split('-').map(Number);
        const dt = new Date(Date.UTC(y, m - 1, d + days));
        return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
    }

    function fmtEur(v: number): string {
        return `${v < 0 ? '−' : ''}€${Math.abs(v).toFixed(2)}`;
    }

    // ── Analysis window: last 26 weeks of meter data ─────────────────────────
    const cutoff = isoOffset(today, -182);
    const analysisDates = $derived(
        Object.keys(meterStore.data).filter((d) => d >= cutoff && d <= today).sort()
    );

    // ── Fetch missing prices in ≤31-day chunks ───────────────────────────────
    let isLoadingPrices = $state(false);
    const requested = new Set<string>();

    $effect(() => {
        const missing = analysisDates.filter((d) => !priceStore.data[d]);
        if (missing.length === 0) return;

        const ranges: { from: string; to: string }[] = [];
        let start = missing[0];
        let prev  = missing[0];
        for (const d of missing.slice(1)) {
            const span = (Date.parse(d) - Date.parse(start)) / 86_400_000;
            if (span >= 31) {
                ranges.push({ from: start, to: prev });
                start = d;
            }
            prev = d;
        }
        ranges.push({ from: start, to: prev });

        const todo = ranges.filter((r) => !requested.has(`${r.from}:${r.to}`));
        if (todo.length === 0) return;
        for (const r of todo) requested.add(`${r.from}:${r.to}`);

        isLoadingPrices = true;
        Promise.all(
            todo.map((r) =>
                fetch(`/api/prices/range?from=${r.from}&to=${r.to}`)
                    .then((res) => res.json())
                    .then((body: { prices: Record<string, import('$lib/types.js').HourlyPrice[]> }) =>
                        priceStore.merge(body.prices))
                    .catch(() => { /* sections render with what we have */ })
            )
        ).finally(() => { isLoadingPrices = false; });
    });

    // ── Per-day savings ──────────────────────────────────────────────────────
    const dayStats = $derived.by(() => {
        const out: Record<string, DaySavings> = {};
        for (const date of analysisDates) {
            const prices = priceStore.data[date];
            if (!prices) continue;
            const s = computeDaySavings(date, meterStore.data[date], prices, settings.thresholds.cheap);
            if (s) out[date] = s;
        }
        return out;
    });

    function statsInRange(from: string, to: string): DaySavings[] {
        return Object.values(dayStats).filter((d) => d.date >= from && d.date <= to);
    }

    // ── Period overview (navigable day / week / month) ───────────────────────
    type Period = 'dag' | 'week' | 'maand';
    let overviewPeriod = $state<Period>('week');
    let anchorDate     = $state(today);

    const periodRange = $derived.by((): { from: string; to: string } => {
        if (overviewPeriod === 'dag') return { from: anchorDate, to: anchorDate };
        if (overviewPeriod === 'week') {
            const mon = mondayOf(anchorDate);
            return { from: mon, to: isoOffset(mon, 6) };
        }
        const [y, m] = anchorDate.split('-').map(Number);
        const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
        return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(last)}` };
    });

    const periodLabel = $derived.by(() => {
        const { from, to } = periodRange;
        const [fy, fm, fd] = from.split('-').map(Number);
        const [, tm, td]   = to.split('-').map(Number);
        const yearSuffix   = fy !== Number(today.slice(0, 4)) ? ` ${fy}` : '';
        if (overviewPeriod === 'dag')   return `${fd} ${MONTHS_NL[fm - 1]}${yearSuffix}`;
        if (overviewPeriod === 'maand') return `${MONTHS_NL[fm - 1]} ${fy}`;
        const base = fm === tm ? `${fd}–${td} ${MONTHS_NL[fm - 1]}` : `${fd} ${MONTHS_NL[fm - 1]} – ${td} ${MONTHS_NL[tm - 1]}`;
        return base + yearSuffix;
    });

    const isCurrentPeriod = $derived(periodRange.from <= today && today <= periodRange.to);
    const canGoBack       = $derived(periodRange.from > cutoff);
    const canGoForward    = $derived(periodRange.to < today);

    function shiftPeriod(dir: -1 | 1) {
        if (overviewPeriod === 'dag') {
            anchorDate = isoOffset(anchorDate, dir);
        } else if (overviewPeriod === 'week') {
            anchorDate = isoOffset(anchorDate, dir * 7);
        } else {
            const [y, m] = anchorDate.split('-').map(Number);
            const dt = new Date(Date.UTC(y, m - 1 + dir, 1));
            anchorDate = `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-01`;
        }
    }

    function pickAnchor(e: Event) {
        const value = (e.currentTarget as HTMLInputElement).value;
        if (value) anchorDate = value;
    }

    const periodStats = $derived(aggregateSavings(statsInRange(periodRange.from, periodRange.to)));

    const savingsPct = $derived(
        periodStats && periodStats.refCost !== 0
            ? (periodStats.savings / Math.abs(periodStats.refCost)) * 100
            : 0
    );
    const timingPct = $derived(
        periodStats && periodStats.marketAvgCent !== 0
            ? ((periodStats.paidAvgCent - periodStats.marketAvgCent) / Math.abs(periodStats.marketAvgCent)) * 100
            : 0
    );
    // Shift potential as share of what consumption actually cost
    const shiftPct = $derived(
        periodStats && periodStats.consumptionCost > 0
            ? (Math.max(0, periodStats.shiftPotential) / periodStats.consumptionCost) * 100
            : 0
    );

    // ── Savings trend: week-over-week / month-over-month ─────────────────────
    let trendMode = $state<'week' | 'maand'>('week');

    const trendRows = $derived.by(() => {
        const groups = new Map<string, DaySavings[]>();
        for (const d of Object.values(dayStats)) {
            const key = trendMode === 'week' ? mondayOf(d.date) : d.date.slice(0, 7);
            (groups.get(key) ?? groups.set(key, []).get(key)!).push(d);
        }
        const keys = [...groups.keys()].sort().slice(trendMode === 'week' ? -8 : -6);

        return keys.map((key, i) => {
            const agg = aggregateSavings(groups.get(key)!)!;
            let label: string;
            if (trendMode === 'week') {
                const [, m, d] = key.split('-').map(Number);
                const end = isoOffset(key, 6);
                const [, em, ed] = end.split('-').map(Number);
                label = m === em ? `${d}–${ed} ${MONTHS_NL[m - 1]}` : `${d} ${MONTHS_NL[m - 1]} – ${ed} ${MONTHS_NL[em - 1]}`;
            } else {
                const [y, m] = key.split('-').map(Number);
                label = `${MONTHS_NL[m - 1]} ${y}`;
            }
            return { key, label, savings: agg.savings, days: agg.days, deltaIdx: i };
        }).map((row, i, arr) => ({
            ...row,
            delta: i > 0 ? row.savings - arr[i - 1].savings : null
        }));
    });

    const trendMaxAbs = $derived(Math.max(0.01, ...trendRows.map((r) => Math.abs(r.savings))));

    // ── Daily savings heatmap: last 12 weeks ─────────────────────────────────
    const heatMondays = $derived.by(() => {
        const lastMon = mondayOf(today);
        return Array.from({ length: 12 }, (_, i) => isoOffset(lastMon, (i - 11) * 7));
    });
    const heatMaxAbs = $derived.by(() => {
        let max = 0;
        for (const mon of heatMondays) {
            for (let r = 0; r < 7; r++) {
                const s = dayStats[isoOffset(mon, r)];
                if (s) max = Math.max(max, Math.abs(s.savings));
            }
        }
        return max;
    });

    function heatColor(savings: number): string {
        if (heatMaxAbs <= 0) return 'rgba(148,163,184,0.15)';
        const alpha = 0.15 + 0.8 * Math.min(1, Math.abs(savings) / heatMaxAbs);
        return savings >= 0 ? `rgba(34,197,94,${alpha})` : `rgba(239,68,68,${alpha})`;
    }

    let heatSelected = $state<string | null>(null);
    const heatSelectedStats = $derived(heatSelected ? dayStats[heatSelected] ?? null : null);

    function shortDate(date: string): string {
        const [y, m, d] = date.split('-').map(Number);
        const yearSuffix = y !== Number(today.slice(0, 4)) ? ` ${y}` : '';
        return `${d} ${MONTHS_NL[m - 1]}${yearSuffix}`;
    }

    function heatLabel(date: string): string {
        const [, m, d] = date.split('-').map(Number);
        const dow = DAYS_NL[(new Date(date + 'T00:00:00Z').getUTCDay() + 6) % 7];
        return `${dow} ${d} ${MONTHS_NL[m - 1]}`;
    }

    // Month markers above the heatmap: label a column when the month changes
    const heatMonthMarks = $derived(
        heatMondays.map((mon, i) => {
            const m = Number(mon.slice(5, 7));
            const prev = i > 0 ? Number(heatMondays[i - 1].slice(5, 7)) : -1;
            return m !== prev ? MONTHS_NL[m - 1] : '';
        })
    );

    const hasData = $derived(Object.keys(dayStats).length > 0);
</script>

<Seo
    title="Bespaar met je dynamisch energiecontract — statistieken | Stroom"
    description="Analyseer je besparing met dynamische stroomprijzen: koppel je Fluvius-verbruiksdata en zie wat je verbruik per dag, week of maand kostte tegenover een vast tarief."
/>

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
            <span class="font-semibold text-lg text-foreground">Statistieken</span>
        </div>

        {#if meterStore.dateCount === 0}
            <div class="bg-card rounded-2xl border shadow-sm p-6 flex flex-col items-center gap-3 text-center">
                <Upload size={24} class="text-muted-foreground" />
                <p class="text-sm text-muted-foreground">
                    Importeer eerst je Fluvius-verbruiksdata om besparingen en statistieken te zien.
                </p>
                <a href="/settings" class="text-sm font-medium px-3 py-2 rounded-xl bg-foreground text-background hover:opacity-90 transition-opacity">
                    Naar instellingen
                </a>
            </div>
        {:else}

            <!-- Data coverage -->
            {#if meterStore.dateRange}
                <p class="text-xs text-muted-foreground -mt-2">
                    {meterStore.dateCount} {meterStore.dateCount === 1 ? 'dag' : 'dagen'} aan verbruiksdata
                    · {shortDate(meterStore.dateRange.from)} – {shortDate(meterStore.dateRange.to)}
                    {#if analysisDates.length < meterStore.dateCount}
                        · statistieken over de laatste 26 weken ({analysisDates.length} dagen)
                    {/if}
                </p>
            {/if}

            <!-- ── Period overview (dag/week/maand) ─────────────────────── -->
            <div class="bg-card rounded-2xl border shadow-sm overflow-hidden">
                <div class="flex items-center justify-between gap-2 flex-wrap px-4 py-3 border-b">
                    <div class="flex gap-1">
                        {#each (['dag', 'week', 'maand'] as const) as p}
                            <button
                                onclick={() => { overviewPeriod = p; trackEvent('stats_period', { period: p }); }}
                                class="text-xs font-medium px-2.5 py-1 rounded-lg transition-colors capitalize
                                    {overviewPeriod === p
                                        ? 'bg-foreground text-background'
                                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'}"
                            >{p}</button>
                        {/each}
                    </div>

                    <div class="flex items-center gap-1">
                        {#if !isCurrentPeriod}
                            <button
                                onclick={() => anchorDate = today}
                                class="text-xs font-medium px-2 py-1 rounded-lg bg-accent text-accent-foreground hover:bg-border transition-colors"
                            >
                                Nu
                            </button>
                        {/if}
                        <button
                            onclick={() => shiftPeriod(-1)}
                            disabled={!canGoBack}
                            class="p-1.5 rounded-lg hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-muted-foreground hover:text-foreground"
                            aria-label="Vorige {overviewPeriod}"
                        >
                            <svg viewBox="0 0 24 24" class="w-3.5 h-3.5 stroke-current fill-none" stroke-width="2">
                                <polyline points="15 18 9 12 15 6" />
                            </svg>
                        </button>
                        <span class="relative text-xs text-muted-foreground tabular-nums">
                            {periodLabel}
                            <input
                                type="date"
                                value={anchorDate}
                                min={cutoff}
                                max={today}
                                onchange={pickAnchor}
                                aria-label="Kies een datum"
                                class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                        </span>
                        <button
                            onclick={() => shiftPeriod(1)}
                            disabled={!canGoForward}
                            class="p-1.5 rounded-lg hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-muted-foreground hover:text-foreground"
                            aria-label="Volgende {overviewPeriod}"
                        >
                            <svg viewBox="0 0 24 24" class="w-3.5 h-3.5 stroke-current fill-none" stroke-width="2">
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                        </button>
                    </div>
                </div>

                {#if isLoadingPrices && !periodStats}
                    <div class="flex items-center justify-center h-32">
                        <div class="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                {:else if !periodStats}
                    <p class="p-4 text-sm text-muted-foreground">
                        Geen verbruiksdata voor deze {overviewPeriod === 'dag' ? 'dag' : overviewPeriod === 'week' ? 'week' : 'maand'}.
                    </p>
                {:else}
                    <div class="p-4 flex flex-col gap-4">
                        <!-- kWh row -->
                        <div class="grid grid-cols-3 gap-3">
                            <div>
                                <p class="text-xs text-muted-foreground mb-0.5">Verbruik</p>
                                <p class="font-semibold tabular-nums text-sm">{periodStats.consumptionKwh.toFixed(2)} kWh</p>
                            </div>
                            <div>
                                <p class="text-xs text-muted-foreground mb-0.5">Injectie</p>
                                <p class="font-semibold tabular-nums text-sm text-blue-500">{periodStats.injectionKwh.toFixed(2)} kWh</p>
                            </div>
                            <div>
                                <p class="text-xs text-muted-foreground mb-0.5">Netto</p>
                                <p class="font-semibold tabular-nums text-sm">{periodStats.netKwh.toFixed(2)} kWh</p>
                            </div>
                        </div>

                        <div class="border-t"></div>

                        <!-- Cost comparison -->
                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <p class="text-xs text-muted-foreground mb-0.5">
                                    Werkelijke kost
                                    {#if !periodStats.isComplete}
                                        <span title="Niet alle uren hebben prijsdata">*</span>
                                    {/if}
                                </p>
                                <p class="font-bold text-xl tabular-nums {periodStats.actualCost < 0 ? 'text-green-500' : ''}">
                                    {fmtEur(periodStats.actualCost)}
                                </p>
                            </div>
                            <div>
                                <p class="text-xs text-muted-foreground mb-0.5">Aan vaste prijs</p>
                                <p class="font-bold text-xl tabular-nums text-muted-foreground">{fmtEur(periodStats.refCost)}</p>
                                <p class="text-xs text-muted-foreground mt-0.5">{formatEuroPrice(settings.thresholds.cheap)}/kWh</p>
                            </div>
                        </div>

                        <div class="border-t"></div>

                        <!-- Savings + avg paid -->
                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <p class="text-xs text-muted-foreground mb-0.5">Besparing</p>
                                <p class="font-bold text-xl tabular-nums {periodStats.savings >= 0 ? 'text-green-600' : 'text-red-600'}">
                                    {fmtEur(periodStats.savings)}
                                </p>
                                <p class="text-xs text-muted-foreground mt-0.5">{savingsPct >= 0 ? '+' : ''}{savingsPct.toFixed(0)}% t.o.v. vaste prijs</p>
                            </div>
                            <div>
                                <p class="text-xs text-muted-foreground mb-0.5">Gem. betaald</p>
                                <p class="font-semibold tabular-nums text-sm mt-1">{formatEuroPrice(periodStats.paidAvgCent)}/kWh</p>
                            </div>
                        </div>
                    </div>
                {/if}
            </div>

            <!-- ── Smart usage KPIs ──────────────────────────────────────── -->
            {#if periodStats}
                <div class="bg-card rounded-2xl border shadow-sm p-4 flex flex-col gap-3">
                    <h2 class="text-sm font-medium text-muted-foreground">Slim verbruik ({periodLabel})</h2>

                    <div class="flex items-center justify-between gap-3">
                        <div>
                            <p class="text-xs text-muted-foreground">Jouw gem. prijs vs. gemiddelde uurprijs</p>
                            <p class="font-semibold tabular-nums text-sm mt-0.5">
                                {formatEuroPrice(periodStats.paidAvgCent)} vs {formatEuroPrice(periodStats.marketAvgCent)}
                            </p>
                        </div>
                        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border
                            {timingPct <= 0
                                ? 'bg-green-100 text-green-700 border-green-200'
                                : 'bg-red-100 text-red-700 border-red-200'}">
                            {#if timingPct <= 0}<TrendingDown size={12} />{:else}<TrendingUp size={12} />{/if}
                            {Math.abs(timingPct).toFixed(0)}% {timingPct <= 0 ? 'goedkoper' : 'duurder'}
                        </span>
                    </div>

                    <div class="border-t"></div>

                    <div>
                        <p class="text-xs text-muted-foreground">Verschuifpotentieel</p>
                        <p class="font-bold text-xl tabular-nums mt-0.5">
                            {fmtEur(Math.max(0, periodStats.shiftPotential))}
                            {#if periodStats.shiftPotential > 0.005}
                                <span class="text-sm font-semibold text-muted-foreground">· −{shiftPct.toFixed(0)}%</span>
                            {/if}
                        </p>
                        <p class="text-xs text-muted-foreground mt-0.5">
                            {#if periodStats.shiftPotential > 0.005}
                                je verbruikskost kon {shiftPct.toFixed(0)}% lager als je verbruik in de 8 goedkoopste uren per dag was gevallen
                            {:else}
                                je verbruik viel al vrijwel optimaal — knap getimed
                            {/if}
                        </p>
                    </div>
                </div>
            {/if}

            <!-- ── Savings trend ─────────────────────────────────────────── -->
            <div class="bg-card rounded-2xl border shadow-sm overflow-hidden">
                <div class="flex items-center justify-between px-4 py-3 border-b">
                    <h2 class="text-sm font-medium text-foreground">Besparing per {trendMode}</h2>
                    <div class="flex gap-1">
                        {#each (['week', 'maand'] as const) as m}
                            <button
                                onclick={() => { trendMode = m; trackEvent('stats_trend_mode', { mode: m }); }}
                                class="text-xs font-medium px-2.5 py-1 rounded-lg transition-colors capitalize
                                    {trendMode === m
                                        ? 'bg-foreground text-background'
                                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'}"
                            >{m}</button>
                        {/each}
                    </div>
                </div>

                <div class="p-4">
                    {#if trendRows.length === 0}
                        <p class="text-sm text-muted-foreground">Nog geen gegevens.</p>
                    {:else}
                        <div class="flex flex-col gap-2.5">
                            {#each trendRows as row (row.key)}
                                <div class="flex items-center gap-3">
                                    <span class="text-xs text-muted-foreground w-24 flex-shrink-0 tabular-nums">{row.label}</span>
                                    <div class="flex-1 h-4 rounded bg-muted/60 overflow-hidden">
                                        <div
                                            class="h-full rounded {row.savings >= 0 ? 'bg-green-500/80' : 'bg-red-500/80'}"
                                            style="width: {Math.max(2, (Math.abs(row.savings) / trendMaxAbs) * 100)}%"
                                        ></div>
                                    </div>
                                    <span class="text-xs font-semibold tabular-nums w-16 text-right {row.savings >= 0 ? 'text-green-600' : 'text-red-600'}">
                                        {fmtEur(row.savings)}
                                    </span>
                                    <span class="text-[10px] tabular-nums w-14 text-right text-muted-foreground">
                                        {#if row.delta !== null}
                                            {row.delta >= 0 ? '▲' : '▼'} {fmtEur(Math.abs(row.delta))}
                                        {/if}
                                    </span>
                                </div>
                            {/each}
                        </div>
                        <p class="text-[10px] text-muted-foreground mt-3">
                            Besparing t.o.v. vaste prijs van {formatEuroPrice(settings.thresholds.cheap)}/kWh · ▲▼ = verschil met vorige {trendMode}
                        </p>
                    {/if}
                </div>
            </div>

            <!-- ── Daily savings heatmap ─────────────────────────────────── -->
            <div class="bg-card rounded-2xl border shadow-sm overflow-hidden">
                <div class="px-4 py-3 border-b">
                    <h2 class="text-sm font-medium text-foreground">Besparing per dag</h2>
                </div>
                <div class="p-4">
                    {#if !hasData}
                        {#if isLoadingPrices}
                            <div class="flex items-center justify-center h-24">
                                <div class="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        {:else}
                            <p class="text-sm text-muted-foreground">Nog geen gegevens.</p>
                        {/if}
                    {:else}
                        <div class="grid gap-1" style="grid-template-columns: 1.5rem repeat(12, 1fr);">
                            <!-- month markers -->
                            <div></div>
                            {#each heatMonthMarks as mark}
                                <div class="text-[9px] text-muted-foreground text-center h-3 overflow-visible whitespace-nowrap">{mark}</div>
                            {/each}

                            {#each DAYS_NL as dayName, row}
                                <div class="text-[9px] text-muted-foreground text-right pr-1 self-center">{row % 2 === 0 ? dayName : ''}</div>
                                {#each heatMondays as mon}
                                    {@const date = isoOffset(mon, row)}
                                    {@const s = dayStats[date]}
                                    <button
                                        onclick={() => heatSelected = s ? (heatSelected === date ? null : date) : heatSelected}
                                        aria-label="{heatLabel(date)}{s ? `, besparing ${fmtEur(s.savings)}` : ', geen data'}"
                                        class="aspect-square w-full rounded-[3px] {s ? '' : 'cursor-default'} {heatSelected === date ? 'ring-2 ring-foreground' : ''}"
                                        style="background: {s ? heatColor(s.savings) : 'rgba(148,163,184,0.12)'}"
                                    ></button>
                                {/each}
                            {/each}
                        </div>

                        <!-- info strip + legend -->
                        <div class="h-8 mt-2 flex items-center justify-center gap-3 text-sm select-none">
                            {#if heatSelectedStats && heatSelected}
                                <span class="text-muted-foreground text-xs">{heatLabel(heatSelected)}</span>
                                <span class="font-semibold tabular-nums text-xs {heatSelectedStats.savings >= 0 ? 'text-green-600' : 'text-red-600'}">
                                    {fmtEur(heatSelectedStats.savings)}
                                </span>
                                <span class="text-muted-foreground tabular-nums text-[10px]">
                                    {heatSelectedStats.netKwh.toFixed(2)} kWh netto · kost {fmtEur(heatSelectedStats.actualCost)}
                                </span>
                            {:else}
                                <span class="text-muted-foreground/40 text-xs">tik op een vakje voor details</span>
                            {/if}
                        </div>
                        <div class="flex items-center justify-end gap-1.5 text-[9px] text-muted-foreground">
                            duurder
                            <span class="w-2.5 h-2.5 rounded-[2px]" style="background: rgba(239,68,68,0.9)"></span>
                            <span class="w-2.5 h-2.5 rounded-[2px]" style="background: rgba(239,68,68,0.4)"></span>
                            <span class="w-2.5 h-2.5 rounded-[2px]" style="background: rgba(148,163,184,0.12)"></span>
                            <span class="w-2.5 h-2.5 rounded-[2px]" style="background: rgba(34,197,94,0.4)"></span>
                            <span class="w-2.5 h-2.5 rounded-[2px]" style="background: rgba(34,197,94,0.9)"></span>
                            bespaard
                        </div>
                    {/if}
                </div>
            </div>
        {/if}
    </div>
</div>
