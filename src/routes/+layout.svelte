<script lang="ts">
    import '../app.css';
    import { onMount } from 'svelte';
    import { settings } from '$lib/stores.svelte.js';
    import { browser } from '$app/environment';

    let { children, data } = $props();

    onMount(() => {
        settings.load();
    });

    $effect(() => {
        if (browser) settings.save();
    });
</script>

{@render children()}
