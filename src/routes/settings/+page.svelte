<script lang="ts">
    import { ArrowLeft, Bell, BellOff, Zap, Upload, Trash2 } from '@lucide/svelte';
    import { browser } from '$app/environment';
    import { settings } from '$lib/stores.svelte.js';
    import { meterStore } from '$lib/meterStore.svelte.js';
    import { parseFluviusCsv } from '$lib/fluviusParser.js';
    import { subscribeToPush, unsubscribeFromPush, getNotificationPermission } from '$lib/notifications.js';
    import { formatEuroPrice } from '$lib/priceUtils.js';

    let { data } = $props();

    let notifStatus = $state<'idle' | 'loading' | 'error'>('idle');
    let testStatus = $state<'idle' | 'loading' | 'success' | 'error'>('idle');
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

    async function testNotification() {
        if (!('serviceWorker' in navigator)) return;
        testStatus = 'loading';
        try {
            const registration = await navigator.serviceWorker.ready;
            const sub = await registration.pushManager.getSubscription();
            if (!sub) { testStatus = 'error'; return; }
            const res = await fetch('/api/notify/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscription: sub.toJSON() })
            });
            testStatus = res.ok ? 'success' : 'error';
        } catch {
            testStatus = 'error';
        }
        setTimeout(() => (testStatus = 'idle'), 3000);
    }

    function clamp(value: number, min: number, max: number) {
        return Math.min(Math.max(value, min), max);
    }

    let uploadStatus = $state<'idle' | 'success' | 'error'>('idle');
    let uploadMsg    = $state('');

    function formatDate(iso: string) {
        const [y, m, d] = iso.split('-');
        return `${d}/${m}/${y}`;
    }

    async function handleFileUpload(e: Event) {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        uploadStatus = 'idle';
        try {
            const text   = await file.text();
            const result = parseFluviusCsv(text);
            if (result.fileType === 'dagtotalen') {
                uploadStatus = 'error';
                uploadMsg    = 'Dit is een dagtotalen-bestand. Onze app heeft kwartiertotalen nodig voor uurlijkse grafieken. Exporteer opnieuw via Mijn Fluvius en kies "kwartiertotalen".';
                return;
            }
            if (result.daysFound === 0) {
                uploadStatus = 'error';
                uploadMsg    = 'Geen geldige Fluvius-data gevonden in het bestand.';
                return;
            }
            meterStore.merge(result.data);
            uploadStatus = 'success';
            const range  = result.dateFrom && result.dateTo
                ? ` (${formatDate(result.dateFrom)} – ${formatDate(result.dateTo)})`
                : '';
            const skipped = result.daysSkipped > 0
                ? `, ${result.daysSkipped} dag${result.daysSkipped !== 1 ? 'en' : ''} zonder metingen overgeslagen`
                : '';
            uploadMsg = `${result.daysFound} dag${result.daysFound !== 1 ? 'en' : ''} geïmporteerd${range}${skipped}.`;
        } catch {
            uploadStatus = 'error';
            uploadMsg    = 'Bestand kon niet worden verwerkt.';
        }
        // Reset file input so the same file can be re-imported
        (e.target as HTMLInputElement).value = '';
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
                    <div class="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-700 dark:text-amber-300">
                        Meldingen zijn geblokkeerd in je browser. Sta ze toe via iPhone-instellingen → Safari → Meldingen.
                    </div>
                {/if}

                {#if !browser || !('PushManager' in window)}
                    <div class="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-700 dark:text-amber-300">
                        Meldingen vereisen dat je de app toevoegt aan je beginscherm (iOS 16.4+).
                    </div>
                {/if}

                <div class="flex items-start justify-between gap-4">
                    <div>
                        <p class="text-sm font-medium text-foreground">Prijswaarschuwingen</p>
                        <p class="text-xs text-muted-foreground mt-0.5">
                            Ontvang meldingen bij groene (verdien geld), blauwe (onder nul) en rode (dure) prijzen, ook als de app gesloten is.
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

                {#if settings.notificationsEnabled}
                    <div class="flex items-center justify-between">
                        <p class="text-xs text-muted-foreground">Stuur een testmelding naar dit apparaat.</p>
                        <button
                            onclick={testNotification}
                            disabled={testStatus === 'loading'}
                            class="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-accent text-accent-foreground hover:bg-border transition-colors disabled:opacity-50"
                        >
                            {#if testStatus === 'loading'}
                                <span class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                            {:else if testStatus === 'success'}
                                ✓ Verzonden!
                            {:else if testStatus === 'error'}
                                ✗ Mislukt
                            {:else}
                                <Bell size={14} />
                                Test melding
                            {/if}
                        </button>
                    </div>
                {/if}
            </div>
        </section>

        <!-- Alert thresholds section -->
        <section class="bg-card rounded-2xl border shadow-sm overflow-hidden">
            <div class="px-4 py-3 border-b flex items-center justify-between">
                <h2 class="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Zap size={16} />
                    Drempelwaarden (€/kWh)
                </h2>
                <button
                    onclick={() => settings.reset()}
                    class="text-xs px-2.5 py-1 rounded-lg bg-accent hover:bg-border text-muted-foreground hover:text-foreground transition-colors"
                >
                    Standaard herstellen
                </button>
            </div>

            <div class="p-4 flex flex-col gap-5">

                <!-- Green threshold -->
                <div>
                    <div class="flex items-center justify-between mb-2">
                        <div class="text-sm font-medium text-foreground flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-green-500"></span>
                            Groen — verdien geld
                        </div>
                        <div class="flex items-center gap-1">
                            <button
                                onclick={() => { settings.green = clamp(settings.green - 1, -100, settings.amber - 1); settings.save(); }}
                                class="w-7 h-7 rounded-lg bg-accent hover:bg-border flex items-center justify-center text-sm font-bold transition-colors"
                            >−</button>
                            <span class="text-sm font-mono w-24 text-center tabular-nums">
                                ≤ {formatEuroPrice(settings.green)}
                            </span>
                            <button
                                onclick={() => { settings.green = clamp(settings.green + 1, -100, settings.amber - 1); settings.save(); }}
                                class="w-7 h-7 rounded-lg bg-accent hover:bg-border flex items-center justify-center text-sm font-bold transition-colors"
                            >+</button>
                        </div>
                    </div>
                    <p class="text-xs text-muted-foreground">Prijs is negatief genoeg dat u effectief geld verdient.</p>
                </div>

                <div class="border-t"></div>

                <!-- Amber threshold -->
                <div>
                    <div class="flex items-center justify-between mb-2">
                        <div class="text-sm font-medium text-foreground flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-blue-500"></span>
                            Blauw — onder nul
                        </div>
                        <div class="flex items-center gap-1">
                            <button
                                onclick={() => { settings.amber = clamp(settings.amber - 1, settings.green + 1, settings.blue - 1); settings.save(); }}
                                class="w-7 h-7 rounded-lg bg-accent hover:bg-border flex items-center justify-center text-sm font-bold transition-colors"
                            >−</button>
                            <span class="text-sm font-mono w-24 text-center tabular-nums">
                                ≤ {formatEuroPrice(settings.amber)}
                            </span>
                            <button
                                onclick={() => { settings.amber = clamp(settings.amber + 1, settings.green + 1, settings.blue - 1); settings.save(); }}
                                class="w-7 h-7 rounded-lg bg-accent hover:bg-border flex items-center justify-center text-sm font-bold transition-colors"
                            >+</button>
                        </div>
                    </div>
                    <p class="text-xs text-muted-foreground">Prijs is negatief maar nog niet genoeg om geld te verdienen.</p>
                </div>

                <div class="border-t"></div>

                <!-- Blue threshold -->
                <div>
                    <div class="flex items-center justify-between mb-2">
                        <div class="text-sm font-medium text-foreground flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-amber-500"></span>
                            Oranje — goedkoop
                        </div>
                        <div class="flex items-center gap-1">
                            <button
                                onclick={() => { settings.blue = clamp(settings.blue - 1, settings.amber + 1, 200); settings.save(); }}
                                class="w-7 h-7 rounded-lg bg-accent hover:bg-border flex items-center justify-center text-sm font-bold transition-colors"
                            >−</button>
                            <span class="text-sm font-mono w-24 text-center tabular-nums">
                                ≤ {formatEuroPrice(settings.blue)}
                            </span>
                            <button
                                onclick={() => { settings.blue = clamp(settings.blue + 1, settings.amber + 1, 200); settings.save(); }}
                                class="w-7 h-7 rounded-lg bg-accent hover:bg-border flex items-center justify-center text-sm font-bold transition-colors"
                            >+</button>
                        </div>
                    </div>
                    <p class="text-xs text-muted-foreground">Prijs is positief maar nog goedkoop genoeg om voordelig te zijn.</p>
                </div>

                <div class="border-t"></div>

                <!-- Info row -->
                <div class="rounded-xl bg-muted p-3 text-xs text-muted-foreground space-y-1">
                    <p>🔴 <strong>Rood</strong>: prijs boven de oranje (goedkoop) drempel — duur, melding verzonden.</p>
                </div>
            </div>
        </section>

        <!-- Fluvius meter data -->
        <section class="bg-card rounded-2xl border shadow-sm overflow-hidden">
            <div class="px-4 py-3 border-b">
                <h2 class="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Upload size={16} />
                    Fluvius verbruiksdata
                </h2>
            </div>
            <div class="p-4 flex flex-col gap-4">
                <p class="text-xs text-muted-foreground">
                    Importeer een CSV-export van Mijn Fluvius (digitale meter, kwartierwaarden).
                    Uw verbruik verschijnt als blauwe lijn op de grafiek samen met de energiekost per uur.
                </p>

                {#if meterStore.dateCount > 0 && meterStore.dateRange}
                    <div class="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 flex items-center justify-between gap-3">
                        <div>
                            <p class="text-xs font-medium text-blue-700 dark:text-blue-300">
                                {meterStore.dateCount} dag{meterStore.dateCount !== 1 ? 'en' : ''} geladen
                            </p>
                            <p class="text-xs text-blue-600/70 dark:text-blue-400/70 mt-0.5">
                                {formatDate(meterStore.dateRange.from)} – {formatDate(meterStore.dateRange.to)}
                            </p>
                        </div>
                        <button
                            onclick={() => { meterStore.clear(); uploadStatus = 'idle'; }}
                            class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
                        >
                            <Trash2 size={12} />
                            Wissen
                        </button>
                    </div>
                {/if}

                <label class="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-muted hover:border-primary/50 hover:bg-accent/50 transition-colors cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                    <Upload size={16} />
                    {meterStore.dateCount > 0 ? 'Meer data importeren' : 'CSV-bestand kiezen'}
                    <input
                        type="file"
                        accept=".csv,.txt,text/plain,text/csv"
                        class="hidden"
                        onchange={handleFileUpload}
                    />
                </label>

                {#if uploadStatus === 'success'}
                    <p class="text-xs text-green-600 dark:text-green-400">✓ {uploadMsg}</p>
                {:else if uploadStatus === 'error'}
                    <p class="text-xs text-destructive">{uploadMsg}</p>
                {/if}
            </div>
        </section>

        <!-- Info -->
        <div class="flex flex-col items-center gap-1">
            <p class="text-xs text-center text-muted-foreground">
                Prijsbron: EPEX Spot Belgium (Belpex). Prijzen in €/kWh (euro per kilowattuur), exclusief vaste kosten.
            </p>
            <p class="text-xs text-center text-muted-foreground/60 font-mono">
                v{__APP_VERSION__}
            </p>
        </div>

    </div>
</div>
