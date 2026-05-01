<script lang="ts">
    import { ArrowLeft, Bell, BellOff, Zap } from '@lucide/svelte';
    import { browser } from '$app/environment';
    import { settings } from '$lib/stores.svelte.js';
    import { subscribeToPush, unsubscribeFromPush, getNotificationPermission } from '$lib/notifications.js';

    let { data } = $props();

    let notifStatus = $state<'idle' | 'loading' | 'error'>('idle');
    let permissionState = $state<NotificationPermission>('default');

    $effect(() => {
        if (browser) {
            getNotificationPermission().then((p) => (permissionState = p));
        }
    });

    async function toggleNotifications() {
        if (!data.vapidPublicKey) {
            alert('VAPID key niet geconfigureerd. Stel PUBLIC_VAPID_KEY in als omgevingsvariabele.');
            return;
        }

        notifStatus = 'loading';
        try {
            if (settings.notificationsEnabled) {
                await unsubscribeFromPush();
                settings.notificationsEnabled = false;
            } else {
                const ok = await subscribeToPush(data.vapidPublicKey, settings.thresholds);
                if (ok) {
                    settings.notificationsEnabled = true;
                    permissionState = await getNotificationPermission();
                } else {
                    notifStatus = 'error';
                    return;
                }
            }
            notifStatus = 'idle';
        } catch (e) {
            console.error(e);
            notifStatus = 'error';
        }
    }

    function clamp(value: number, min: number, max: number) {
        return Math.min(Math.max(value, min), max);
    }
</script>

<svelte:head>
    <title>Instellingen — Stroom</title>
</svelte:head>

