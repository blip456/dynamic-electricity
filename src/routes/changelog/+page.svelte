<script lang="ts">
    import { ArrowLeft } from '@lucide/svelte';

    let { data } = $props();
</script>

<svelte:head>
    <title>Stroom — Wat is er nieuw</title>
</svelte:head>

<div class="min-h-screen bg-background">
    <div class="mx-auto max-w-2xl px-4 py-6 pb-safe flex flex-col gap-5">

        <!-- Header -->
        <div class="flex items-center gap-2">
            <a
                href="/settings"
                class="p-2 -ml-2 rounded-xl hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                aria-label="Terug"
            >
                <ArrowLeft size={20} />
            </a>
            <span class="font-semibold text-lg text-foreground">Wat is er nieuw</span>
        </div>

        <div class="bg-card rounded-2xl border shadow-sm p-5">
            {#if data.html}
                <div class="changelog text-sm">
                    <!-- eslint-disable-next-line svelte/no-at-html-tags — own CHANGELOG.md, build-time content -->
                    {@html data.html}
                </div>
            {:else}
                <p class="text-sm text-muted-foreground">
                    Nog geen releases. Het overzicht verschijnt hier na de eerste release.
                </p>
            {/if}
        </div>
    </div>
</div>

<style>
    .changelog :global(h1) {
        display: none; /* "Changelog" file title — the page has its own header */
    }
    .changelog :global(h2) {
        font-size: 1.05rem;
        font-weight: 700;
        margin: 1.25rem 0 0.25rem;
    }
    .changelog :global(h2:first-of-type) {
        margin-top: 0;
    }
    .changelog :global(h3) {
        font-size: 0.8rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--muted-foreground, #64748b);
        margin: 0.75rem 0 0.25rem;
    }
    .changelog :global(ul) {
        list-style: disc;
        padding-left: 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }
    .changelog :global(li) {
        line-height: 1.5;
    }
    .changelog :global(a) {
        font-family: ui-monospace, monospace;
        font-size: 0.75rem;
        color: var(--muted-foreground, #64748b);
        text-decoration: underline;
        text-underline-offset: 2px;
    }
    .changelog :global(p) {
        margin: 0.25rem 0;
    }
</style>
