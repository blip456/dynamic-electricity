<script lang="ts">
    import type { AlertLevel } from '$lib/types.js';

    let { level, label }: { level: AlertLevel; label: string } = $props();

    const styles: Record<AlertLevel, string> = {
        green: 'bg-green-100 text-green-700 border-green-200',
        blue: 'bg-blue-100 text-blue-700 border-blue-200',
        amber: 'bg-amber-100 text-amber-700 border-amber-200',
        red: 'bg-red-100 text-red-700 border-red-200'
    };

    const dots: Record<AlertLevel, string> = {
        green: 'bg-green-500',
        blue: 'bg-blue-500',
        amber: 'bg-amber-500',
        red: 'bg-red-500'
    };
</script>

<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border {styles[level]}">
    <span class="w-1.5 h-1.5 rounded-full {dots[level]}"></span>
    {label}
</span>
