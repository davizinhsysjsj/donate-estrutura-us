<script lang="ts">
  import { onMount } from 'svelte';
  import {
    captureAndPersistFbclid, getFbp, trackEvent, uuid, buildShopifyCartUrl,
    type UtmData
  } from '$lib/utils/fbtracking';

  const SHOPIFY_SHOP_DOMAIN = 'inigualavelshop.myshopify.com';

  // Variantes Shopify — adicionar novos IDs aqui quando o produto tiver mais variantes
  const VARIANT_BY_AMOUNT: Record<number, string> = {
    10: '49461830844554', // €10
    20: '49461830877322', // €20
    25: '49461830910090', // €25
    35: '49461830942858', // €35
    // A preencher quando adicionares novas variantes no produto:
    // 15: '',
    // 30: '',
    // 50: '',
    // 80: '',
    // 100: '',
    // 200: '',
    // 300: '',
    // 500: '',
  };

  type AmountOption = {
    amount: number;
    recommended?: boolean;
    desc: string;
  };

  const AMOUNTS: AmountOption[] = [
    { amount: 30, recommended: true, desc: 'Zorgt voor voer voor een hond gedurende circa 1 week.' },
    { amount: 50,  desc: 'Helpt 2 tot 3 dieren meerdere dagen te voeden.' },
    { amount: 80,  desc: 'Draagt bij aan de voeding van meerdere dieren gedurende 1 à 2 weken.' },
    { amount: 100, desc: 'Garandeert voeding voor meerdere honden en katten én basisverzorging.' },
    { amount: 20,  desc: 'Helpt een gered dier bijna een week lang te voeden.' },
    { amount: 25,  desc: 'Vult lege bakjes en geeft troost aan wie honger heeft.' },
    { amount: 200, desc: 'Maakt het mogelijk om voer in grote hoeveelheden te kopen.' },
    { amount: 300, desc: 'Continue voeding en verzorging voor meerdere geredde dieren.' },
    { amount: 500, desc: 'Voeding voor 1 maand voor al onze kleine vriendjes.' },
    { amount: 15,  desc: 'Zorgt voor maaltijden voor een dier gedurende meerdere dagen.' },
  ];

  function dogsForAmount(n: number): number {
    return Math.max(1, Math.round(n / 4.2));
  }

  // Tracking
  let fbclid: string | null = $state(null);
  let fbc:    string | null = $state(null);
  let fbp:    string | null = $state(null);
  let utm:    UtmData | null = $state(null);

  // UI state
  let selectedAmount  = $state<number | null>(null);
  let customValue     = $state('');
  let showCustomOk    = $state(false);
  let popupOpen       = $state(false);
  let donating        = $state(false);
  let amountError     = $state(false);
  // eventId gerado ao abrir popup — reutilizado no handleDonate para dedup Meta + UTMify
  let pendingEventId  = $state<string>('');

  onMount(() => {
    const tracking = captureAndPersistFbclid();
    fbclid = tracking.fbclid;
    fbc    = tracking.fbc;
    utm    = tracking.utm;
    setTimeout(() => { fbp = getFbp(); }, 500);
  });

  function selectAmount(amount: number) {
    selectedAmount = amount;
    customValue    = '';
    showCustomOk   = false;
    amountError    = false;
    openPopup();
  }

  function onCustomInput(e: Event) {
    const v = parseFloat((e.target as HTMLInputElement).value);
    customValue  = (e.target as HTMLInputElement).value;
    showCustomOk = v >= 1;
    if (v >= 1) selectedAmount = v;
  }

  function onCustomEnter(e: KeyboardEvent) {
    if (e.key === 'Enter') openCustomPopup();
  }

  function openCustomPopup() {
    const v = parseFloat(customValue);
    if (!v || v < 1) { amountError = true; return; }
    selectedAmount = v;
    amountError    = false;
    openPopup();
  }

  function openPopup() {
    popupOpen = true;
    donating  = false;

    // ── IC dispara AQUI — no momento que o popup abre (usuário selecionou valor) ──
    const eid = uuid();
    pendingEventId = eid;

    // Meta Pixel (fbq) — InitiateCheckout com eventID para dedup com server-side
    trackEvent('InitiateCheckout', {
      value: selectedAmount ?? 0,
      currency: 'EUR',
      content_ids: [String(selectedAmount ?? 0)],
      content_type: 'product',
      num_items: 1
    }, eid);

    // UTMify pixel — IC imediato (se script estiver carregado)
    if (typeof window !== 'undefined' && typeof (window as any).uf === 'function') {
      (window as any).uf('track', 'InitiateCheckout', {
        value: selectedAmount ?? 0,
        currency: 'EUR',
        content_ids: [String(selectedAmount ?? 0)],
        num_items: 1,
        event_id: eid
      });
    }
  }

  function closePopup() {
    popupOpen = false;
    donating  = false;
  }

  function handleDonate() {
    if (!selectedAmount) return;
    donating = true;

    // Reutiliza o eventId gerado ao abrir o popup (evita duplicatas no Meta CAPI)
    const eventId = pendingEventId || uuid();

    const variantId = VARIANT_BY_AMOUNT[selectedAmount];

    setTimeout(() => {
      if (!variantId) {
        // Variante ainda não cadastrada — fallback temporário
        window.location.href = `/supporter?tier=${selectedAmount}&event_id=${eventId}`;
      } else {
        window.location.href = buildShopifyCartUrl({
          shopDomain: SHOPIFY_SHOP_DOMAIN,
          variantId,
          fbclid,
          fbp,
          eventId,
          utm
        });
      }
    }, 600);
  }

  function goBack() {
    window.location.href = '/';
  }
