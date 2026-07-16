<script lang="ts">
  import {
    ChevronLeft, ChevronRight, Calendar, Shield, Heart, BadgeCheck,
    Facebook, Youtube, Twitter, Instagram,
    Menu, X
  } from 'lucide-svelte';
  import { onMount, onDestroy } from 'svelte';
  import { goto, preloadData, preloadCode } from '$app/navigation';
  import ProgressCard from '$lib/components/ProgressCard.svelte';
  import StickyBottomBar from '$lib/components/StickyBottomBar.svelte';
  import {
    captureAndPersistFbclid, getFbp, getEid, trackEvent, uuid, buildShopifyCartUrl,
    type UtmData
  } from '$lib/utils/fbtracking';
  import { track as trackAnalytics, getSid } from '$lib/utils/analytics';
  import {
    SHOPIFY_SHOP_DOMAIN, TIER_NAME_BY_AMOUNT, pickVariantForAmount
  } from '$lib/data/variants';
  import type { PageData } from './$types';

  const { data } = $props<{ data: PageData }>();
  // Doadores fakes da Ellie NL — nomes NL/BE + timing em holandês
  const ELLIE_DONORS = [
    { name: 'Sophie M.',    amount: 50,  ago: 'zojuist',         initials: 'SM', color: 'av-green',   anonymous: false },
    { name: 'Jasper D.',    amount: 25,  ago: '4 min geleden',   initials: 'JD', color: 'av-teal',    anonymous: false },
    { name: 'Anoniem',      amount: 200, ago: '11 min geleden',  initials: '',   color: 'av-gray',    anonymous: true },
    { name: 'Emma H.',      amount: 100, ago: '23 min geleden',  initials: 'EH', color: 'av-coral',   anonymous: false },
    { name: 'Olivier P.',   amount: 50,  ago: '38 min geleden',  initials: 'OP', color: 'av-amber',   anonymous: false },
    { name: 'Fien R.',      amount: 25,  ago: '55 min geleden',  initials: 'FR', color: 'av-purple',  anonymous: false },
    { name: 'Lars W.',      amount: 75,  ago: '1 u geleden',     initials: 'LW', color: 'av-skyblue', anonymous: false },
    { name: 'Charlotte B.', amount: 100, ago: '2 u geleden',     initials: 'CB', color: 'av-rose',    anonymous: false },
    { name: 'Anoniem',      amount: 500, ago: '2 u geleden',     initials: '',   color: 'av-gray',    anonymous: true },
    { name: 'Joris T.',     amount: 35,  ago: '3 u geleden',     initials: 'JT', color: 'av-green',   anonymous: false },
    { name: 'Femke A.',     amount: 50,  ago: '4 u geleden',     initials: 'FA', color: 'av-teal',    anonymous: false },
    { name: 'Hendrik S.',   amount: 25,  ago: '5 u geleden',     initials: 'HS', color: 'av-coral',   anonymous: false },
    { name: 'Marieke K.',   amount: 200, ago: '7 u geleden',     initials: 'MK', color: 'av-amber',   anonymous: false },
    { name: 'Ruben J.',     amount: 50,  ago: '9 u geleden',     initials: 'RJ', color: 'av-purple',  anonymous: false },
    { name: 'Ella B.',      amount: 35,  ago: '11 u geleden',    initials: 'EB', color: 'av-skyblue', anonymous: false },
    { name: 'Anoniem',      amount: 150, ago: '13 u geleden',    initials: '',   color: 'av-gray',    anonymous: true },
    { name: 'Chloé D.',     amount: 25,  ago: '15 u geleden',    initials: 'CD', color: 'av-rose',    anonymous: false },
    { name: 'Bram M.',      amount: 100, ago: '18 u geleden',    initials: 'BM', color: 'av-green',   anonymous: false },
    { name: 'Amber V.',     amount: 50,  ago: '20 u geleden',    initials: 'AV', color: 'av-teal',    anonymous: false },
    { name: 'Daan R.',      amount: 35,  ago: '22 u geleden',    initials: 'DR', color: 'av-coral',   anonymous: false }
  ];

  // Doadores reais (das últimas 24h, filtrados por funil Ellie) sobrem no topo,
  // fakes completam até dar 20 itens. Assim que uma compra real chega, ela vira
  // o "último doador" que aparece no ProgressCard e sticky bar.
  const donorsList = $derived.by(() => {
    const real = (data.realDonors ?? []) as Array<typeof ELLIE_DONORS[number] & { real?: boolean; ts?: number }>;
    const needed = Math.max(0, 20 - real.length);
    return [...real, ...ELLIE_DONORS.slice(0, needed)];
  });
  // Stats da campanha da Ellie NL — independente do funil animal
  // Baseline fake + soma real das últimas 24h (feed via +page.server.ts)
  const RAISED_BASELINE = 2894;
  const DONATIONS_BASELINE = 76;
  const raisedEur = $derived.by(() => {
    const realSum = ((data.realDonors ?? []) as Array<{ amount: number }>).reduce((s, d) => s + (d.amount || 0), 0);
    return RAISED_BASELINE + realSum;
  });
  const donationsCount = $derived(DONATIONS_BASELINE + (data.realDonorsCount ?? 0));
  // Operação urgente: 42 dias (countdown a partir de 2026-07-07)
  const ELLIE_SURGERY_DATE = new Date('2026-08-18T00:00:00Z');
  const ellieDaysLeft = Math.max(0, Math.ceil((ELLIE_SURGERY_DATE.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  const ELLIE_DAYS_LEFT = ellieDaysLeft;

  // ──────────────────────────────────────────────────────────────
  // Campanha: ELLIE · 9 JAAR · HOOG-RISICO LEUKEMIE · ANTWERPEN
  // ──────────────────────────────────────────────────────────────
  const ELLIE = {
    title: "Ellie is 9. Samen betalen we haar behandeling.",
    subtitle: "Ellie's ouders werken hard, maar hun loon dekt de kosten van haar stamceltransplantatie niet. Belgen komen samen om haar te helpen — elke bijdrage telt.",
    storyPreview: [
      "Dit is Ellie.",
      "Ze is negen jaar oud, woont in Antwerpen, en werd zes weken geleden gediagnosticeerd met leukemie. Haar leven kan gered worden — maar niet zonder onze hulp."
    ],
    storyRest: [
      "Haar mama Sarah maakt schoon bij Albert Heijn en werkt 's avonds nog in een woonzorgcentrum. Haar papa Mark rijdt een bestelwagen. Samen verdienen ze net iets meer dan het minimumloon. Ze hebben hun spaargeld opgemaakt, de auto verkocht, geld geleend van familie — en tóch komen ze €15.750 tekort voor de stamceltransplantatie die Ellie's leven kan redden.",
      "Overal in België komen mensen nu samen om Ellie te helpen. Buren, klasgenoten, collega's van Sarah, wildvreemden — iedereen doneert wat hij of zij kan missen. €10, €25, €50. Elk beetje brengt Ellie dichter bij haar behandeling, dichter bij thuiskomen, dichter bij haar tiende verjaardag in november.",
      "Kunt u niet doneren? Deel deze pagina alstublieft met uw familie, vrienden en collega's. Eén klik op 'delen' kan iemand anders bereiken die wél kan bijdragen. Zo helpt u Ellie misschien nog meer dan met een donatie zelf. Bedankt dat u haar verhaal leest."
    ],
    highlight: "Elke donatie én elke gedeelde link brengt Ellie dichter bij haar behandeling. Bedankt voor uw hulp — hoe klein ook.",
    goalEur: 15750,
    shareTitle: "Help Ellie (9) — samen betalen we haar levensreddende behandeling",
    shareUrl: 'https://belgianpawsfoundation.org/ellie/de'
  };

  // Tiers em EUR — copy NL/BE pra doação pediátrica
  const TIERS = [
    { amount: 25,  label: '1 dag pijnverlichting' },
    { amount: 50,  label: '1 week voeding tijdens chemo' },
    { amount: 100, label: 'Volledige MIBG-scan voor behandeling' },
    { amount: 200, label: 'Drie chemotherapiesessies' }
  ];
  const DEFAULT_TIER = 50;

  // Valores extras (modal "Ander bedrag")
  const OTHER_AMOUNTS = [
    { amount: 10,  label: "1 uur zuurstofondersteuning" },
    { amount: 15,  label: "1 dag anti-misselijkheidsmedicatie" },
    { amount: 20,  label: "Steriele verbanden + PICC-lijn verzorging" },
    { amount: 35,  label: "1 fysiosessie na chemo" },
    { amount: 80,  label: "Helpt de MIBG-scan dekken" },
    { amount: 250, label: "Eén immunotherapiedosis" },
    { amount: 500, label: "Twee immunotherapiedoses" },
    { amount: 750, label: "Een volledige week behandeling in Duitsland" }
  ];

  function labelForAmount(amount: number): string {
    const t = TIERS.find((x) => x.amount === amount);
    if (t) return t.label;
    if (amount >= 750) return 'Een volledige week behandeling in Duitsland';
    if (amount >= 500) return 'Twee immunotherapiedoses';
    if (amount >= 250) return 'Eén immunotherapiedosis';
    if (amount >= 80)  return 'Helpt de MIBG-scan dekken';
    if (amount >= 35)  return 'Eén fysiosessie';
    return `€${amount} voor Ellie's behandeling`;
  }

  // Estado de tracking
  let fbclid: string | null = $state(null);
  let fbc: string | null = $state(null);
  let fbp: string | null = $state(null);
  let utm: UtmData | null = $state(null);

  let donorIdx = $state(0);
  let donorTimer: ReturnType<typeof setInterval> | null = null;
  const lastDonor = $derived(donorsList[donorIdx % donorsList.length]);

  // Hero carousel (rotativo 4s, pausa em interação) — pos é object-position por slide
  // TODO: adicionar mais cenas reais da Ellie (mum-hand, before-park, etc.) na próxima leva
  const HERO_SLIDES = [
    { src: '/ellie/ellie-nurses-sign-hero.jpg', pos: 'center center' },
    { src: '/ellie/ellie-drawing.webp',    pos: 'center center' }
  ];
  let heroIdx = $state(0);
  let heroTimer: ReturnType<typeof setInterval> | null = null;
  let heroPausedByUser = $state(false);

  function heroGoTo(i: number) {
    heroIdx = (i + HERO_SLIDES.length) % HERO_SLIDES.length;
    heroPausedByUser = true;
    if (heroTimer) { clearInterval(heroTimer); heroTimer = null; }
  }
  function heroNext() { heroGoTo(heroIdx + 1); }
  function heroPrev() { heroGoTo(heroIdx - 1); }

  onMount(() => {
    const tracking = captureAndPersistFbclid();
    fbclid = tracking.fbclid;
    fbc = tracking.fbc;
    utm = tracking.utm;
    setTimeout(() => { fbp = getFbp(); }, 500);

    preloadCode('/donate').catch(() => {});
    setTimeout(() => { preloadData('/donate').catch(() => {}); }, 1200);

    donorTimer = setInterval(() => {
      donorIdx = (donorIdx + 1) % donorsList.length;
    }, 4200);

    // Hero carousel: troca a cada 4s (para se user interagir)
    heroTimer = setInterval(() => {
      if (heroPausedByUser) return;
      heroIdx = (heroIdx + 1) % HERO_SLIDES.length;
    }, 4000);

  });

  onDestroy(() => {
    if (donorTimer) clearInterval(donorTimer);
    if (heroTimer) clearInterval(heroTimer);
  });

  function scrollToDonors() {
    const el = document.getElementById('donations');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  let descExpanded = $state(false);
  let donationOpen = $state(false);
  let shareOpen = $state(false);
  let otherAmountOpen = $state(false);
  let quickDonating = $state<number | null>(null);
  let currentStep = $state<1 | 2>(1);
  let selectedAmount = $state<number>(DEFAULT_TIER);
  let donating = $state(false);
  let toastMessage = $state('');
  let toastVisible = $state(false);
  let menuOpen = $state(false);
  let donorsModalOpen = $state(false);

  // Adoption form
  let adoptFormOpen = $state(false);
  let adoptName = $state('');
  let adoptCity = $state('');
  let adoptEmail = $state('');
  let adoptSubmitting = $state(false);
  let adoptError = $state('');
  let adoptThanksOpen = $state(false);

  function openAdoptForm() {
    adoptFormOpen = true;
    // foca o primeiro input no proximo tick
    setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>('.adopt-form input');
      el?.focus();
    }, 100);
  }

  async function submitAdoption(e: Event) {
    e.preventDefault();
    adoptError = '';
    if (!adoptName.trim() || !adoptCity.trim() || !adoptEmail.trim()) {
      adoptError = 'Vul alle velden in.';
      return;
    }
    adoptSubmitting = true;
    try {
      const r = await fetch('/api/adoption', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: adoptName, city: adoptCity, email: adoptEmail })
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        adoptError = data.error === 'invalid email' ? 'Ongeldig e-mailadres.' : 'Er ging iets mis. Probeer het opnieuw.';
      } else {
        adoptName = '';
        adoptCity = '';
        adoptEmail = '';
        adoptThanksOpen = true;
      }
    } catch {
      adoptError = 'Verbinding mislukt. Probeer het opnieuw.';
    } finally {
      adoptSubmitting = false;
    }
  }

  const MENU_ITEMS = [
    { id: 'story-section', label: 'Verhaal' },
    { id: 'donations', label: 'Donaties' },
    { id: 'organizer-section', label: 'Organisator' }
  ];

  function scrollToSection(id: string) {
    menuOpen = false;
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function showToast(msg: string) {
    toastMessage = msg;
    toastVisible = true;
    setTimeout(() => (toastVisible = false), 2500);
  }

  function openDonation() {
    const el = document.getElementById('doneer-nu');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Destaque visual rápido pra chamar atenção pro grid de tiers
      el.classList.add('highlight');
      setTimeout(() => el.classList.remove('highlight'), 1400);
    }
  }

  // Redirect direto pro checkout Shopify — SEM passar por /donate, SEM step de confirmação
  // IC (Meta Pixel + CAPI) + notificação Pushcut disparam IMEDIATAMENTE no clique,
  // antes do redirect. Usa keepalive:true pra request sobreviver ao unload da página.
  function quickDonate(amount: number) {
    if (quickDonating !== null) return;
    quickDonating = amount;

    const eventId = uuid();
    const contentId = `ellie-${amount}`;

    // Vitrack: seleção de valor + CTA (flush imediato via IMMEDIATE_EVENTS)
    trackAnalytics('amount_select', { amount, source: 'ellie_quick' });
    trackAnalytics('cta_click', { amount, tier: contentId, source: 'ellie_quick' });

    // 1) Meta Pixel client-side (fbq) — dedup com CAPI via mesmo event_id
    trackEvent('InitiateCheckout', {
      value: amount,
      currency: 'EUR',
      content_ids: [contentId],
      content_type: 'product',
      num_items: 1
    }, eventId);

    // 2) Meta CAPI server-side (bypassa ad-blocker) + Pushcut notify — fire-and-forget
    //    keepalive:true garante que a request completa mesmo com window.location logo abaixo
    try {
      fetch('/api/track-ic', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          eventId,
          value: amount,
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
      }).catch((e) => console.warn('[ellie] CAPI IC failed', e));
    } catch (e) {
      console.warn('[ellie] CAPI IC fetch threw', e);
    }

    const variantId = pickVariantForAmount(amount);

    // Pequeno delay pra Pixel client-side terminar de enfileirar o beacon
    setTimeout(() => {
      if (!variantId || variantId.startsWith('PLACEHOLDER')) {
        window.location.href = `/supporter?tier=${amount}&event_id=${eventId}`;
      } else {
        window.location.href = buildShopifyCartUrl({
          shopDomain: SHOPIFY_SHOP_DOMAIN,
          variantId,
          fbclid,
          fbp,
          eventId,
          utm,
          sid: getSid(),
          eid: getEid(),
          funnel: 'ellie-nl'
        });
      }
    }, 250);
  }

  function selectAmount(amount: number) {
    selectedAmount = amount;
    trackAnalytics('amount_select', { amount, source: 'ellie_step' });
    setTimeout(() => {
      currentStep = 2;
    }, 200);
  }

  function handleDonate() {
    donating = true;

    const eventId = uuid();
    const contentId = `ellie-${selectedAmount}`;

    // Vitrack: CTA final (botão de checkout do modal 2-step)
    trackAnalytics('bancontact_click', { amount: selectedAmount, tier: contentId, source: 'ellie_step' });

    // Meta + Taboola + TikTok IC com content_id especifico da Ellie pra atribuicao limpa
    trackEvent('InitiateCheckout', {
      value: selectedAmount,
      currency: 'EUR',
      content_ids: [contentId],
      content_type: 'product',
      num_items: 1
    }, eventId);

    const variantId = pickVariantForAmount(selectedAmount);
    const isPlaceholder = !variantId || variantId.startsWith('PLACEHOLDER');
    const tierName = TIER_NAME_BY_AMOUNT[selectedAmount] || String(selectedAmount);

    setTimeout(() => {
      if (isPlaceholder) {
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
          eid: getEid(),
          funnel: 'ellie-nl'
        });
      }
    }, 800);
  }

  function shareTo(target: 'whatsapp' | 'facebook' | 'copy') {
    const text = `${ELLIE.shareTitle} ${ELLIE.shareUrl}`;
    if (target === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    } else if (target === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(ELLIE.shareUrl)}`, '_blank');
    } else {
      navigator.clipboard?.writeText(ELLIE.shareUrl).then(() => {
        showToast('Link gekopieerd!');
        shareOpen = false;
      });
    }
  }
</script>

<svelte:head>
  <title>{ELLIE.title}</title>
  <meta name="description" content={ELLIE.subtitle} />
</svelte:head>

<header class="header">
  <span class="header-logo" aria-label="GoFundMe">
    <img
      class="logo-img"
      src="/ellie/gofundme-logo.png"
      alt="GoFundMe"
      width="1280"
      height="383"
      decoding="async"
    />
    <span class="header-flag" aria-hidden="true">{data.visitorFlag ?? '🇧🇪'}</span>
  </span>
  <button
    class="header-menu-btn"
    aria-label="Menu openen"
    aria-expanded={menuOpen}
    onclick={() => (menuOpen = !menuOpen)}
  >
    {#if menuOpen}
      <X size={22} strokeWidth={2} />
    {:else}
      <Menu size={22} strokeWidth={2} />
    {/if}
  </button>

  {#if menuOpen}
    <button
      class="header-menu-backdrop"
      aria-label="Menu sluiten"
      onclick={() => (menuOpen = false)}
    ></button>
    <nav class="header-menu-dropdown" aria-label="Site navigatie">
      {#each MENU_ITEMS as item}
        <button class="header-menu-item" onclick={() => scrollToSection(item.id)}>
          {item.label}
          <ChevronRight size={16} strokeWidth={2} />
        </button>
      {/each}
    </nav>
  {/if}
</header>

<div class="page">
  <div class="container-app">
    <!-- Hero carousel: fotos da Ellie, autoplay 4s + navegação manual -->
    <div class="hero-image-wrap hero-carousel" data-section="hero-image">
      {#each HERO_SLIDES as slide, i}
        <img
          class="hero-image"
          class:hero-slide-active={heroIdx === i}
          src={slide.src}
          alt={ELLIE.title}
          loading={i === 0 ? 'eager' : 'lazy'}
          fetchpriority={i === 0 ? 'high' : 'auto'}
          decoding="async"
          width="900"
          height="600"
          style:object-position={slide.pos}
        />
      {/each}

      {#if HERO_SLIDES.length > 1}
        <button
          type="button"
          class="hero-arrow hero-arrow-prev"
          aria-label="Vorige foto"
          onclick={heroPrev}
        >
          <ChevronLeft size={22} strokeWidth={2.5} />
        </button>
        <button
          type="button"
          class="hero-arrow hero-arrow-next"
          aria-label="Volgende foto"
          onclick={heroNext}
        >
          <ChevronRight size={22} strokeWidth={2.5} />
        </button>

        <div class="hero-dots">
          {#each HERO_SLIDES as _, i}
            <button
              type="button"
              class="hero-dot"
              class:active={heroIdx === i}
              aria-label={`Foto ${i + 1}`}
              onclick={() => heroGoTo(i)}
            ></button>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Bloco principal -->
    <section class="hero-block" data-section="hero-block">
      <h1 class="campaign-title">{ELLIE.title}</h1>

      <div id="progress-anchor">
        <ProgressCard
          raised={raisedEur}
          goal={ELLIE.goalEur}
          lastDonorName={lastDonor.anonymous ? 'Anoniem' : lastDonor.name}
          lastDonorAmount={lastDonor.amount}
          lastDonorAgo={lastDonor.ago}
          onDonate={openDonation}
          onShare={() => (shareOpen = true)}
          onDonorsClick={scrollToDonors}
          currency="€"
          locale="nl-NL"
          raisedLabel="opgehaald"
          ofLabel="van"
          donatedVerb="doneerde"
          donateLabel="Doneren"
          shareLabel="Delen"
          donorsAria="Bekijk alle donateurs"
        />
      </div>

      <div id="story-section" data-section="story" class="story-text">
        {#each ELLIE.storyPreview as paragraph}
          <p>{paragraph}</p>
        {/each}
        {#if descExpanded}
          {#each ELLIE.storyRest as paragraph, i}
            <p>{paragraph}</p>
            {#if i === 1}
              <figure class="story-inline-figure">
                <img
                  src="/ellie/ellie-hope-inline.jpg"
                  alt="Ellie tijdens haar verjaardag in het ziekenhuis"
                  loading="lazy"
                  decoding="async"
                  width="900"
                  height="509"
                />
              </figure>
            {/if}
          {/each}
        {/if}
      </div>
      <button class="read-more" onclick={() => (descExpanded = !descExpanded)}>
        {descExpanded ? 'Minder lezen' : 'Meer lezen'}
      </button>
    </section>

    {#if descExpanded}
      <section class="section">
        <span class="story-highlight">{ELLIE.highlight}</span>
      </section>
    {/if}

    <!-- ────────────────────────────────────────────────────────────────
         SEÇÃO INLINE DE DOAÇÃO — checkout direto, sem passar por /donate
    ──────────────────────────────────────────────────────────────── -->
    <section class="section inline-donate" id="doneer-nu">
      <div class="inline-donate-eyebrow">
        <span class="pulse-dot"></span>
        DIRECTE STEUN VOOR ELLIE
      </div>
      <h2 class="inline-donate-title">Kies je donatie</h2>
      <p class="inline-donate-sub">
        100% gaat rechtstreeks naar Ellie's behandeling, scans en de immunotherapie-studie in Duitsland.
        <br />Betaal veilig met <strong>bankkaart</strong>, Bancontact, Apple Pay of Google Pay.
      </p>

      <div class="inline-tier-grid">
        {#each TIERS as tier}
          <button
            type="button"
            class="inline-tier"
            class:popular={tier.amount === 100}
            disabled={quickDonating !== null}
            onclick={() => quickDonate(tier.amount)}
          >
            {#if tier.amount === 100}
              <span class="inline-tier-badge">Meest gekozen</span>
            {/if}
            <span class="inline-tier-value">€{tier.amount}</span>
            <span class="inline-tier-label">{tier.label}</span>
            {#if quickDonating === tier.amount}
              <span class="inline-tier-loading"><span class="spinner"></span> Doorverwijzen…</span>
            {:else}
              <span class="inline-tier-cta">Nu doneren →</span>
            {/if}
          </button>
        {/each}
      </div>

      <button
        type="button"
        class="inline-other-btn"
        onclick={() => (otherAmountOpen = true)}
        disabled={quickDonating !== null}
      >
        Kies een ander bedrag
      </button>

      <div class="inline-trust">
        <span class="trust-item"><Shield size="14" /> SSL beveiligd</span>
        <span class="trust-sep">·</span>
        <span class="trust-item"><BadgeCheck size="14" /> UZ Antwerpen geverifieerd</span>
        <span class="trust-sep">·</span>
        <span class="trust-item"><Heart size="14" /> 100% rechtstreeks naar Ellie</span>
      </div>
    </section>

    <!-- Message for Ellie (form que captura email pro update) -->
    <section class="section adopt-section" id="berichtje-lina">
      <div class="section-eyebrow">Stuur haar wat liefde</div>
      <h2 class="section-title">Schrijf een berichtje voor Ellie</h2>
      <p class="adopt-intro">Haar mama print elk berichtje en plakt het aan de muur naast haar bed. Laat je gegevens achter — we sturen je een update over hoe het met haar gaat.</p>

      {#if !adoptFormOpen}
        <button type="button" class="adopt-cta" onclick={openAdoptForm}>
          <span class="adopt-cta-icon" aria-hidden="true">🤍</span>
          <span>Schrijf een berichtje voor Ellie</span>
        </button>
      {:else}
        <form class="adopt-form" onsubmit={submitAdoption} novalidate>
          <label class="adopt-field">
            <span>Je naam</span>
            <input type="text" bind:value={adoptName} placeholder="Voornaam" autocomplete="given-name" required />
          </label>
          <label class="adopt-field">
            <span>Stad</span>
            <input type="text" bind:value={adoptCity} placeholder="bv. Antwerpen" autocomplete="address-level2" required />
          </label>
          <label class="adopt-field">
            <span>E-mail (voor de update)</span>
            <input type="email" bind:value={adoptEmail} placeholder="naam@email.com" autocomplete="email" required />
          </label>

          {#if adoptError}
            <div class="adopt-error">{adoptError}</div>
          {/if}

          <button type="submit" class="adopt-submit" disabled={adoptSubmitting}>
            {#if adoptSubmitting}
              <span class="spinner spinner-dark"></span>
              <span>Versturen…</span>
            {:else}
              Berichtje versturen
            {/if}
          </button>
        </form>
      {/if}
    </section>

    <!-- Donors -->
    <div class="donations" id="donations">
      <div class="donations-header">
        <div class="donations-title">
          Donaties
          <span class="donations-badge">{donationsCount}</span>
        </div>
        <button class="donations-link" onclick={() => (donorsModalOpen = true)}>Bekijk alles</button>
      </div>
      <ul class="donor-list">
        {#each donorsList.slice(0, 5) as d}
          <li class="donor-item">
            <div class="donor-avatar {d.color}">
              {#if d.anonymous}
                <Heart size={16} fill="currentColor" />
              {:else}
                {d.initials}
              {/if}
            </div>
            <div class="donor-info">
              <div class="donor-name">{d.name}</div>
              <div class="donor-meta">{d.ago}</div>
            </div>
            <div class="donor-amount">€{d.amount}</div>
          </li>
        {/each}
      </ul>
      <button class="btn-see-all" onclick={() => (donorsModalOpen = true)}>
        Bekijk alle {donorsList.length}+ donaties
      </button>
    </div>

    <!-- Organizer -->
    <div class="organizer" id="organizer-section">
      <h3>Organisator</h3>
      <div class="organizer-row">
        <div class="organizer-avatar">
          <img src="/ellie/organizer-avatar.png" alt="Belgian Children's Care Foundation" loading="lazy" decoding="async" />
        </div>
        <div style="flex:1;min-width:0">
          <div class="organizer-name">
            <span>Belgian Children's Care Foundation</span>
            <span class="verified-badge" title="Geverifieerde organisatie" aria-label="Geverifieerde organisatie">
              <BadgeCheck size={16} strokeWidth={2.5} />
            </span>
          </div>
          <div class="organizer-sub">Officieel geverifieerd · Organisator</div>
          <div class="organizer-sub">Antwerpen, België</div>
        </div>
      </div>

      <div class="campaign-extras">
        <div class="campaign-extras-row">
          <Calendar size={14} />
          Juli 2026 ·
          <a href="#">Medische noodgevallen</a>
        </div>
        <div class="badge-protected">
          <Shield size={14} />
          Donatie beschermd
        </div>
      </div>
    </div>

    <!-- Footer -->
    <footer class="footer">
      <div class="footer-social">
        <a href="#" aria-label="Facebook"><Facebook size={20} /></a>
        <a href="#" aria-label="YouTube"><Youtube size={20} /></a>
        <a href="#" aria-label="Twitter"><Twitter size={20} /></a>
        <a href="#" aria-label="Instagram"><Instagram size={20} /></a>
      </div>

      <div class="footer-copy">© 2026 Belgian Children's Care Foundation</div>

      <div class="footer-links">
        <a href="#">Voorwaarden</a>
        <a href="#">Privacy</a>
        <a href="#">Terugbetalingen</a>
        <a href="#">Cookies</a>
        <a href="mailto:contact@belgiancarestore.com">Contact</a>
      </div>
    </footer>
  </div>
</div>

<!-- Sticky bottom bar -->
<StickyBottomBar
  raised={raisedEur}
  goal={ELLIE.goalEur}
  lastDonorName={lastDonor.anonymous ? 'Anoniem' : lastDonor.name}
  lastDonorAmount={lastDonor.amount}
  lastDonorAgo={lastDonor.ago}
  onDonate={openDonation}
  onShare={() => (shareOpen = true)}
  onDonorsClick={scrollToDonors}
  currency="€"
  locale="nl-NL"
  raisedLabel="opgehaald"
  ofLabel="van"
  donatedVerb="doneerde"
  donateLabel="Doneren"
  shareLabel="Delen"
  donorsAria="Bekijk alle donateurs"
/>

<!-- Donation Sheet -->
<div
  class="overlay"
  class:open={donationOpen}
  role="dialog"
  aria-modal="true"
  aria-label="Donatie"
  onclick={(e) => e.target === e.currentTarget && (donationOpen = false)}
>
  <div class="sheet" role="document">
    <div class="sheet-handle"></div>
    <div class="sheet-title">
      {currentStep === 1 ? 'Doneer aan Ellie' : 'Bevestig je donatie'}
    </div>
    {#if currentStep === 1}
      <p class="sheet-subtitle">Elke euro gaat rechtstreeks naar Ellie's behandeling, scans en de immunotherapie-studie.</p>
    {/if}

    {#if currentStep === 1}
      <div class="step-form active">
        <div class="step-label">Kies een bedrag</div>
        <div class="amount-grid amount-grid-2x2">
          {#each TIERS as tier}
            <button
              type="button"
              class="amount-btn amount-btn-tier"
              class:selected={selectedAmount === tier.amount}
              class:popular={tier.amount === 100}
              onclick={() => selectAmount(tier.amount)}
            >
              {#if tier.amount === 100}
                <span class="amount-btn-badge">Meest gekozen</span>
              {/if}
              <span class="amount-btn-value">€{tier.amount}</span>
              <span class="amount-btn-sub">{tier.label}</span>
            </button>
          {/each}
        </div>
      </div>
    {:else}
      <div class="step-form active">
        <button class="btn-back" onclick={() => (currentStep = 1)}>← Terug</button>
        <div class="confirm-screen">
          <div class="step-label">Je donatie</div>
          <div class="confirm-amount">€{selectedAmount}</div>
          <p class="confirm-sub">{labelForAmount(selectedAmount)}.</p>

          <p class="confirm-direct-note">
            Je donatie gaat rechtstreeks naar Ellie's behandeling, scans en de immunotherapie-studie.
          </p>

          <button class="btn-bancontact" onclick={handleDonate} disabled={donating}>
            {#if donating}
              <div class="spinner spinner-dark"></div>
              <span class="btn-bancontact-text">Doorverwijzen…</span>
            {:else}
              <span class="btn-bancontact-text">€{selectedAmount} veilig doneren</span>
            {/if}
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>

<!-- Share Sheet -->
<div
  class="overlay"
  class:open={shareOpen}
  role="dialog"
  aria-modal="true"
  aria-label="Delen"
  onclick={(e) => e.target === e.currentTarget && (shareOpen = false)}
>
  <div class="sheet" role="document">
    <div class="sheet-handle"></div>
    <div class="sheet-title">Deel deze campagne</div>
    <div class="share-grid">
      <button class="share-btn" onclick={() => shareTo('whatsapp')}>
        <div class="share-icon" style="background:var(--primary-soft)">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="#25D366">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
            <path d="M11.997 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.878-1.417A9.944 9.944 0 0 0 11.997 22C17.52 22 22 17.523 22 12c0-5.522-4.48-10-10.003-10zm0 18.18a8.154 8.154 0 0 1-4.158-1.138l-.297-.178-3.087.897.923-3.01-.196-.309A8.145 8.145 0 0 1 3.817 12c0-4.516 3.664-8.18 8.18-8.18s8.18 3.664 8.18 8.18c0 4.517-3.664 8.18-8.18 8.18z" />
          </svg>
        </div>
        <span class="share-label">WhatsApp</span>
      </button>
      <button class="share-btn" onclick={() => shareTo('facebook')}>
        <div class="share-icon" style="background:var(--primary-soft)">
          <Facebook size={22} color="#1877F2" />
        </div>
        <span class="share-label">Facebook</span>
      </button>
      <button class="share-btn" onclick={() => shareTo('copy')}>
        <div class="share-icon" style="background:#F3F4F6">
          <svg width="22" height="22" fill="none" stroke="#374151" stroke-width="2" viewBox="0 0 24 24">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        </div>
        <span class="share-label">Link kopiëren</span>
      </button>
    </div>
  </div>
</div>

<!-- ─────────────────────────────────────────────────────────
     Modal "Ander bedrag" — lista os valores extras
──────────────────────────────────────────────────────── -->
<div
  class="overlay"
  class:open={otherAmountOpen}
  role="dialog"
  aria-modal="true"
  aria-label="Ander bedrag"
  onclick={(e) => e.target === e.currentTarget && (otherAmountOpen = false)}
>
  <div class="sheet sheet-tall" role="document">
    <div class="sheet-handle"></div>
    <div class="sheet-title">Kies een ander bedrag</div>
    <p class="sheet-subtitle">Elke euro telt. 100% gaat naar Ellie's behandeling.</p>

    <div class="other-amount-list">
      {#each OTHER_AMOUNTS as opt}
        <button
          type="button"
          class="other-amount-row"
          disabled={quickDonating !== null}
          onclick={() => { otherAmountOpen = false; quickDonate(opt.amount); }}
        >
          <span class="other-amount-value">€{opt.amount}</span>
          <span class="other-amount-label">{opt.label}</span>
          {#if quickDonating === opt.amount}
            <span class="spinner spinner-dark"></span>
          {:else}
            <span class="other-amount-arrow">→</span>
          {/if}
        </button>
      {/each}
    </div>
  </div>
</div>

<!-- All Donors Sheet -->
<div
  class="overlay"
  class:open={donorsModalOpen}
  role="dialog"
  aria-modal="true"
  aria-label="Alle donaties"
  onclick={(e) => e.target === e.currentTarget && (donorsModalOpen = false)}
>
  <div class="sheet sheet-donors" role="document">
    <div class="sheet-handle"></div>
    <div class="sheet-title">Alle donaties ({donationsCount})</div>
    <p class="sheet-subtitle">Laatste supporters die Ellie helpen leukemie te overwinnen.</p>
    <ul class="donor-list donor-list-full">
      {#each donorsList as d}
        <li class="donor-item">
          <div class="donor-avatar {d.color}">
            {#if d.anonymous}
              <Heart size={16} fill="currentColor" />
            {:else}
              {d.initials}
            {/if}
          </div>
          <div class="donor-info">
            <div class="donor-name">{d.name}</div>
            <div class="donor-meta">{d.ago}</div>
          </div>
          <div class="donor-amount">€{d.amount}</div>
        </li>
      {/each}
    </ul>
    <button class="sheet-close-btn" onclick={() => (donorsModalOpen = false)}>Sluiten</button>
  </div>
</div>

<!-- Toast -->
<div class="toast" class:show={toastVisible}>{toastMessage}</div>

<!-- Berichtje thanks popup -->
{#if adoptThanksOpen}
  <button
    class="adopt-thanks-backdrop"
    aria-label="Sluiten"
    onclick={() => (adoptThanksOpen = false)}
  ></button>
  <div class="adopt-thanks" role="dialog" aria-modal="true" aria-label="Bedankt">
    <div class="adopt-thanks-icon" aria-hidden="true">🤍</div>
    <h3>Bedankt!</h3>
    <p>Je berichtje is verstuurd naar Ellie's mama Sarah. We sturen je een update zodra haar behandelplan bevestigd is — meestal binnen <strong>een week</strong>.</p>
    <button class="adopt-thanks-close" onclick={() => (adoptThanksOpen = false)}>Sluiten</button>
  </div>
{/if}


<style>
  /* GoFundMe logo — usa .logo-img global (28px mobile / 32px tablet+) */
  .header-logo .header-flag { margin-left: 8px; font-size: 1.2rem; }

  /* Hero carousel — dots + arrows */
  :global(.hero-carousel) { position: relative; }
  .hero-dots {
    position: absolute;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 8px;
    z-index: 3;
  }
  .hero-dot {
    width: 8px;
    height: 8px;
    padding: 0;
    border: 0;
    border-radius: 9999px;
    background: rgba(255,255,255,0.5);
    box-shadow: 0 1px 3px rgba(0,0,0,0.35);
    transition: background 0.25s, transform 0.25s;
    cursor: pointer;
  }
  .hero-dot.active {
    background: #fff;
    transform: scale(1.35);
  }
  .hero-dot:hover:not(.active) { background: rgba(255,255,255,0.75); }
  .hero-dot:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }

  .hero-arrow {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 40px;
    height: 40px;
    border-radius: 9999px;
    border: 0;
    background: rgba(20,20,20,0.42);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 3;
    padding: 0;
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    transition: background 0.2s, transform 0.15s;
    box-shadow: 0 2px 8px rgba(0,0,0,0.25);
  }
  .hero-arrow:hover { background: rgba(20,20,20,0.6); }
  .hero-arrow:active { transform: translateY(-50%) scale(0.94); }
  .hero-arrow:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
  .hero-arrow-prev { left: 10px; }
  .hero-arrow-next { right: 10px; }
  @media (max-width: 480px) {
    .hero-arrow { width: 36px; height: 36px; }
    .hero-arrow-prev { left: 8px; }
    .hero-arrow-next { right: 8px; }
  }

  /* Imagem inline no meio da descrição — contida, centralizada, cantos suaves */
  .story-inline-figure {
    margin: 22px auto;
    max-width: 460px;
    width: 100%;
    padding: 0;
  }
  .story-inline-figure img {
    width: 100%;
    height: auto;
    display: block;
    border-radius: 14px;
    box-shadow: 0 8px 22px rgba(0,0,0,0.14);
  }
  @media (min-width: 640px) {
    .story-inline-figure { max-width: 540px; }
  }

  .adopt-section { padding-top: 18px; padding-bottom: 24px; }
  .adopt-intro {
    margin-top: 8px;
    font-size: 0.9375rem;
    color: #4b5563;
    line-height: 1.5;
  }
  .adopt-cta {
    margin-top: 20px;
    width: 100%;
    background: #0E4B2C;
    color: #fff;
    border: none;
    border-radius: 14px;
    padding: 18px 20px;
    font-size: 1.0625rem;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    box-shadow: 0 4px 14px rgba(14, 75, 44, 0.25);
    transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
  }
  .adopt-cta:hover { background: #0A3A20; box-shadow: 0 6px 18px rgba(14, 75, 44, 0.32); }
  .adopt-cta:active { transform: translateY(1px); }
  .adopt-cta-icon { font-size: 1.25rem; line-height: 1; }
  .adopt-form {
    margin-top: 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .adopt-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .adopt-field span {
    font-size: 0.8125rem;
    font-weight: 600;
    color: #111;
  }
  .adopt-field input {
    width: 100%;
    padding: 13px 14px;
    border: 1.5px solid #d1d5db;
    border-radius: 12px;
    font-size: 1rem;
    font-family: inherit;
    color: #111;
    background: #fff;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .adopt-field input:focus {
    outline: none;
    border-color: #0E4B2C;
    box-shadow: 0 0 0 3px rgba(14, 75, 44, 0.15);
  }
  .adopt-error {
    color: #b91c1c;
    font-size: 0.875rem;
    background: #fee2e2;
    border: 1px solid #fca5a5;
    border-radius: 8px;
    padding: 10px 12px;
  }
  .adopt-submit {
    margin-top: 4px;
    background: #0E4B2C;
    color: #fff;
    border: none;
    border-radius: 12px;
    padding: 15px 20px;
    font-size: 1rem;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    transition: background 0.15s, transform 0.1s;
  }
  .adopt-submit:hover:not(:disabled) { background: #0A3A20; }
  .adopt-submit:active:not(:disabled) { transform: scale(0.98); }
  .adopt-submit:disabled { opacity: 0.7; cursor: progress; }

  /* Thanks popup */
  .adopt-thanks-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.55);
    border: none;
    padding: 0;
    cursor: pointer;
    z-index: 9998;
  }
  .adopt-thanks {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #fff;
    border-radius: 20px;
    width: calc(100% - 32px);
    max-width: 380px;
    padding: 32px 26px 26px;
    text-align: center;
    box-shadow: 0 30px 80px rgba(0,0,0,0.35);
    z-index: 9999;
  }
  .adopt-thanks-icon {
    font-size: 44px;
    line-height: 1;
    margin-bottom: 8px;
  }
  .adopt-thanks h3 {
    font-size: 1.375rem;
    color: #0E4B2C;
    margin-bottom: 10px;
    font-weight: 700;
  }
  .adopt-thanks p {
    font-size: 0.9375rem;
    color: #374151;
    line-height: 1.55;
    margin-bottom: 22px;
  }
  .adopt-thanks-close {
    background: #0E4B2C;
    color: #fff;
    border: none;
    border-radius: 9999px;
    padding: 12px 28px;
    font-size: 0.9375rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.15s;
  }
  .adopt-thanks-close:hover { background: #0A3A20; }

  /* ─────────────────────────────────────────────
     Seção inline de doação (checkout direto)
     Tema branco + verde (--primary #02A95C)
  ───────────────────────────────────────────── */
  .inline-donate {
    background: #ffffff;
    padding: 2.5rem 1.25rem 3rem;
    text-align: center;
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    scroll-margin-top: 72px;
    transition: background 0.4s;
  }
  .inline-donate.highlight {
    background: var(--primary-soft);
  }
  .inline-donate-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--primary-darker);
    background: var(--primary-soft);
    padding: 0.375rem 0.875rem;
    border-radius: 999px;
    margin-bottom: 0.875rem;
  }
  .pulse-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--primary);
    box-shadow: 0 0 0 0 rgba(2,169,92,0.55);
    animation: pulse-dot 1.6s infinite;
  }
  @keyframes pulse-dot {
    0%   { box-shadow: 0 0 0 0 rgba(2,169,92,0.55); }
    70%  { box-shadow: 0 0 0 10px rgba(2,169,92,0);  }
    100% { box-shadow: 0 0 0 0 rgba(2,169,92,0);     }
  }
  .inline-donate-title {
    font-size: 1.875rem;
    font-weight: 900;
    letter-spacing: -0.02em;
    color: #111;
    margin: 0 0 0.5rem;
    line-height: 1.15;
  }
  .inline-donate-sub {
    font-size: 0.9375rem;
    color: #4b5563;
    line-height: 1.5;
    max-width: 500px;
    margin: 0 auto 1.75rem;
  }
  .inline-donate-sub strong { color: #111; font-weight: 700; }

  .inline-tier-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    max-width: 520px;
    margin: 0 auto 1rem;
  }
  .inline-tier {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.375rem;
    padding: 1.375rem 0.5rem 1.125rem;
    background: #fff;
    border: 2px solid #e5e7eb;
    border-radius: 14px;
    cursor: pointer;
    transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
    font-family: inherit;
    min-height: 130px;
  }
  .inline-tier:hover:not(:disabled) {
    border-color: var(--primary);
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(2,169,92,0.14);
  }
  .inline-tier:active:not(:disabled) { transform: translateY(0); }
  .inline-tier:disabled { opacity: 0.55; cursor: wait; }

  .inline-tier.popular {
    border-color: var(--primary);
    background: linear-gradient(180deg, #fff 0%, var(--primary-soft) 100%);
    box-shadow: 0 4px 14px rgba(2,169,92,0.18);
  }
  .inline-tier-badge {
    position: absolute;
    top: -10px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--primary);
    color: #fff;
    font-size: 0.6875rem;
    font-weight: 800;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding: 0.25rem 0.625rem;
    border-radius: 999px;
    white-space: nowrap;
    box-shadow: 0 2px 6px rgba(2,169,92,0.35);
  }
  .inline-tier-value {
    font-size: 1.625rem;
    font-weight: 900;
    color: var(--primary-darker);
    letter-spacing: -0.02em;
  }
  .inline-tier.popular .inline-tier-value { color: var(--primary-darker); }
  .inline-tier-label {
    font-size: 0.75rem;
    color: #6b7280;
    font-weight: 600;
    line-height: 1.3;
    padding: 0 0.25rem;
  }
  .inline-tier-cta {
    margin-top: 0.375rem;
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--primary-darker);
    letter-spacing: 0.02em;
  }
  .inline-tier-loading {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    margin-top: 0.375rem;
    font-size: 0.75rem;
    font-weight: 700;
    color: #6b7280;
  }
  .inline-tier-loading .spinner {
    width: 12px; height: 12px;
    border: 2px solid #e5e7eb;
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .inline-other-btn {
    display: inline-block;
    background: transparent;
    color: #374151;
    border: 1.5px solid #d1d5db;
    padding: 0.75rem 1.5rem;
    border-radius: 999px;
    font-family: inherit;
    font-size: 0.875rem;
    font-weight: 700;
    cursor: pointer;
    margin: 0.75rem 0 1.25rem;
    transition: border-color 0.15s, background 0.15s;
  }
  .inline-other-btn:hover:not(:disabled) {
    border-color: #374151;
    background: #f9fafb;
  }
  .inline-other-btn:disabled { opacity: 0.5; cursor: wait; }

  .inline-trust {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-top: 0.5rem;
    font-size: 0.75rem;
    color: #6b7280;
    font-weight: 600;
  }
  .inline-trust .trust-item {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }
  .inline-trust .trust-sep { color: #d1d5db; }

  /* Modal "Ander bedrag" */
  .sheet-tall { max-height: 85vh; }
  .other-amount-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 1rem;
    overflow-y: auto;
    max-height: 60vh;
    padding-right: 4px;
  }
  .other-amount-row {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 0.875rem 1rem;
    background: #fff;
    border: 1.5px solid #e5e7eb;
    border-radius: 12px;
    cursor: pointer;
    font-family: inherit;
    text-align: left;
    transition: border-color 0.15s, background 0.15s;
  }
  .other-amount-row:hover:not(:disabled) {
    border-color: var(--primary);
    background: var(--primary-soft);
  }
  .other-amount-row:disabled { opacity: 0.55; cursor: wait; }
  .other-amount-value {
    font-size: 1.25rem;
    font-weight: 900;
    color: var(--primary-darker);
    min-width: 68px;
    letter-spacing: -0.01em;
  }
  .amount-btn-value { color: var(--primary-darker); }
  .amount-btn.selected .amount-btn-value { color: #fff; }
  .other-amount-label {
    flex: 1;
    font-size: 0.875rem;
    color: #4b5563;
    font-weight: 600;
  }
  .other-amount-arrow {
    font-size: 1.125rem;
    color: var(--primary-darker);
    font-weight: 900;
  }

  /* Mobile ajuste */
  @media (max-width: 480px) {
    .inline-donate { padding: 2rem 1rem 2.5rem; }
    .inline-donate-title { font-size: 1.5rem; }
    .inline-tier { min-height: 118px; padding: 1.125rem 0.375rem 1rem; }
    .inline-tier-value { font-size: 1.375rem; }
    .inline-tier-badge { font-size: 0.625rem; padding: 0.2rem 0.5rem; }
  }
</style>
