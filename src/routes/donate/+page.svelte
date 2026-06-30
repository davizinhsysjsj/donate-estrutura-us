<script lang="ts">
  import { onMount } from 'svelte';
  import {
    captureAndPersistFbclid, getFbp, getEid, trackEvent, uuid, buildShopifyCartUrl,
    type UtmData
  } from '$lib/utils/fbtracking';
  import { initTaboola, trackTaboola, getTblci } from '$lib/utils/taboola';
  import { initTikTok, trackTikTok, getTtclid, getTtp } from '$lib/utils/tiktok';
  import { track as trackAnalytics, getSid } from '$lib/utils/analytics';
  import { SHOPIFY_SHOP_DOMAIN, pickVariantForAmount } from '$lib/data/variants';
  import type { PageData } from './$types';

  const { data } = $props<{ data: PageData }>();

  type AmountOption = {
    amount: number;
    recommended?: boolean;
    desc: string;
  };

  // Ordem: topo ancora valores ALTOS (psicologia anti-âncora baixa).
  // Linha 1: €50, €100 · Linha 2: €200, €300 · Linha 3: €25*, €500
  // Linha 4: €80, €35 · Linha 5: €30, €20 · Linha 6: €15, €10
  const AMOUNTS: AmountOption[] = [
    { amount: 50,  recommended: true, desc: "Eén week voeding tijdens Lina's chemo." },
    { amount: 100, desc: 'Helpt mee voor de pre-operatieve scan in UZ Gent.' },
    { amount: 200, desc: "Eén volledige chemo-sessie." },
    { amount: 300, desc: 'Twee chemo-sessies + medicatie thuis.' },
    { amount: 25,  desc: 'Eén dag pijnstilling voor Lina.' },
    { amount: 500, desc: "Een hele behandelingsweek (chemo + verblijf)." },
    { amount: 80,  desc: 'Bloedonderzoek vóór de volgende chemo-cyclus.' },
    { amount: 35,  desc: 'Voeding en supplementen tijdens herstel.' },
    { amount: 30,  desc: 'Een paar dagen pijnstilling en anti-misselijkheid.' },
    { amount: 20,  desc: 'Verbandmateriaal voor na de operatie.' },
    { amount: 15,  desc: 'Een dag medicatie zodat Lina rustig kan slapen.' },
    { amount: 10,  desc: 'Een warme maaltijd voor Lina vannacht.' },
  ];

  // Tracking
  let fbclid: string | null = $state(null);
  let fbc:    string | null = $state(null);
  let fbp:    string | null = $state(null);
  let utm:    UtmData | null = $state(null);
  let tblci:  string | null = $state(null);
  let ttclid: string | null = $state(null);
  let ttp:    string | null = $state(null);

  // UI state
  let selectedAmount  = $state<number | null>(null);
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

    initTaboola();
    tblci = getTblci();

    initTikTok();
    ttclid = getTtclid();
    setTimeout(() => { ttp = getTtp(); }, 500);

    // ── IC WARMUP ── (temporario — aquecer pixel novo)
    // Dispara InitiateCheckout assim que /donate carrega, com valor médio (€50).
    // Desligue setando WARMUP_IC = false quando o pixel sair do learning phase.
    const WARMUP_IC = true;
    if (WARMUP_IC) {
      const warmupValue = 50;
      const warmupEid = uuid();
      // Aguarda fbp/ttp serem populados (são setados em setTimeout 500ms acima)
      setTimeout(() => {
        // 1) Meta Pixel client-side
        trackEvent('InitiateCheckout', {
          value: warmupValue,
          currency: 'EUR',
          content_ids: [String(warmupValue)],
          content_type: 'product',
          num_items: 1
        }, warmupEid);
        // Taboola + TikTok também
        trackTaboola('IC', warmupValue);
        trackTikTok('InitiateCheckout', warmupValue, String(warmupValue));
        // 2) Meta CAPI server-side (dedup pelo mesmo event_id)
        fetch('/api/track-ic', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            eventId: warmupEid,
            value: warmupValue,
            currency: 'EUR',
            fbclid,
            fbp,
            fbc: fbc ?? undefined,
            userAgent: navigator.userAgent,
            sourceUrl: window.location.href,
            sid: getSid(),
            utm_source: utm?.source ?? undefined,
            utm_campaign: utm?.campaign ?? undefined,
            warmup: true
          })
        }).catch((e) => console.warn('[donate] warmup CAPI failed', e));
        console.log('[donate] IC warmup disparado (€' + warmupValue + ')');
      }, 700);
    }

    // Auto-seleciona valor se vier de link com ?amount= (sticky bar, abandoned recovery)
    const params = new URLSearchParams(window.location.search);
    const presetAmount = Number(params.get('amount'));
    if (Number.isFinite(presetAmount) && presetAmount > 0) {
      // Pequeno delay pra UX suave (componente terminou de montar)
      setTimeout(() => selectAmount(presetAmount), 150);
    }
  });

  function selectAmount(amount: number) {
    selectedAmount = amount;
    amountError    = false;
    // Analytics interno — qual tier foi clicado
    trackAnalytics('amount_select', { amount });
    openPopup();
    popupOpen = true;
  }

  function openPopup() {
    donating  = false;

    // ── IC dispara AQUI — no momento que o popup abre (usuário selecionou valor) ──
    const eid = uuid();
    pendingEventId = eid;

    // 1) Meta Pixel client-side (fbq) — com eventID para dedup com CAPI
    trackEvent('InitiateCheckout', {
      value: selectedAmount ?? 0,
      currency: 'EUR',
      content_ids: [String(selectedAmount ?? 0)],
      content_type: 'product',
      num_items: 1
    }, eid);

    // Taboola IC client-side
    trackTaboola('IC', selectedAmount ?? 0);

    // TikTok IC client-side — content_id obrigatorio pra Video Shopping Ads (VSA)
    trackTikTok('InitiateCheckout', selectedAmount ?? 0, String(selectedAmount ?? 0));

    // 2) Meta CAPI server-side — mesmo event_id = dedup automático com #1
    //    + dispara notificação push (Pushcut) via mesmo endpoint
    fetch('/api/track-ic', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        eventId: eid,
        value: selectedAmount ?? 0,
        currency: 'EUR',
        fbclid,
        fbp,
        fbc: fbc ?? undefined,
        userAgent: navigator.userAgent,
        sourceUrl: window.location.href,
        sid: getSid(),
        utm_source: utm?.source ?? undefined,
        utm_campaign: utm?.campaign ?? undefined
      })
    }).catch((e) => console.warn('[donate] CAPI IC failed', e));

    // REMOVIDO: uf('track', 'InitiateCheckout') — UTMify repassava para fbq com event_id diferente,
    // gerando 3ª IC sem dedup. UTMify recebe IC via webhook de compra (shopify-purchase).

    // 3) Abandoned popup tracking — server registra sid + amount pra eventual
    //    recovery email se nao houver compra (so funciona pra returning donor:
    //    sid mapeado pra email via past purchase).
    fetch('/api/track/popup-open', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        bp_sid: getSid(),
        amount: selectedAmount ?? 0,
        fbp: fbp ?? undefined,
        fbclid: fbclid ?? undefined
      })
    }).catch(() => { /* silencioso */ });
  }

  function closePopup() {
    popupOpen = false;
    donating  = false;
  }

  function handleDonate() {
    if (!selectedAmount) return;
    donating = true;

    // Analytics interno — clicou no Bancontact (vai pro checkout)
    trackAnalytics('bancontact_click', { amount: selectedAmount });

    // Reutiliza o eventId gerado ao abrir o popup (evita duplicatas no Meta CAPI)
    const eventId = pendingEventId || uuid();

    // Sorteia entre as variantes disponiveis pro tier (rotacao multi-produto)
    const variantId = pickVariantForAmount(selectedAmount);

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
          utm,
          sid: getSid(),
          tblci,
          ttclid,
          ttp,
          eid: getEid()
        });
      }
    }, 600);
  }

  function goBack() {
    window.location.href = '/lina';
  }