</script>

<svelte:head>
  <title>Kies je donatiebedrag | Belgische Dierenopvang</title>
  <meta name="referrer" content="no-referrer" />
</svelte:head>

<!-- Header -->
<header class="dn-header">
  <button class="dn-back" onclick={goBack} aria-label="Terug">
    <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
      <path d="m15 18-6-6 6-6"/>
    </svg>
  </button>
  <span class="dn-header-title">Kies je donatiebedrag</span>
</header>

<div class="dn-page">

  <div class="dn-card">

    <!-- Progress row -->
    <div class="dn-progress-row">
      <div class="dn-circ">
        <svg width="58" height="58" viewBox="0 0 58 58">
          <circle cx="29" cy="29" r="24" fill="none" stroke="#e8e8e8" stroke-width="4"/>
          <circle cx="29" cy="29" r="24" fill="none" stroke="#02a95c" stroke-width="4"
            stroke-dasharray="150.8" stroke-dashoffset="111.6" stroke-linecap="round"/>
        </svg>
        <div class="dn-circ-label">26 %</div>
      </div>
      <div>
        <div class="dn-progress-title">Nog maar <span>€ 717</span> te gaan!</div>
        <div class="dn-progress-sub">Maak een verschil.</div>
      </div>
    </div>

    <!-- Tax badge -->
    <div class="dn-tax">
      🏅 Door <strong>€30 of meer</strong> te doneren, kun jij tot <strong>25% terugkrijgen</strong> via je belastingaangifte.
    </div>

    <!-- Amount grid -->
    <div class="dn-amount-grid">
      {#each AMOUNTS as opt}
        <button
          class="dn-amount-btn"
          class:has-badge={opt.recommended}
          onclick={() => selectAmount(opt.amount)}
        >
          {#if opt.recommended}
            <span class="dn-badge">Aanbevolen</span>
          {/if}
          <span class="dn-amount-val">€{opt.amount}</span>
          <span class="dn-amount-desc">{opt.desc}</span>
        </button>
      {/each}
    </div>

    <!-- Custom amount -->
    <div class="dn-custom-row">
      <span class="dn-custom-icon">€</span>
      <input
        type="number"
        class="dn-custom-input"
        placeholder="Ander bedrag invullen"
        min="1"
        step="1"
        value={customValue}
        oninput={onCustomInput}
        onkeydown={onCustomEnter}
      />
      {#if showCustomOk}
        <button class="dn-custom-ok" onclick={openCustomPopup}>OK</button>
      {/if}
    </div>

    {#if amountError}
      <div class="dn-err">Selecteer of voer een geldig bedrag in.</div>
    {/if}

  </div>

</div>

<!-- ── Center Popup ── -->
{#if popupOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="dn-overlay" onclick={(e) => e.target === e.currentTarget && closePopup()}>
    <div class="dn-popup" role="dialog" aria-modal="true" aria-label="Bevestig je donatie">

      <button class="dn-popup-close" onclick={closePopup} aria-label="Sluiten">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>

      <div class="dn-popup-inner">
        <div class="dn-popup-label">Jouw donatie</div>
        <div class="dn-popup-amount">€{selectedAmount}</div>
        <div class="dn-popup-animals">
          Vandaag red je {dogsForAmount(selectedAmount ?? 0)}&nbsp;{dogsForAmount(selectedAmount ?? 0) === 1 ? 'dier' : 'dieren'}.
        </div>
        <p class="dn-popup-note">
          Jouw donatie gaat rechtstreeks naar de voeding en verzorging van geredde dieren bij onze Belgische partneropvangen.
        </p>

        <button class="dn-btn-bancontact" onclick={handleDonate} disabled={donating}>
          {#if donating}
            <div class="dn-spinner"></div>
            <span>Doorverwijzen…</span>
          {:else}
            <img src="/bancontact.webp" alt="Bancontact" class="dn-bc-logo" />
            <span>Doneer €{selectedAmount} met Bancontact</span>
          {/if}
        </button>

        <div class="dn-security">
          <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          100% veilige betaling via Bancontact
        </div>
      </div>

    </div>
  </div>
{/if}

<style>
  :global(body) {
    font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
    background: #f2f2f2;
    color: #111;
    -webkit-font-smoothing: antialiased;
    margin: 0;
  }

  /* ── Header ── */
  .dn-header {
    position: sticky;
    top: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    height: 52px;
    background: #f2f2f2;
    padding: 0 16px;
    gap: 10px;
  }
  .dn-back {
    display: flex;
    align-items: center;
    background: none;
    border: none;
    cursor: pointer;
    color: #111;
    padding: 6px 0;
    font-size: 0.9375rem;
    font-weight: 500;
    flex-shrink: 0;
  }
  .dn-back:hover { opacity: 0.7; }
  .dn-header-title {
    flex: 1;
    font-size: 1rem;
    font-weight: 700;
    color: #111;
  }

  /* ── Page ── */
  .dn-page {
    max-width: 480px;
    margin: 0 auto;
    padding: 8px 12px 60px;
  }

  /* ── Card ── */
  .dn-card {
    background: #fff;
    border-radius: 14px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.07);
    overflow: hidden;
  }

  /* ── Progress ── */
  .dn-progress-row {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 18px 16px 14px;
    border-bottom: 1px solid #e8e8e8;
  }
  .dn-circ {
    position: relative;
    width: 58px;
    height: 58px;
    flex-shrink: 0;
  }
  .dn-circ svg { transform: rotate(-90deg); }
  .dn-circ-label {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.6875rem;
    font-weight: 700;
    color: #02a95c;
  }
  .dn-progress-title {
    font-size: 0.9375rem;
    font-weight: 700;
    line-height: 1.35;
  }
  .dn-progress-title span { color: #02a95c; }
  .dn-progress-sub {
    font-size: 0.8125rem;
    color: #8a8a8a;
    margin-top: 2px;
  }

  /* ── Tax badge ── */
  .dn-tax {
    margin: 10px 12px;
    background: #cef891;
    border: 1px solid #b8e070;
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 0.75rem;
    color: #1a4d1a;
    line-height: 1.45;
  }

  /* ── Amount grid ── */
  .dn-amount-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    padding: 10px 12px 12px;
  }
  .dn-amount-btn {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    padding: 14px 12px 12px;
    border: 1px solid #ebebeb;
    border-radius: 10px;
    background: #fff;
    cursor: pointer;
    font-family: inherit;
    text-align: left;
    transition: background 0.12s, border-color 0.12s, box-shadow 0.12s;
    min-height: 96px;
  }
  .dn-amount-btn:hover {
    border-color: #cde8d8;
    background: #fafffe;
  }
  .dn-amount-btn:active {
    transform: scale(0.97);
  }
  .dn-badge {
    position: absolute;
    top: 8px;
    left: 10px;
    background: #02a95c;
    color: #fff;
    font-size: 0.625rem;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 999px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .dn-amount-val {
    font-size: 1.25rem;
    font-weight: 700;
    color: #02a95c;
    margin-top: 18px;
  }
  .dn-amount-btn:not(.has-badge) .dn-amount-val {
    margin-top: 2px;
  }
  .dn-amount-desc {
    font-size: 0.75rem;
    color: #8a8a8a;
    line-height: 1.45;
  }

  /* ── Custom input ── */
  .dn-custom-row {
    display: flex;
    align-items: center;
    padding: 0 16px;
    height: 52px;
    gap: 8px;
    border-top: 1px solid #e8e8e8;
  }
  .dn-custom-icon {
    color: #02a95c;
    font-size: 1rem;
    font-weight: 600;
  }
  .dn-custom-input {
    flex: 1;
    border: none;
    outline: none;
    font-size: 0.9375rem;
    font-family: inherit;
    color: #111;
    background: transparent;
  }
  .dn-custom-input::placeholder { color: #c0c0c0; }
  .dn-custom-ok {
    background: #02a95c;
    color: #fff;
    border: none;
    border-radius: 999px;
    padding: 6px 16px;
    font-size: 0.875rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
  }
  .dn-err {
    font-size: 0.8125rem;
    color: #e40014;
    padding: 8px 16px 12px;
  }

  /* ── Overlay ── */
  .dn-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.45);
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    animation: dn-fade-in 0.15s ease;
  }
  @keyframes dn-fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  /* ── Popup ── */
  .dn-popup {
    position: relative;
    background: #fff;
    border-radius: 20px;
    width: 100%;
    max-width: 360px;
    box-shadow: 0 8px 40px rgba(0,0,0,0.18);
    animation: dn-pop-in 0.2s cubic-bezier(0.34,1.56,0.64,1);
    overflow: hidden;
  }
  @keyframes dn-pop-in {
    from { transform: scale(0.88); opacity: 0; }
    to   { transform: scale(1);    opacity: 1; }
  }
  .dn-popup-close {
    position: absolute;
    top: 14px;
    right: 14px;
    background: #f0f0f0;
    border: none;
    border-radius: 50%;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #555;
    transition: background 0.12s;
  }
  .dn-popup-close:hover { background: #e0e0e0; }

  .dn-popup-inner {
    padding: 32px 24px 28px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  .dn-popup-label {
    font-size: 0.75rem;
    font-weight: 700;
    color: #8a8a8a;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 8px;
  }
  .dn-popup-amount {
    font-size: 3rem;
    font-weight: 800;
    color: #02a95c;
    line-height: 1;
    margin-bottom: 10px;
  }
  .dn-popup-animals {
    font-size: 0.9375rem;
    font-weight: 600;
    color: #111;
    margin-bottom: 14px;
  }
  .dn-popup-note {
    font-size: 0.8125rem;
    color: #8a8a8a;
    line-height: 1.55;
    margin: 0 0 24px;
  }

  /* ── Bancontact button ── */
  .dn-btn-bancontact {
    width: 100%;
    height: 56px;
    background: #fff;
    color: #003082;
    border: 2px solid #E8EDF8;
    border-radius: 14px;
    font-size: 1rem;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    box-shadow: 0 2px 8px rgba(0,48,130,0.1);
    transition: background 0.15s, box-shadow 0.15s, transform 0.1s;
    margin-bottom: 12px;
  }
  .dn-btn-bancontact:hover {
    background: #F0F4FF;
    box-shadow: 0 4px 16px rgba(0,48,130,0.18);
  }
  .dn-btn-bancontact:active { transform: scale(0.98); }
  .dn-btn-bancontact:disabled { opacity: 0.6; pointer-events: none; }
  .dn-bc-logo {
    height: 28px;
    width: auto;
    display: block;
    flex-shrink: 0;
  }

  /* ── Security note ── */
  .dn-security {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 0.75rem;
    color: #8a8a8a;
  }

  /* ── Spinner ── */
  .dn-spinner {
    width: 18px;
    height: 18px;
    border: 2.5px solid rgba(255,255,255,0.4);
    border-top-color: #fff;
    border-radius: 50%;
    animation: dn-spin 0.7s linear infinite;
  }
  @keyframes dn-spin { to { transform: rotate(360deg); } }
</style>
