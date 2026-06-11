<script lang="ts">
    import { onMount } from 'svelte';
    import type { HourlyPrice, HourlyMeterData, Thresholds } from '$lib/types.js';
    import { getAlertLevel, formatEuroPrice } from '$lib/priceUtils.js';

    let {
        prices,
        thresholds,
        meterData = [],
        currentHour = -1,
        containerClass = 'h-64'
    }: {
        prices: HourlyPrice[];
        thresholds: Thresholds;
        meterData?: HourlyMeterData[];
        currentHour?: number;
        containerClass?: string;
    } = $props();

    let canvas: HTMLCanvasElement;
    let chart: import('chart.js').Chart | null = null;

    let hoveredBar         = -1;
    let pinnedBar          = -1;
    let suppressHoverUntil = 0;
    let selectedPrice      = $state<HourlyPrice | null>(null);

    const COLORS: Record<string, string> = {
        green: 'rgba(34, 197, 94, 0.80)',
        blue:  'rgba(59, 130, 246, 0.80)',
        amber: 'rgba(245, 158, 11, 0.80)',
        red:   'rgba(239, 68, 68, 0.80)'
    };
    const COLORS_DIM: Record<string, string> = {
        green: 'rgba(34, 197, 94, 0.18)',
        blue:  'rgba(59, 130, 246, 0.18)',
        amber: 'rgba(245, 158, 11, 0.18)',
        red:   'rgba(239, 68, 68, 0.18)'
    };
    const COLORS_FULL: Record<string, string> = {
        green: 'rgba(34, 197, 94, 1)',
        blue:  'rgba(59, 130, 246, 1)',
        amber: 'rgba(245, 158, 11, 1)',
        red:   'rgba(239, 68, 68, 1)'
    };

    function sorted() {
        return [...prices].sort((a, b) => a.hour - b.hour);
    }

    // kWh consumption line aligned with sorted price bars (right axis, null = no data)
    function consumptionLine(): (number | null)[] {
        const rows = sorted();
        return rows.map((p) => {
            const m = meterData.find((d) => d.hour === p.hour);
            return m ? m.consumptionKwh : null;
        });
    }

    function buildDataset() {
        const rows   = sorted();
        const data   = rows.map((p) => p.centPerKwh);
        const labels = rows.map((p) => `${String(p.hour).padStart(2, '0')}:00`);

        const active       = hoveredBar >= 0 ? hoveredBar : pinnedBar;
        const hasSelection = active >= 0;

        const bgColors = rows.map((p, i) => {
            const level = getAlertLevel(p.centPerKwh, thresholds);
            if (hasSelection) return i === active ? COLORS_FULL[level] : COLORS_DIM[level];
            return i === currentHour ? COLORS_FULL[level] : COLORS[level];
        });
        const borderColors = rows.map((_, i) => {
            if (hasSelection && i === active) return 'rgba(255,255,255,0.85)';
            if (!hasSelection && i === currentHour) return 'rgba(59,130,246,1)';
            return 'transparent';
        });
        const borderWidths = rows.map((_, i) => {
            if (hasSelection && i === active) return 2.5;
            if (!hasSelection && i === currentHour) return 2;
            return 0;
        });

        return { data, labels, bgColors, borderColors, borderWidths };
    }

    function updateChart() {
        if (!chart) return;
        const { data, labels, bgColors, borderColors, borderWidths } = buildDataset();
        chart.data.labels = labels;

        // Dataset 0 — price bars
        chart.data.datasets[0].data            = data;
        (chart.data.datasets[0] as any).backgroundColor = bgColors;
        (chart.data.datasets[0] as any).borderColor     = borderColors;
        (chart.data.datasets[0] as any).borderWidth     = borderWidths;

        // Dataset 1 — kWh consumption line (right axis)
        const lineData = consumptionLine();
        chart.data.datasets[1].data = lineData;
        const hasLine = lineData.some((v) => v !== null);
        (chart.options.scales as any).y2.display = hasLine;

        chart.update('none');
    }

    function syncPrice() {
        const active  = hoveredBar >= 0 ? hoveredBar : pinnedBar;
        selectedPrice = active >= 0 ? sorted()[active] : null;
    }

    async function createChart() {
        const {
            Chart, BarController, BarElement,
            LineController, LineElement, PointElement,
            CategoryScale, LinearScale, Filler
        } = await import('chart.js');
        Chart.register(
            BarController, BarElement,
            LineController, LineElement, PointElement,
            CategoryScale, LinearScale, Filler
        );

        // Align y2 zero (0 kWh) with y zero (0 €/kWh).
        // When prices dip below zero the left axis shifts its baseline upward;
        // this hook extends y2.min to a phantom negative so the two zeros stay
        // on the same pixel row. It runs afterBuildTicks (not afterDataLimits)
        // because tick generation re-rounds min/max afterwards, which would
        // break exact alignment — at this point y is final and y2's ticks
        // (all ≥ 0) keep their nice spacing while min is extended downward.
        const alignZeroPlugin = {
            id: 'alignZero',
            afterBuildTicks(chart: any, args: any) {
                if (args.scale.id !== 'y2' || !args.scale.options.display) return;
                const y = chart.scales['y'];
                if (!y || y.min >= 0) return;
                const zeroFrac = -y.min / (y.max - y.min);
                const y2Max = args.scale.max;
                if (y2Max > 0) args.scale.min = -(y2Max * zeroFrac) / (1 - zeroFrac);
            }
        };

        const { data, labels, bgColors, borderColors, borderWidths } = buildDataset();
        const lineData = consumptionLine();
        const hasLine  = lineData.some((v) => v !== null);

        chart = new Chart(canvas, {
            plugins: [alignZeroPlugin],
            data: {
                labels,
                datasets: [
                    // Dataset 0 — price bars
                    {
                        type: 'bar',
                        data,
                        backgroundColor: bgColors,
                        borderColor:     borderColors,
                        borderWidth:     borderWidths,
                        borderRadius:    5,
                        borderSkipped:   false,
                        yAxisID:         'y',
                        order:           2
                    },
                    // Dataset 1 — kWh consumption line (right axis, blue)
                    {
                        type:            'line',
                        data:            lineData,
                        yAxisID:         'y2',
                        borderColor:     'rgba(59, 130, 246, 0.85)',
                        backgroundColor: 'rgba(59, 130, 246, 0.08)',
                        borderWidth:     2,
                        pointRadius:     0,
                        pointHoverRadius: 4,
                        tension:         0.35,
                        fill:            true,
                        spanGaps:        false,
                        order:           1
                    }
                ]
            },
            options: {
                responsive:          true,
                maintainAspectRatio: false,
                animation:           { duration: 300 },
                interaction: { mode: 'index', intersect: false },
                onHover: (_, elements) => {
                    if (Date.now() < suppressHoverUntil) return;
                    const barEls = elements.filter((e) => e.datasetIndex === 0);
                    const idx    = barEls.length > 0 ? barEls[0].index : -1;
                    if (idx !== hoveredBar) {
                        hoveredBar = idx;
                        syncPrice();
                        updateChart();
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            maxRotation:   0,
                            autoSkip:      true,
                            maxTicksLimit: 8,
                            font:          { size: 11 },
                            color:         '#94a3b8'
                        }
                    },
                    y: {
                        grid: {
                            color:     (ctx) => ctx.tick.value === 0 ? 'rgba(100,100,100,0.4)' : 'rgba(0,0,0,0.05)',
                            lineWidth: (ctx) => ctx.tick.value === 0 ? 2 : 1
                        },
                        ticks: {
                            callback: (v) => `€${(Number(v) / 100).toFixed(4).replace('.', ',')}`,
                            font:     { size: 11 },
                            color:    '#94a3b8'
                        }
                    },
                    y2: {
                        type:     'linear',
                        position: 'right',
                        display:  hasLine,
                        grid:     { display: false },
                        ticks: {
                            callback: (v) => `${Number(v).toFixed(1)} kWh`,
                            font:     { size: 10 },
                            color:    'rgba(59, 130, 246, 0.7)'
                        }
                    }
                },
                plugins: {
                    legend:  { display: false },
                    tooltip: { enabled: false }
                }
            }
        });
    }

    onMount(() => {
        createChart();

        // Detect the bar under a canvas-relative point using a fake Chart.js event.
        // { native: true } tells Chart.js to use x/y directly as canvas coords,
        // bypassing the clientX→canvas conversion that breaks on iOS TouchEvents.
        function getBarAtPoint(x: number, y: number): number {
            if (!chart) return -1;
            const fakeEvent = { native: true, x, y } as unknown as Event;
            const hits = chart.getElementsAtEventForMode(fakeEvent, 'index', { intersect: false }, false);
            return hits.length > 0 ? hits[0].index : -1;
        }

        let touchStartBar = -1;
        let touchStartX   = 0;
        let touchStartY   = 0;
        let touchMoved    = false;

        function onTouchStart(e: TouchEvent) {
            if (e.touches.length !== 1) return;
            const t    = e.touches[0];
            const rect = canvas.getBoundingClientRect();
            touchStartX   = t.clientX - rect.left;
            touchStartY   = t.clientY - rect.top;
            touchMoved    = false;
            touchStartBar = getBarAtPoint(touchStartX, touchStartY);
        }

        function onTouchMove(e: TouchEvent) {
            if (e.touches.length !== 1) return;
            const t    = e.touches[0];
            const rect = canvas.getBoundingClientRect();
            const dx   = (t.clientX - rect.left) - touchStartX;
            const dy   = (t.clientY - rect.top)  - touchStartY;
            if (Math.abs(dx) > 8 || Math.abs(dy) > 8) touchMoved = true;
        }

        function onTouchEnd() {
            // Suppress the synthetic mousemove browsers fire after touchend
            hoveredBar         = -1;
            suppressHoverUntil = Date.now() + 600;

            if (touchMoved) { syncPrice(); updateChart(); return; }

            if (touchStartBar < 0) {
                pinnedBar = -1;
            } else {
                pinnedBar = touchStartBar === pinnedBar ? -1 : touchStartBar;
            }
            syncPrice();
            updateChart();
        }

        function onDocumentTouchStart(e: TouchEvent) {
            if (pinnedBar < 0) return;
            if (!canvas.contains(e.target as Node)) {
                pinnedBar = -1;
                syncPrice();
                updateChart();
            }
        }

        let lastTouchEndMs = 0;
        function onTouchEndTime() { lastTouchEndMs = Date.now(); }

        function onClick() {
            if (Date.now() - lastTouchEndMs < 500) return;
            if (hoveredBar < 0) {
                if (pinnedBar >= 0) { pinnedBar = -1; syncPrice(); updateChart(); }
                return;
            }
            pinnedBar = hoveredBar === pinnedBar ? -1 : hoveredBar;
            syncPrice();
            updateChart();
        }

        canvas.addEventListener('touchstart', onTouchStart,           { passive: true });
        canvas.addEventListener('touchmove',  onTouchMove,            { passive: true });
        canvas.addEventListener('touchend',   onTouchEnd,             { passive: true });
        canvas.addEventListener('touchend',   onTouchEndTime,         { passive: true });
        canvas.addEventListener('click',      onClick);
        document.addEventListener('touchstart', onDocumentTouchStart, { passive: true });

        return () => {
            canvas.removeEventListener('touchstart', onTouchStart);
            canvas.removeEventListener('touchmove',  onTouchMove);
            canvas.removeEventListener('touchend',   onTouchEnd);
            canvas.removeEventListener('touchend',   onTouchEndTime);
            canvas.removeEventListener('click',      onClick);
            document.removeEventListener('touchstart', onDocumentTouchStart);
            chart?.destroy();
        };
    });

    $effect(() => {
        prices; thresholds; currentHour; meterData;
        if (chart) {
            hoveredBar    = -1;
            pinnedBar     = -1;
            selectedPrice = null;
            updateChart();
        }
    });

    // Cost for selected hour (energy cost only, excl. fixed network/tax costs)
    const activeMeter = $derived(
        selectedPrice ? meterData.find((d) => d.hour === selectedPrice!.hour) ?? null : null
    );
    const netCostEur = $derived(
        activeMeter && selectedPrice
            ? ((activeMeter.consumptionKwh - activeMeter.injectionKwh) * selectedPrice.centPerKwh) / 100
            : null
    );
