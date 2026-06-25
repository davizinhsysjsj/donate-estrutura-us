<script lang="ts">
  import { onMount } from 'svelte';
  import { CAMPAIGN } from '$lib/data/campaign';
  import {
    captureAndPersistFbclid, getFbp, getEid, trackEvent, uuid, buildShopifyCartUrl,
    type UtmData
  } from '$lib/utils/fbtracking';
  import { initTaboola, trackTaboola, getTblci } from '$lib/utils/taboola';
  import { initTikTok, trackTikTok, getTtclid, getTtp } from '$lib/utils/tiktok';
  import { getSid } from '$lib/utils/analytics';
  import { SHOPIFY_SHOP_DOMAIN, pickVariantForAmount } from '$lib/data/variants';

  // ── Pagina de TESTE de Express Checkout (Apple Pay / Google Pay / Bancontact / Shop Pay)
  // Tracking completo: CAPI + 1st-party. Redirect real pro Shopify cart.
  // Use em https://belgianpaws.help/teste pra Shopify nao ver dominio da LP principal.

  type Tier = 'bronze' | 'lifesaver' | 'hero' | 'patron';
  type AmountOption = {
    amount: number;
    tier: Tier;
    badge?: string;
    desc: string;
    impact: string;
  };

  // Reordenação (item 4) + tiers visuais (item 2) + descrições específicas (item 12) + badge mais agressivo (item 7)
  const AMOUNTS: AmountOption[] = [
    { amount: 50,  tier: 'lifesaver', badge: 'Meest gekozen', desc: '12 maaltijden voor Loki & Bobi.',           impact: '12 dieren · 1 week' },
    { amount: 100, tier: 'hero',      badge: 'Held',           desc: 'Voeding & basisverzorging voor 4 dieren.',  impact: '4 dieren · 2 weken' },
    { amount: 200, tier: 'patron',    badge: 'Beschermheer',   desc: 'Voorraad grootschalig aanvullen.',          impact: '12 dieren · 1 maand' },
    { amount: 300, tier: 'patron',    badge: 'Beschermheer',   desc: 'Continue zorg voor de hele opvang.',        impact: '20 dieren · 1 maand' },
    { amount: 25,  tier: 'lifesaver', badge: 'Populair',       desc: '6 maaltijden voor Aïsha & friends.',        impact: '6 dieren · 4 dagen' },
    { amount: 500, tier: 'patron',    badge: 'Patron',         desc: 'Een hele maand voer voor de opvang.',       impact: '47 dieren · 1 maand' },
    { amount: 80,  tier: 'hero',                              desc: '1.5 week voer voor onze kleine vriendjes.', impact: '8 dieren · 10 dagen' },
    { amount: 35,  tier: 'lifesaver',                         desc: '1 week zorg voor meerdere dieren.',         impact: '5 dieren · 1 week' },
    { amount: 30,  tier: 'bronze',                            desc: '1 week voer voor één hond.',                impact: '1 hond · 1 week' },
    { amount: 20,  tier: 'bronze',                            desc: 'Bijna een hele week voeden.',               impact: '1 dier · 5 dagen' },
    { amount: 15,  tier: 'bronze',                            desc: 'Meerdere maaltijden voor één dier.',        impact: '1 dier · 3 dagen' },
    { amount: 10,  tier: 'bronze',                            desc: 'Een warme maaltijd voor vandaag.',          impact: '1 dier · 1 dag' },
  ];

  // ── Item 1: cálculo do custo real pós-dedução fiscal (BE: 45% pra giften €40+) ──
  function afterTax(n: number): { realCost: number; deductible: boolean } {
    if (n < 40) return { realCost: n, deductible: false };
    return { realCost: Math.round(n * 0.55), deductible: true };
  }

  function dogsForAmount(n: number): number {
    return Math.max(1, Math.round(n / 4.2));
  }

  // ── Item 11: stat "média do dia" mocada (em prod, query do server) ──
  const TODAY_STATS = { donations: 47, avg: 38 };

  // Progress
  const raisedEur = CAMPAIGN.raisedEur;
  const goalEur = CAMPAIGN.goalEur;
  const pct = Math.min(100, Math.round((raisedEur / goalEur) * 100));
  const CIRC = 150.8;
  const dashOffset = CIRC - (pct / 100) * CIRC;
  const remaining = Math.max(0, goalEur - raisedEur);

  // UI state
  let selectedAmount = $state<number | null>(null);
  let popupOpen     = $state(false);
  let donating      = $state(false);
  let showCustom    = $state(false);
  let customValue   = $state<number>(40);

  // Tracking state (1st-party + multi-pixel)
  let fbclid: string | null = $state(null);
  let fbp: string | null = $state(null);
  let utm: UtmData | null = $state(null);
  let tblci: string | null = $state(null);
  let ttclid: string | null = $state(null);
  let ttp: string | null = $state(null);

  onMount(() => {
    const tracking = captureAndPersistFbclid();
    fbclid = tracking.fbclid;
    utm = tracking.utm;
    setTimeout(() => { fbp = getFbp(); }, 300);
    initTaboola();
    tblci = getTblci();
    initTikTok();
    ttclid = getTtclid();
    setTimeout(() => { ttp = getTtp(); }, 300);
  });

  function selectAmount(amount: number) {
    selectedAmount = amount;
    popupOpen      = true;
    donating       = false;
  }

  function confirmCustom() {
    if (customValue >= 5 && customValue <= 5000) {
      selectAmount(customValue);
    }
  }

  function closePopup() { popupOpen = false; donating = false; }

  function realDonate() {
    if (!selectedAmount) return;
    donating = true;

    const eventId = uuid();
    const contentId = `test-${selectedAmount}`;

    trackEvent('InitiateCheckout', {
      value: selectedAmount,
      currency: 'EUR',
      content_ids: [contentId],
      content_type: 'product',
      num_items: 1
    }, eventId);
    trackTaboola('IC', selectedAmount);
    trackTikTok('InitiateCheckout', selectedAmount, contentId);

    const variantId = pickVariantForAmount(selectedAmount);
    if (!variantId || variantId.startsWith('PLACEHOLDER')) {
      donating = false;
      alert('Variant nao cadastrado pra €' + selectedAmount + '. Escolha outro valor.');
      return;
    }

    setTimeout(() => {
      window.location.href = buildShopifyCartUrl({
        shopDomain: SHOPIFY_SHOP_DOMAIN,
        variantId,
        fbclid,
        fbp,
        eventId,
        utm,
        sid: getSid(),
        tblci,
        ttclid,
        ttp,
        eid: getEid()
      });
    }, 400);
  }

  function goBack() { window.location.href = '/'; }
