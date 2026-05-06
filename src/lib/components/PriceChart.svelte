<script lang="ts">
    import { onMount } from 'svelte';
    import type { HourlyPrice, Thresholds } from '$lib/types.js';
    import { getAlertLevel, formatEuroPrice } from '$lib/priceUtils.js';

    let {
        prices,
        thresholds,
        currentHour = -1,
        containerClass = 'h-64'
    }: {
        prices: HourlyPrice[];
        thresholds: Thresholds;
        currentHour?: number;
        containerClass?: string;
    } = $props();

    let canvas: HTMLCanvasElement;
    let chart: import('chart.js').Chart | null = null;

    // hoveredBar: follows finger/mouse during motion, clears when lifted
    // pinnedBar:  set by a tap, persists until tapped again (toggle)
    let hoveredBar = -1;
    let pinnedBar  = -1;
    let selectedPrice = $state<HourlyPrice | null>(null);

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
        chart.data.datasets[0].data            = data;
        chart.data.datasets[0].backgroundColor = bgColors;
        chart.data.datasets[0].borderColor     = borderColors;
        chart.data.datasets[0].borderWidth     = borderWidths;
        chart.update('none');
    }

    function syncPrice() {
        const active  = hoveredBar >= 0 ? hoveredBar : pinnedBar;
        selectedPrice = active >= 0 ? sorted()[active] : null;
    }

    // Find the bar index closest to a given canvas x-coordinate.
    // Returns -1 if the x is outside the chart plot area.
    function barAtX(clientX: number): number {
        if (!chart) return -1;
        const rect = canvas.getBoundingClientRect();
        const x    = clientX - rect.left;
        const ca   = chart.chartArea;
        if (x < ca.left || x > ca.right) return -1;

        const meta = chart.getDatasetMeta(0);
        let best = -1, bestDist = Infinity;
        for (let i = 0; i < meta.data.length; i++) {
            const d = Math.abs((meta.data[i] as { x: number }).x - x);
            if (d < bestDist) { bestDist = d; best = i; }
        }
        return best;
    }

    function handleTap(clientX: number) {
        const idx = barAtX(clientX);
        pinnedBar = idx === pinnedBar ? -1 : idx;
        syncPrice();
        updateChart();
    }

    async function createChart() {
        const { Chart, BarController, BarElement, CategoryScale, LinearScale } =
            await import('chart.js');
        Chart.register(BarController, BarElement, CategoryScale, LinearScale);

        const { data, labels, bgColors, borderColors, borderWidths } = buildDataset();

        chart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: bgColors,
                    borderColor:     borderColors,
                    borderWidth:     borderWidths,
                    borderRadius:    5,
                    borderSkipped:   false
                }]
            },
            options: {
                responsive:          true,
                maintainAspectRatio: false,
                animation:           { duration: 300 },
                // intersect:false lets hover fire even between bars → smooth slide
                interaction: { mode: 'index', intersect: false },
                onHover: (_, elements) => {
                    const idx = elements.length > 0 ? elements[0].index : -1;
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

        // Chart.js onClick is unreliable on iOS Safari (touch-synthesised click
        // fires with empty elements). Use native touch/click events instead.
        let touchStartX = 0;
        let isDrag      = false;

        function onTouchStart(e: TouchEvent) {
            touchStartX = e.touches[0].clientX;
            isDrag      = false;
        }
        function onTouchMove(e: TouchEvent) {
            if (Math.abs(e.touches[0].clientX - touchStartX) > 8) isDrag = true;
        }
        function onTouchEnd(e: TouchEvent) {
            if (!isDrag) handleTap(e.changedTouches[0].clientX);
        }
        // Desktop mouse click (not preceded by touch)
        let lastTouchEnd = 0;
        function onTouchEndTime() { lastTouchEnd = Date.now(); }
        function onClick(e: MouseEvent) {
            // Ignore the ghost click browsers fire ~300ms after touchend
            if (Date.now() - lastTouchEnd < 500) return;
            handleTap(e.clientX);
        }

        canvas.addEventListener('touchstart',  onTouchStart,   { passive: true });
        canvas.addEventListener('touchmove',   onTouchMove,    { passive: true });
        canvas.addEventListener('touchend',    onTouchEnd,     { passive: true });
        canvas.addEventListener('touchend',    onTouchEndTime, { passive: true });
        canvas.addEventListener('click',       onClick);

        return () => {
            canvas.removeEventListener('touchstart',  onTouchStart);
            canvas.removeEventListener('touchmove',   onTouchMove);
            canvas.removeEventListener('touchend',    onTouchEnd);
            canvas.removeEventListener('touchend',    onTouchEndTime);
            canvas.removeEventListener('click',       onClick);
            chart?.destroy();
        };
    });

    $effect(() => {
        prices; thresholds; currentHour;
        if (chart) {
            hoveredBar    = -1;
            pinnedBar     = -1;
            selectedPrice = null;
            updateChart();
        }
    });
</script>

<div class="flex flex-col {containerClass} w-full">
    <div class="flex-1 min-h-0">
        <canvas bind:this={canvas}></canvas>
    </div>

    <!-- Touch info strip -->
    <div class="h-8 flex-shrink-0 flex items-center justify-center gap-3 text-sm select-none">
        {#if selectedPrice}
            <span class="text-muted-foreground tabular-nums">
                {String(selectedPrice.hour).padStart(2, '0')}:00–{String(selectedPrice.hour + 1).padStart(2, '0')}:00
            </span>
            <span class="font-semibold tabular-nums">
                {formatEuroPrice(selectedPrice.centPerKwh)}/kWh
            </span>
        {:else}
            <span class="text-muted-foreground/40 text-xs">← sleep voor details →</span>
        {/if}
    </div>
</div>
