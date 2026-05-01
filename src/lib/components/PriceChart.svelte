<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import type { HourlyPrice, Thresholds } from '$lib/types.js';
    import { getAlertLevel } from '$lib/priceUtils.js';

    let {
        prices,
        thresholds,
        currentHour = -1
    }: { prices: HourlyPrice[]; thresholds: Thresholds; currentHour?: number } = $props();

    let canvas: HTMLCanvasElement;
    let chart: import('chart.js').Chart | null = null;

    const COLORS: Record<string, string> = {
        red: 'rgba(239, 68, 68, 0.85)',
        amber: 'rgba(245, 158, 11, 0.85)',
        green: 'rgba(34, 197, 94, 0.85)',
        normal: 'rgba(148, 163, 184, 0.75)'
    };

    const COLORS_CURRENT: Record<string, string> = {
        red: 'rgba(239, 68, 68, 1)',
        amber: 'rgba(245, 158, 11, 1)',
        green: 'rgba(34, 197, 94, 1)',
        normal: 'rgba(100, 116, 139, 0.9)'
    };

    function buildDataset(prices: HourlyPrice[]) {
        const sorted = [...prices].sort((a, b) => a.hour - b.hour);
        const data = sorted.map((p) => p.centPerKwh);
        const labels = sorted.map((p) => `${String(p.hour).padStart(2, '0')}:00`);

        const bgColors = sorted.map((p, i) => {
            const level = getAlertLevel(p.centPerKwh, thresholds);
            return i === currentHour ? COLORS_CURRENT[level] : COLORS[level];
        });

        const borderColors = sorted.map((_, i) =>
            i === currentHour ? 'rgba(59, 130, 246, 1)' : 'transparent'
        );

        const borderWidths = sorted.map((_, i) => (i === currentHour ? 2 : 0));

        return { data, labels, bgColors, borderColors, borderWidths };
    }

    async function createChart() {
        const { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip } =
            await import('chart.js');
        Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

        const { data, labels, bgColors, borderColors, borderWidths } = buildDataset(prices);

        chart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        data,
                        backgroundColor: bgColors,
                        borderColor: borderColors,
                        borderWidth: borderWidths,
                        borderRadius: 5,
                        borderSkipped: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 300 },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 8,
                            font: { size: 11 },
                            color: '#94a3b8'
                        }
                    },
                    y: {
                        grid: {
                            color: (ctx) => {
                                if (ctx.tick.value === 0) return 'rgba(100,100,100,0.4)';
                                return 'rgba(0,0,0,0.05)';
                            },
                            lineWidth: (ctx) => (ctx.tick.value === 0 ? 2 : 1)
                        },
                        ticks: {
                            callback: (v) => `${v}¢`,
                            font: { size: 11 },
                            color: '#94a3b8'
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(255,255,255,0.95)',
                        titleColor: '#1e293b',
                        bodyColor: '#475569',
                        borderColor: '#e2e8f0',
                        borderWidth: 1,
                        cornerRadius: 10,
                        padding: 10,
                        callbacks: {
                            title: (items) => {
                                const h = items[0].dataIndex;
                                return `${String(h).padStart(2, '0')}:00–${String(h + 1).padStart(2, '0')}:00`;
                            },
                            label: (item) => ` ${Number(item.raw).toFixed(2)} ¢/kWh`
                        }
                    }
                }
            }
        });
    }

    function updateChart() {
        if (!chart) return;
        const { data, labels, bgColors, borderColors, borderWidths } = buildDataset(prices);
        chart.data.labels = labels;
        chart.data.datasets[0].data = data;
        chart.data.datasets[0].backgroundColor = bgColors;
        chart.data.datasets[0].borderColor = borderColors;
        chart.data.datasets[0].borderWidth = borderWidths;
        chart.update('none');
    }

    onMount(() => {
        createChart();
    });

    onDestroy(() => {
        chart?.destroy();
    });

    $effect(() => {
        prices; // track reactivity
        thresholds;
        currentHour;
        if (chart) updateChart();
    });
</script>

<div class="h-56 w-full">
    <canvas bind:this={canvas}></canvas>
</div>