</script>

<svelte:head>
  <title>Protótipo /teste — Kies je donatiebedrag</title>
  <meta name="referrer" content="no-referrer" />
  <meta name="robots" content="noindex" />
</svelte:head>

<!-- Header -->
<header class="dn-header">
  <button class="dn-back" onclick={goBack} aria-label="Terug">
    <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
      <path d="m15 18-6-6 6-6"/>
    </svg>
  </button>
  <span class="dn-header-title">Kies je donatiebedrag</span>
  <span class="dn-header-flag">🇧🇪</span>
</header>

<div class="dn-page">

  <div class="dn-card">

    <!-- Progress row -->
    <div class="dn-progress-row">
      <div class="dn-circ">
        <svg width="58" height="58" viewBox="0 0 58 58">
          <circle cx="29" cy="29" r="24" fill="none" stroke="#e8e8e8" stroke-width="4"/>
          <circle cx="29" cy="29" r="24" fill="none" stroke="#02a95c" stroke-width="4"
            stroke-dasharray={CIRC} stroke-dashoffset={dashOffset} stroke-linecap="round"/>
        </svg>
        <div class="dn-circ-label">{pct}%</div>
      </div>
      <div>
        <div class="dn-progress-title">Nog maar <span>€ {remaining}</span> te gaan!</div>
        <div class="dn-progress-sub">Maak een verschil.</div>
      </div>
    </div>

    <!-- Item 11: stat médio do dia -->
    <div class="dn-today-stat">
      <span class="dn-today-pulse"></span>
      <strong>Vandaag:</strong> {TODAY_STATS.donations} donaties · Gemiddeld <strong>€{TODAY_STATS.avg}</strong>
    </div>

    <!-- Item 8: Tax badge mais visceral -->
    <div class="dn-tax">
      <span class="dn-tax-flag">🇧🇪</span>
      <div>
        Doneer <strong>€50</strong> → krijg <strong>€22,50</strong> terug van de belasting.<br/>
        <span class="dn-tax-strong">Echte kost: €27,50.</span>
      </div>
    </div>

    <!-- Item 2: Amount grid com 3 tiers visuais -->
    <div class="dn-amount-grid">
      {#each AMOUNTS as opt}
        {@const tax = afterTax(opt.amount)}
        <button
          class="dn-amount-btn tier-{opt.tier}"
          class:has-badge={!!opt.badge}
          onclick={() => selectAmount(opt.amount)}
        >
          {#if opt.badge}
            <span class="dn-ribbon">{opt.badge}</span>
          {/if}
          <span class="dn-amount-val">€{opt.amount}</span>
          {#if tax.deductible}
            <span class="dn-real-cost">echte kost €{tax.realCost}</span>
          {/if}
          <span class="dn-amount-impact">{opt.impact}</span>
          <span class="dn-amount-desc">{opt.desc}</span>
        </button>
      {/each}
    </div>

    <!-- Item 13: Custom amount -->
    {#if !showCustom}
      <button class="dn-custom-toggle" onclick={() => (showCustom = true)}>
        Ander bedrag invoeren →
      </button>
    {:else}
      <div class="dn-custom-wrap">
        <label class="dn-custom-label">Eigen bedrag</label>
        <div class="dn-custom-row">
          <div class="dn-custom-input">
            <span>€</span>
            <input type="number" min="5" max="5000" step="5" bind:value={customValue} />
          </div>
          <button class="dn-custom-confirm" onclick={confirmCustom}>Doneer</button>
        </div>
        <input
          type="range"
          min="5"
          max="500"
          step="5"
          bind:value={customValue}
          class="dn-custom-slider"
        />
        <div class="dn-custom-hints">
          <span>€5</span><span>€100</span><span>€500</span>
        </div>
      </div>
    {/if}

  </div>

</div>

<!-- ── Popup ── -->
{#if popupOpen}
  {@const tax = afterTax(selectedAmount ?? 0)}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="dn-overlay" onclick={(e) => e.target === e.currentTarget && closePopup()}>
    <div class="dn-popup" role="dialog" aria-modal="true">

      <button class="dn-popup-close" onclick={closePopup} aria-label="Sluiten">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>

      <div class="dn-popup-inner">
        <div class="dn-popup-label">Jouw donatie</div>
        <div class="dn-popup-amount">€{selectedAmount}</div>

        {#if tax.deductible}
          <div class="dn-popup-tax">
            🇧🇪 Echte kost na aftrek: <strong>€{tax.realCost}</strong>
          </div>
        {/if}

        <div class="dn-popup-animals">
          Vandaag red je {dogsForAmount(selectedAmount ?? 0)}&nbsp;{dogsForAmount(selectedAmount ?? 0) === 1 ? 'dier' : 'dieren'}.
        </div>

        <!-- Item 14: Reciprocidade por tier -->
        <div class="dn-popup-rewards">
          {#if (selectedAmount ?? 0) >= 200}
            <div class="dn-reward">🏆 Vermelding op de Beschermheren-pagina</div>
            <div class="dn-reward">💌 Persoonlijk dankwoord van Aoife</div>
            <div class="dn-reward">📸 Maandelijkse foto van een gered dier</div>
          {:else if (selectedAmount ?? 0) >= 100}
            <div class="dn-reward">💌 Persoonlijk dankwoord van Aoife</div>
            <div class="dn-reward">📸 Maandelijkse foto van een gered dier</div>
          {:else if (selectedAmount ?? 0) >= 50}
            <div class="dn-reward">📸 Maandelijkse foto van een gered dier</div>
          {/if}
        </div>

        <button class="dn-btn-bancontact" onclick={realDonate} disabled={donating}>
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
    position: sticky; top: 0; z-index: 50;
    display: flex; align-items: center;
    height: 52px; background: #f2f2f2;
    padding: 0 16px; gap: 10px;
  }
  .dn-back {
    display: flex; align-items: center;
    background: none; border: none; cursor: pointer;
    color: #111; padding: 6px 0; flex-shrink: 0;
  }
  .dn-back:hover { opacity: 0.7; }
  .dn-header-title { flex: 1; font-size: 1rem; font-weight: 700; color: #111; }
  .dn-header-flag { font-size: 1.1rem; }

  /* ── Page ── */
  .dn-page {
    max-width: 760px;
    margin: 0 auto;
    padding: 8px 12px 60px;
  }

  .dn-card {
    background: #fff;
    border-radius: 14px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.07);
    overflow: hidden;
  }

  /* ── Progress ── */
  .dn-progress-row {
    display: flex; align-items: center; gap: 14px;
    padding: 18px 16px 14px;
    border-bottom: 1px solid #e8e8e8;
  }
  .dn-circ { position: relative; width: 58px; height: 58px; flex-shrink: 0; }
  .dn-circ svg { transform: rotate(-90deg); }
  .dn-circ-label {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.6875rem; font-weight: 700; color: #02a95c;
  }
  .dn-progress-title { font-size: 0.9375rem; font-weight: 700; line-height: 1.35; }
  .dn-progress-title span { color: #02a95c; }
  .dn-progress-sub { font-size: 0.8125rem; color: #8a8a8a; margin-top: 2px; }

  /* ── Item 11: today's stat ── */
  .dn-today-stat {
    display: flex; align-items: center; gap: 8px;
    margin: 10px 12px 0;
    padding: 8px 12px;
    background: #FFF8E6;
    border: 1px solid #F0E0AC;
    border-radius: 8px;
    font-size: 0.8125rem;
    color: #6B5A0A;
  }
  .dn-today-pulse {
    width: 8px; height: 8px; border-radius: 50%;
    background: #02a95c;
    box-shadow: 0 0 0 0 rgba(2,169,92,0.6);
    animation: dn-pulse 1.5s infinite;
  }
  @keyframes dn-pulse {
    0% { box-shadow: 0 0 0 0 rgba(2,169,92,0.6); }
    70% { box-shadow: 0 0 0 8px rgba(2,169,92,0); }
    100% { box-shadow: 0 0 0 0 rgba(2,169,92,0); }
  }

  /* ── Item 8: tax badge visceral ── */
  .dn-tax {
    display: flex; align-items: center; gap: 12px;
    margin: 10px 12px;
    background: linear-gradient(135deg, #d1f8a8 0%, #cef891 100%);
    border: 1px solid #a5d96a;
    border-radius: 10px;
    padding: 12px 14px;
    font-size: 0.8125rem;
    color: #1a4d1a;
    line-height: 1.5;
  }
  .dn-tax-flag { font-size: 1.5rem; flex-shrink: 0; }
  .dn-tax-strong { font-weight: 800; color: #0a3d0a; }

  /* ── Amount grid: 2 cols mobile, 3 cols desktop (item 9) ── */
  .dn-amount-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    padding: 12px;
  }
  @media (min-width: 720px) {
    .dn-amount-grid { grid-template-columns: 1fr 1fr 1fr; gap: 12px; padding: 16px; }
  }

  /* ── Tiers visuais (item 2) ── */
  .dn-amount-btn {
    position: relative;
    display: flex; flex-direction: column;
    align-items: flex-start; gap: 4px;
    padding: 16px 14px 14px;
    border: 1px solid #ebebeb;
    border-radius: 12px;
    background: #fff;
    cursor: pointer;
    font-family: inherit;
    text-align: left;
    transition: transform 0.18s cubic-bezier(0.34,1.56,0.64,1),
                box-shadow 0.18s,
                border-color 0.12s;
    min-height: 116px;
    overflow: visible;
  }
  /* Item 6: hover microinteração */
  .dn-amount-btn:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 20px rgba(0,0,0,0.08);
  }
  .dn-amount-btn:active { transform: translateY(-1px) scale(0.98); }

  /* Bronze: discreto */
  .tier-bronze {
    background: #FAFAFA;
    border-color: #ECECEC;
  }
  .tier-bronze .dn-amount-val { color: #555; font-size: 1.125rem; }

  /* Lifesaver: marca verde */
  .tier-lifesaver {
    border: 1.5px solid #02a95c;
    background: linear-gradient(180deg, #F4FCF7 0%, #fff 80%);
  }
  .tier-lifesaver .dn-amount-val { color: #02a95c; font-size: 1.375rem; }

  /* Hero: laranja vibrante */
  .tier-hero {
    border: 1.5px solid #E07A2D;
    background: linear-gradient(180deg, #FFF6EE 0%, #fff 80%);
    box-shadow: 0 4px 12px rgba(224,122,45,0.08);
  }
  .tier-hero .dn-amount-val { color: #C95F18; font-size: 1.5rem; }

  /* Patron: gradient dourado */
  .tier-patron {
    border: 1.5px solid #C29A2E;
    background: linear-gradient(135deg, #FFF9E0 0%, #FEF2C0 100%);
    box-shadow: 0 6px 18px rgba(194,154,46,0.15);
  }
  .tier-patron .dn-amount-val { color: #8B6B14; font-size: 1.5rem; }

  /* ── Item 7: ribbon badge agressivo ── */
  .dn-ribbon {
    position: absolute;
    top: -8px;
    left: 50%;
    transform: translateX(-50%);
    background: #02a95c;
    color: #fff;
    font-size: 0.625rem;
    font-weight: 800;
    padding: 4px 10px;
    border-radius: 999px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    box-shadow: 0 3px 8px rgba(2,169,92,0.35);
    white-space: nowrap;
  }
  .tier-hero .dn-ribbon { background: #E07A2D; box-shadow: 0 3px 8px rgba(224,122,45,0.35); }
  .tier-patron .dn-ribbon {
    background: linear-gradient(135deg, #D4A93C 0%, #B58520 100%);
    box-shadow: 0 3px 10px rgba(180,135,40,0.4);
  }

  .dn-amount-val {
    font-size: 1.25rem;
    font-weight: 800;
    line-height: 1;
    margin-top: 6px;
  }
  .has-badge .dn-amount-val { margin-top: 12px; }

  /* ── Item 1: custo real após dedução ── */
  .dn-real-cost {
    display: inline-block;
    font-size: 0.625rem;
    font-weight: 700;
    color: #0A6E2E;
    background: rgba(2,169,92,0.10);
    padding: 2px 6px;
    border-radius: 4px;
    margin-top: 2px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  /* ── Item 12: impact específico ── */
  .dn-amount-impact {
    font-size: 0.75rem;
    font-weight: 700;
    color: #1a1a1a;
    margin-top: 6px;
  }
  .dn-amount-desc {
    font-size: 0.6875rem;
    color: #8a8a8a;
    line-height: 1.45;
    margin-top: 2px;
  }

  /* ── Item 13: custom amount ── */
  .dn-custom-toggle {
    display: block;
    width: calc(100% - 24px);
    margin: 0 12px 16px;
    padding: 12px;
    background: transparent;
    border: 1px dashed #c8c8c8;
    border-radius: 10px;
    color: #555;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.12s, border-color 0.12s;
  }
  .dn-custom-toggle:hover { background: #FAFAFA; border-color: #02a95c; color: #02a95c; }

  .dn-custom-wrap {
    margin: 8px 12px 16px;
    padding: 14px;
    background: #FAFAFA;
    border: 1px solid #EAEAEA;
    border-radius: 12px;
  }
  .dn-custom-label {
    display: block;
    font-size: 0.6875rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #8a8a8a;
    margin-bottom: 8px;
  }
  .dn-custom-row { display: flex; gap: 8px; margin-bottom: 12px; }
  .dn-custom-input {
    flex: 1; display: flex; align-items: center;
    background: #fff; border: 1.5px solid #02a95c;
    border-radius: 10px; padding: 0 12px;
  }
  .dn-custom-input span { color: #02a95c; font-weight: 800; margin-right: 4px; }
  .dn-custom-input input {
    flex: 1; border: none; outline: none;
    font-size: 1.25rem; font-weight: 700;
    padding: 12px 0; background: transparent; font-family: inherit;
  }
  .dn-custom-confirm {
    background: #02a95c; color: #fff;
    border: none; border-radius: 10px;
    padding: 0 18px; font-weight: 700;
    font-family: inherit; cursor: pointer;
    transition: background 0.15s;
  }
  .dn-custom-confirm:hover { background: #018C4C; }

  .dn-custom-slider {
    width: 100%;
    height: 4px;
    -webkit-appearance: none; appearance: none;
    background: linear-gradient(to right, #02a95c 0%, #02a95c var(--val,20%), #ddd var(--val,20%), #ddd 100%);
    border-radius: 2px;
    outline: none;
  }
  .dn-custom-slider::-webkit-slider-thumb {
    -webkit-appearance: none; appearance: none;
    width: 22px; height: 22px;
    background: #fff;
    border: 3px solid #02a95c;
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0,0,0,0.18);
  }
  .dn-custom-slider::-moz-range-thumb {
    width: 22px; height: 22px;
    background: #fff;
    border: 3px solid #02a95c;
    border-radius: 50%;
    cursor: pointer;
  }
  .dn-custom-hints {
    display: flex; justify-content: space-between;
    font-size: 0.6875rem; color: #8a8a8a;
    margin-top: 6px;
  }

  /* ── Overlay ── */
  .dn-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.45);
    z-index: 100;
    display: flex; align-items: center; justify-content: center;
    padding: 16px;
    animation: dn-fade-in 0.15s ease;
  }
  @keyframes dn-fade-in { from { opacity: 0; } to { opacity: 1; } }

  .dn-popup {
    position: relative;
    background: #fff;
    border-radius: 22px;
    width: 100%; max-width: 380px;
    box-shadow: 0 12px 50px rgba(0,0,0,0.22);
    animation: dn-pop-in 0.22s cubic-bezier(0.34,1.56,0.64,1);
    overflow: hidden;
  }
  @keyframes dn-pop-in {
    from { transform: scale(0.88); opacity: 0; }
    to   { transform: scale(1);    opacity: 1; }
  }
  .dn-popup-close {
    position: absolute; top: 14px; right: 14px;
    background: #f0f0f0; border: none; border-radius: 50%;
    width: 32px; height: 32px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; color: #555;
  }
  .dn-popup-close:hover { background: #e0e0e0; }

  .dn-popup-inner {
    padding: 32px 24px 28px;
    display: flex; flex-direction: column;
    align-items: center; text-align: center;
  }
  .dn-popup-label {
    font-size: 0.75rem; font-weight: 700;
    color: #8a8a8a; text-transform: uppercase;
    letter-spacing: 0.06em; margin-bottom: 8px;
  }
  .dn-popup-amount {
    font-size: 3rem; font-weight: 800;
    color: #02a95c; line-height: 1;
    margin-bottom: 6px;
  }
  .dn-popup-tax {
    font-size: 0.8125rem;
    color: #0A6E2E;
    background: rgba(2,169,92,0.10);
    padding: 4px 10px;
    border-radius: 6px;
    margin-bottom: 12px;
  }
  .dn-popup-animals {
    font-size: 0.9375rem; font-weight: 600;
    color: #111; margin-bottom: 14px;
  }

  /* ── Item 14: rewards por tier ── */
  .dn-popup-rewards {
    width: 100%;
    display: flex; flex-direction: column;
    gap: 6px;
    margin: 0 0 18px;
  }
  .dn-popup-rewards:empty { display: none; margin: 0; }
  .dn-reward {
    font-size: 0.8125rem;
    color: #1a4d1a;
    background: #F4FCF7;
    border: 1px solid #D5EED8;
    padding: 8px 12px;
    border-radius: 8px;
    text-align: left;
  }

  /* ── Bancontact button ── */
  .dn-btn-bancontact {
    width: 100%; height: 56px;
    background: #fff; color: #003082;
    border: 2px solid #E8EDF8;
    border-radius: 14px;
    font-size: 1rem; font-weight: 700;
    font-family: inherit; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
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
  .dn-bc-logo { height: 28px; width: auto; display: block; flex-shrink: 0; }

  .dn-security {
    display: flex; align-items: center; gap: 5px;
    font-size: 0.75rem; color: #8a8a8a;
  }
  .dn-spinner {
    width: 18px; height: 18px;
    border: 2.5px solid rgba(0,48,130,0.25);
    border-top-color: #003082;
    border-radius: 50%;
    animation: dn-spin 0.7s linear infinite;
  }
  @keyframes dn-spin { to { transform: rotate(360deg); } }
</style>
