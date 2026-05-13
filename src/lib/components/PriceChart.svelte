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

    // hoveredBar: follows finger/mouse during slide; clears on lift
    // pinnedBar:  persists after a tap; tap same bar to clear
    // suppressHoverUntil: timestamp until which onHover is ignored (suppresses
    //   the synthetic mousemove Chrome fires after touchend in DevTools/browsers)
    let hoveredBar          = -1;
    let pinnedBar           = -1;
    let suppressHoverUntil  = 0;
    let selectedPrice       = $state<HourlyPrice | null>(null);

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
                interaction: { mode: 'index', intersect: false },
                onHover: (_, elements) => {
                    if (Date.now() < suppressHoverUntil) return;
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

        // Detect which bar index sits under a touch/click point using Chart.js hit detection.
        function getBarAtPoint(x: number, y: number): number {
            if (!chart) return -1;
            // Chart.js reads .native to decide whether to use e.x/e.y directly.
            const fakeEvent = { native: true, x, y } as unknown as Event;
            const hits = chart.getElementsAtEventForMode(fakeEvent, 'index', { intersect: false }, false);
            return hits.length > 0 ? hits[0].index : -1;
        }

        // Touch handling: detect tapped bar at touchstart so we don't depend on
        // onHover (which fires from touchmove and is never called on a still tap).
        let touchStartBar = -1;
        let touchStartX   = 0;
        let touchStartY   = 0;
        let touchMoved    = false;

        function onTouchStart(e: TouchEvent) {
            if (e.touches.length !== 1) return;
            const t = e.touches[0];
            const rect = canvas.getBoundingClientRect();
            touchStartX   = t.clientX - rect.left;
            touchStartY   = t.clientY - rect.top;
            touchMoved    = false;
            touchStartBar = getBarAtPoint(touchStartX, touchStartY);
        }

        function onTouchMove(e: TouchEvent) {
            if (e.touches.length !== 1) return;
            const t = e.touches[0];
            const rect = canvas.getBoundingClientRect();
            const dx = (t.clientX - rect.left) - touchStartX;
            const dy = (t.clientY - rect.top)  - touchStartY;
            if (Math.abs(dx) > 8 || Math.abs(dy) > 8) touchMoved = true;
        }

        function onTouchEnd() {
            // Always clear hoveredBar on lift and suppress the synthetic mousemove
            // that browsers/DevTools fire after touchend (which would re-set hoveredBar).
            hoveredBar = -1;
            suppressHoverUntil = Date.now() + 600;

            if (touchMoved) { syncPrice(); updateChart(); return; }
            if (touchStartBar < 0) {
                // tapped canvas but missed all bars → clear pin
                pinnedBar = -1;
                syncPrice();
                updateChart();
                return;
            }
            // same bar toggles off, different bar pins the new one
            pinnedBar = touchStartBar === pinnedBar ? -1 : touchStartBar;
            syncPrice();
            updateChart();
        }

        // Clear pin when the user touches anywhere outside the canvas.
        function onDocumentTouchStart(e: TouchEvent) {
            if (pinnedBar < 0) return;
            if (!canvas.contains(e.target as Node)) {
                pinnedBar = -1;
                syncPrice();
                updateChart();
            }
        }

        // Desktop: guard against the ghost click iOS fires ~300ms after touchend.
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
