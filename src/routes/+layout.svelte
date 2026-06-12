<script lang="ts">
    import '../app.css';
    import { onMount } from 'svelte';
    import { afterNavigate } from '$app/navigation';
    import { settings } from '$lib/stores.svelte.js';
    import { meterStore } from '$lib/meterStore.svelte.js';
    import { priceStore } from '$lib/priceStore.svelte.js';
    import { initAnalytics, trackPageView } from '$lib/analytics.js';
    import { browser } from '$app/environment';

    let { children, data } = $props();

    onMount(() => {
        settings.load();
        meterStore.load();
        priceStore.load();
        initAnalytics(data.gaMeasurementId);
    });

    // One page_view per route; query-only navigations (date/week browsing)
    // are tracked as feature events instead.
    let lastTrackedPath = '';
    afterNavigate(({ to }) => {
        const path = to?.url.pathname;
        if (!path || path === lastTrackedPath) return;
        lastTrackedPath = path;
        trackPageView(path);
    });

    $effect(() => {
        if (browser) settings.save();
    });
</script>

{@render children()}