</script>

<div class="flex flex-col {containerClass} w-full">
    <div class="flex-1 min-h-0">
        <canvas bind:this={canvas}></canvas>
    </div>

    <!-- Info strip -->
    <div class="h-10 flex-shrink-0 flex items-center justify-center gap-3 text-sm select-none">
        {#if selectedPrice}
            <span class="text-muted-foreground tabular-nums text-xs">
                {String(selectedPrice.hour).padStart(2, '0')}:00–{String(selectedPrice.hour + 1).padStart(2, '00')}:00
            </span>
            <span class="font-semibold tabular-nums">
                {formatEuroPrice(selectedPrice.centPerKwh)}/kWh
            </span>
            {#if activeMeter}
                <span class="text-muted-foreground tabular-nums text-xs">
                    ↓ {activeMeter.consumptionKwh.toFixed(3)} kWh
                </span>
                {#if activeMeter.injectionKwh > 0}
                    <span class="text-muted-foreground tabular-nums text-xs">
                        ↑ {activeMeter.injectionKwh.toFixed(3)} kWh
                    </span>
                {/if}
                {#if netCostEur !== null}
                    <span class="font-medium tabular-nums text-xs {netCostEur < 0 ? 'text-green-500' : 'text-foreground'}">
                        {netCostEur < 0 ? '−' : ''}€{Math.abs(netCostEur).toFixed(4)}
                    </span>
                {/if}
            {/if}
        {:else}
            <span class="text-muted-foreground/40 text-xs">← sleep voor details →</span>
        {/if}
    </div>
</div>