<div class="min-h-screen bg-background">
    <div class="mx-auto max-w-2xl px-4 py-6 flex flex-col gap-6">

        <!-- Header -->
        <div class="flex items-center gap-3">
            <a
                href="/"
                class="p-2 rounded-xl hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                aria-label="Terug"
            >
                <ArrowLeft size={20} />
            </a>
            <h1 class="text-lg font-semibold text-foreground">Instellingen</h1>
        </div>

        <!-- Notifications section -->
        <section class="bg-card rounded-2xl border shadow-sm overflow-hidden">
            <div class="px-4 py-3 border-b">
                <h2 class="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Bell size={16} />
                    Meldingen
                </h2>
            </div>

            <div class="p-4 flex flex-col gap-4">
                {#if permissionState === 'denied'}
                    <div class="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700">
                        Meldingen zijn geblokkeerd in je browser. Sta ze toe via iPhone-instellingen → Safari → Meldingen.
                    </div>
                {/if}

                {#if !browser || !('PushManager' in window)}
                    <div class="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700">
                        Meldingen vereisen dat je de app toevoegt aan je beginscherm (iOS 16.4+).
                    </div>
                {/if}

                <div class="flex items-start justify-between gap-4">
                    <div>
                        <p class="text-sm font-medium text-foreground">Prijswaarschuwingen</p>
                        <p class="text-xs text-muted-foreground mt-0.5">
                            Ontvang meldingen bij rode en oranje prijsalerts, ook als de app gesloten is.
                        </p>
                    </div>
                    <button
                        onclick={toggleNotifications}
                        disabled={notifStatus === 'loading' || permissionState === 'denied'}
                        class="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50
                            {settings.notificationsEnabled
                                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                                : 'bg-accent text-accent-foreground hover:bg-border'}"
                    >
                        {#if notifStatus === 'loading'}
                            <span class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                        {:else if settings.notificationsEnabled}
                            <Bell size={14} />
                            Aan
                        {:else}
                            <BellOff size={14} />
                            Uit
                        {/if}
                    </button>
                </div>

                {#if notifStatus === 'error'}
                    <p class="text-xs text-destructive">
                        Kon meldingen niet inschakelen. Controleer of je de permissie hebt gegeven.
                    </p>
                {/if}
            </div>
        </section>

        <!-- Alert thresholds section -->
        <section class="bg-card rounded-2xl border shadow-sm overflow-hidden">
            <div class="px-4 py-3 border-b">
                <h2 class="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Zap size={16} />
                    Drempelwaarden (¢/kWh)
                </h2>
            </div>

            <div class="p-4 flex flex-col gap-5">

                <!-- Red threshold -->
                <div>
                    <div class="flex items-center justify-between mb-2">
                        <div class="text-sm font-medium text-foreground flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-red-500"></span>
                            Rode alert
                        </div>
                        <div class="flex items-center gap-1">
                            <button
                                onclick={() => { settings.red = clamp(settings.red - 5, -100, settings.amber - 1); }}
                                class="w-7 h-7 rounded-lg bg-accent hover:bg-border flex items-center justify-center text-sm font-bold transition-colors"
                            >−</button>
                            <span class="text-sm font-mono w-14 text-center tabular-nums">
                                ≤ {settings.red}¢
                            </span>
                            <button
                                onclick={() => { settings.red = clamp(settings.red + 5, -100, settings.amber - 1); }}
                                class="w-7 h-7 rounded-lg bg-accent hover:bg-border flex items-center justify-center text-sm font-bold transition-colors"
                            >+</button>
                        </div>
                    </div>
                    <p class="text-xs text-muted-foreground">
                        Negatieve prijs die voldoende is om vaste kosten te dekken (u verdient effectief geld).
                    </p>
                </div>

                <div class="border-t"></div>

                <!-- Amber threshold -->
                <div>
                    <div class="flex items-center justify-between mb-2">
                        <div class="text-sm font-medium text-foreground flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-amber-500"></span>
                            Oranje alert
                        </div>
                        <div class="flex items-center gap-1">
                            <button
                                onclick={() => { settings.amber = clamp(settings.amber - 5, settings.red + 1, 9); }}
                                class="w-7 h-7 rounded-lg bg-accent hover:bg-border flex items-center justify-center text-sm font-bold transition-colors"
                            >−</button>
                            <span class="text-sm font-mono w-14 text-center tabular-nums">
                                ≤ {settings.amber}¢
                            </span>
                            <button
                                onclick={() => { settings.amber = clamp(settings.amber + 5, settings.red + 1, 9); }}
                                class="w-7 h-7 rounded-lg bg-accent hover:bg-border flex items-center justify-center text-sm font-bold transition-colors"
                            >+</button>
                        </div>
                    </div>
                    <p class="text-xs text-muted-foreground">
                        Prijs waarbij u minder betaalt dan normaal (onder deze grens melding sturen).
                    </p>
                </div>

                <div class="border-t"></div>

                <!-- Info row -->
                <div class="rounded-xl bg-muted p-3 text-xs text-muted-foreground space-y-1">
                    <p>🟢 <strong>Groen</strong>: prijs tussen oranje drempel en 10¢/kWh (geen melding)</p>
                    <p>⬜ <strong>Normaal</strong>: prijs boven 10¢/kWh (geen melding)</p>
                </div>
            </div>
        </section>

        <!-- Fluvius stub (Phase 2) -->
        <section class="bg-card rounded-2xl border border-dashed shadow-sm overflow-hidden opacity-50 pointer-events-none select-none">
            <div class="px-4 py-3 border-b">
                <h2 class="text-sm font-semibold text-foreground">Fluvius-koppeling (binnenkort)</h2>
            </div>
            <div class="p-4">
                <p class="text-sm text-muted-foreground mb-3">
                    Koppel uw digitale meter om uw historisch verbruik te overlappen met de prijsgrafiek.
                </p>
                <button class="px-4 py-2 rounded-xl bg-accent text-sm font-medium text-accent-foreground" disabled>
                    Verbinden met Fluvius
                </button>
            </div>
        </section>

        <!-- Info -->
        <p class="text-xs text-center text-muted-foreground">
            Prijsbron: EPEX Spot Belgium (Belpex). Prijzen in ¢/kWh (eurocent per kilowattuur), exclusief vaste kosten.
        </p>

    </div>
</div>