</script>

<svelte:head>
  <title>Doneer voor Lina | UZ Gent</title>
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

  <!-- Alerta urgente: Lina · 42 dagen pra operatie -->
  <div class="dn-urgent" role="alert">
    <div class="dn-urgent-pulse" aria-hidden="true">
      <span class="dn-urgent-dot"></span>
    </div>
    <div class="dn-urgent-body">
      <div class="dn-urgent-title">URGENT · Update Lina (laatste 24u)</div>
      <div class="dn-urgent-text">
        Lina's tumor is op de laatste scan met <strong>4mm gegroeid</strong>.
        Haar arts in UZ Gent zegt: zonder operatie binnen <strong>42 dagen</strong>
        verspreidt de tumor zich naar haar longen. Operatie + chemo + pediatrische
        prothese kosten <strong>€12.450</strong> — haar ouders hebben er
        <strong>€3.247</strong> bij elkaar. Elke euro brengt haar dichter bij
        de operatiezaal.
      </div>
    </div>
  </div>

  <div class="dn-card">

    <!-- Tax badge -->
    <div class="dn-tax">
      🏅 <strong>45% van jouw donatie</strong> krijg je terug via de Belgische fiscus — fiscaal aftrekbaar.
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
            <span class="dn-badge">Meest gekozen</span>
          {/if}
          <span class="dn-amount-val">€{opt.amount}</span>
        </button>
      {/each}
    </div>

    {#if amountError}
      <div class="dn-err">Selecteer een bedrag.</div>
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
        <div class="dn-popup-label">Jouw donatie voor Lina</div>
        <div class="dn-popup-amount">€{selectedAmount}</div>
        <div class="dn-popup-animals">
          Vandaag help je Lina haar operatie te halen.
        </div>
        <p class="dn-popup-note">
          Jouw donatie gaat rechtstreeks naar Lina's operatie, chemo en de pediatrische prothese in UZ Gent.
        </p>

        <button class="dn-btn-bancontact" onclick={handleDonate} disabled={donating}>
          {#if donating}
            <div class="dn-spinner"></div>
            <span>Doorverwijzen…</span>
          {:else}
            <span>Doneer €{selectedAmount}</span>
          {/if}
        </button>

        <div class="dn-payment-methods" aria-label="Betaalmethoden">
          <div class="dn-pm-tile dn-pm-bc"><img src="/bancontact.webp" alt="Bancontact" /></div>
          <div class="dn-pm-tile dn-pm-visa"><img src="/visa.webp" alt="Visa" /></div>
          <div class="dn-pm-tile"><img src="/mastercard.webp" alt="Mastercard" /></div>
        </div>

        <div class="dn-security">
          <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          100% veilige betaling
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

  /* ── Urgent alert (Lina's toestand) ── */
  .dn-urgent {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin: 8px 0 14px;
    padding: 12px 14px;
    background: linear-gradient(135deg, #7a1212 0%, #5a0d0d 100%);
    border-left: 4px solid #ff3b3b;
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(122, 18, 18, 0.25);
    color: #fff;
  }
  .dn-urgent-pulse {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: rgba(255, 59, 59, 0.18);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }
  .dn-urgent-pulse::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: #ff3b3b;
    opacity: 0.45;
    animation: dn-urgent-ping 1.6s cubic-bezier(0, 0, 0.2, 1) infinite;
  }
  .dn-urgent-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #ff3b3b;
    box-shadow: 0 0 6px #ff3b3b;
    position: relative;
    z-index: 1;
  }
  @keyframes dn-urgent-ping {
    0%   { transform: scale(0.7); opacity: 0.55; }
    80%  { transform: scale(1.6); opacity: 0; }
    100% { transform: scale(1.6); opacity: 0; }
  }
  .dn-urgent-body { flex: 1; min-width: 0; }
  .dn-urgent-title {
    font-size: 0.75rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #ffb4b4;
    margin-bottom: 4px;
  }
  .dn-urgent-text {
    font-size: 0.8125rem;
    line-height: 1.45;
    color: #fff;
  }
  .dn-urgent-text strong { color: #ffd76e; }

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
    align-items: center;
    justify-content: center;
    gap: 0;
    padding: 16px 12px;
    border: 1px solid #ebebeb;
    border-radius: 10px;
    background: #fff;
    cursor: pointer;
    font-family: inherit;
    text-align: center;
    transition: background 0.12s, border-color 0.12s, box-shadow 0.12s;
    min-height: 56px;
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
    font-size: 1.375rem;
    font-weight: 700;
    color: #02a95c;
    line-height: 1;
  }
  .dn-amount-btn.has-badge { padding-top: 26px; }

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

  /* ── Donate button ── */
  .dn-btn-bancontact {
    width: 100%;
    height: 56px;
    background: #02a95c;
    color: #fff;
    border: none;
    border-radius: 14px;
    font-size: 1rem;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    box-shadow: 0 2px 8px rgba(2, 169, 92, 0.25);
    transition: background 0.15s, box-shadow 0.15s, transform 0.1s;
    margin-bottom: 12px;
  }
  .dn-btn-bancontact:hover {
    background: #028f4d;
    box-shadow: 0 4px 16px rgba(2, 169, 92, 0.35);
  }
  .dn-btn-bancontact:active { transform: scale(0.98); }
  .dn-btn-bancontact:disabled { opacity: 0.6; pointer-events: none; }
  .dn-bc-logo {
    height: 28px;
    width: auto;
    display: block;
    flex-shrink: 0;
  }

  /* ── Payment methods row ── */
  .dn-payment-methods {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
    margin: 14px 0 10px;
  }
  .dn-pm-tile {
    height: 40px;
    background: #fff;
    border: 1px solid #E5E7EB;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px 10px;
  }
  .dn-pm-tile img {
    max-height: 100%;
    max-width: 100%;
    width: auto;
    height: auto;
    object-fit: contain;
    display: block;
  }
  .dn-pm-bc img { transform: scale(1.18); transform-origin: center; }
  .dn-pm-visa img { transform: scale(0.82); transform-origin: center; }

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
