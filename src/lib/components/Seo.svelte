<script lang="ts">
    import { page } from '$app/state';

    let {
        title,
        description,
        keywords = '',
        noindex = false
    }: {
        title: string;
        description: string;
        keywords?: string;
        noindex?: boolean;
    } = $props();

    // Absolute URLs are only known at runtime — during prerendering the
    // origin is a placeholder, so canonical/OG-url tags are omitted there.
    const origin = $derived(page.url.protocol === 'https:' ? page.url.origin : null);
    // Query params (?date=, ?week=) are day-browsing state, not separate
    // pages — canonicalise them onto the path.
    const canonical = $derived(origin ? origin + page.url.pathname : null);
</script>

<svelte:head>
    <title>{title}</title>
    <meta name="description" content={description} />
    {#if keywords}
        <meta name="keywords" content={keywords} />
    {/if}
    {#if noindex}
        <meta name="robots" content="noindex" />
    {:else if canonical}
        <link rel="canonical" href={canonical} />
    {/if}

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Stroom" />
    <meta property="og:locale" content="nl_BE" />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    {#if canonical}
        <meta property="og:url" content={canonical} />
        <meta property="og:image" content="{origin}/icons/icon-512.png" />
    {/if}

    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content={title} />
    <meta name="twitter:description" content={description} />
</svelte:head>
