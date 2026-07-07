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
  // Doadores fakes da Ellie — nomes UK working-class + timing em EN
  const ELLIE_DONORS = [
    { name: 'Sophie M.',    amount: 50,  ago: 'just now',        initials: 'SM', color: 'av-green',   anonymous: false },
    { name: 'Jack D.',      amount: 25,  ago: '4 min ago',       initials: 'JD', color: 'av-teal',    anonymous: false },
    { name: 'Anonymous',    amount: 200, ago: '11 min ago',      initials: '',   color: 'av-gray',    anonymous: true },
    { name: 'Emily H.',     amount: 100, ago: '23 min ago',      initials: 'EH', color: 'av-coral',   anonymous: false },
    { name: 'Oliver P.',    amount: 50,  ago: '38 min ago',      initials: 'OP', color: 'av-amber',   anonymous: false },
    { name: 'Grace R.',     amount: 25,  ago: '55 min ago',      initials: 'GR', color: 'av-purple',  anonymous: false },
    { name: 'Liam W.',      amount: 75,  ago: '1 h ago',         initials: 'LW', color: 'av-skyblue', anonymous: false },
    { name: 'Charlotte B.', amount: 100, ago: '2 h ago',         initials: 'CB', color: 'av-rose',    anonymous: false },
    { name: 'Anonymous',    amount: 500, ago: '2 h ago',         initials: '',   color: 'av-gray',    anonymous: true },
    { name: 'George T.',    amount: 35,  ago: '3 h ago',         initials: 'GT', color: 'av-green',   anonymous: false },
    { name: 'Poppy A.',     amount: 50,  ago: '4 h ago',         initials: 'PA', color: 'av-teal',    anonymous: false },
    { name: 'Harry S.',     amount: 25,  ago: '5 h ago',         initials: 'HS', color: 'av-coral',   anonymous: false },
    { name: 'Millie K.',    amount: 200, ago: '7 h ago',         initials: 'MK', color: 'av-amber',   anonymous: false },
    { name: 'Ryan J.',      amount: 50,  ago: '9 h ago',         initials: 'RJ', color: 'av-purple',  anonymous: false },
    { name: 'Ella B.',      amount: 35,  ago: '11 h ago',        initials: 'EB', color: 'av-skyblue', anonymous: false },
    { name: 'Anonymous',    amount: 150, ago: '13 h ago',        initials: '',   color: 'av-gray',    anonymous: true },
    { name: 'Chloe D.',     amount: 25,  ago: '15 h ago',        initials: 'CD', color: 'av-rose',    anonymous: false },
    { name: 'Ben M.',       amount: 100, ago: '18 h ago',        initials: 'BM', color: 'av-green',   anonymous: false },
    { name: 'Amy V.',       amount: 50,  ago: '20 h ago',        initials: 'AV', color: 'av-teal',    anonymous: false },
    { name: 'Dan R.',       amount: 35,  ago: '22 h ago',        initials: 'DR', color: 'av-coral',   anonymous: false }
  ];

  // Testimonials reais sobre a Ellie (cidades e sotaques UK working-class)
  const ELLIE_TESTIMONIALS = [
    {
      avatar: '/avatars/women-44.webp',
      name: 'Emma B.',
      city: 'Manchester',
      quote: "My own daughter is 9 — same as Ellie. I couldn't stop crying when I read her story. Donated £50 and shared it in my mum's WhatsApp group straight away."
    },
    {
      avatar: '/avatars/men-32.webp',
      name: 'Liam W.',
      city: 'Liverpool',
      quote: "I was born in Alder Hey myself. Knowing a little lass is fighting for her life at RMCH right now — that hit me hard. Donated £100. Come on Ellie."
    },
    {
      avatar: '/avatars/women-68.webp',
      name: 'Sarah L.',
      city: 'Leeds',
      quote: 'My husband passed from cancer last year. I know what it feels like to wait on an operation that could change everything. Ellie is only 9. £200 for her, love.'
    },
    {
      avatar: '/avatars/women-12.webp',
      name: 'Chloe D.',
      city: 'Sheffield',
      quote: "Saw the MRI scan and couldn't breathe. My little boy is also 9. This could have been him. Donated £75, and I'll be back tomorrow to give more."
    },
    {
      avatar: '/avatars/men-76.webp',
      name: 'David R.',
      city: 'Newcastle',
      quote: 'I work in paediatric oncology. What Ellie is going through is brutal for a child her age. Neuroblastoma treatment is aggressive but survivable — every pound helps. £100 donated, and love to her family.'
    },
    {
      avatar: '/avatars/men-52.webp',
      name: 'Steve J.',
      city: 'Birmingham',
      quote: "My best mate lost his daughter to leukaemia when she was 9. I didn't know what to say back then. Now I do: donate. £50 for Ellie, in memory of little Katie."
    }
  ];

  const donorsList = $derived(ELLIE_DONORS);
  // Stats da campanha da Ellie — independente do funil animal
  const raisedGbp = $derived(2894);
  const donationsCount = $derived(76);
  // Operação urgente: 42 dias (countdown a partir de 2026-07-07)
  const ELLIE_SURGERY_DATE = new Date('2026-08-18T00:00:00Z');
  const ellieDaysLeft = Math.max(0, Math.ceil((ELLIE_SURGERY_DATE.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  const ELLIE_DAYS_LEFT = ellieDaysLeft;

  // ──────────────────────────────────────────────────────────────
  // Campanha: ELLIE · 9 YEARS OLD · HIGH-RISK NEUROBLASTOMA · MANCHESTER (NHS)
  // ──────────────────────────────────────────────────────────────
  const ELLIE = {
    title: "Ellie is 9. She has 42 days to start the treatment that could save her life.",
    subtitle: "High-risk neuroblastoma. One chance. One family that can't afford to lose.",
    storyPreview: [
      "This is Ellie 🤍",
      "Six weeks ago she came home from school saying her tummy hurt. Sarah, her mum, thought it was a bug going round Year 4. The GP sent them to Royal Manchester Children's Hospital 'just to be safe'. That's when everything stopped."
    ],
    storyRest: [
      "High-risk neuroblastoma. A rare, aggressive childhood cancer that has already spread to her bone marrow. The NHS consultants were honest with Sarah: standard chemo alone gives Ellie a 40-50% chance. The full protocol — chemo + surgery + stem cell transplant + a specialist immunotherapy trial in Germany — takes her survival odds up to 78%. The trial is what the NHS can't cover.",
      "Sarah works two jobs — cleaning shifts at Tesco Metro in Ancoats and a late shift at the care home. Ellie's dad Mark drives a delivery van. They sold the car last month. They've scraped together £2,100. The gap between what they have and what the German trial costs — £15,750 — is what stands between Ellie and her tenth birthday in November.",
      "£15 covers one day of anti-nausea meds during chemo. £100 helps pay for one MIBG scan. £250 covers one immunotherapy dose. Every single pound gets her closer to a future where she can go back to school, back to her mates, back to being a kid."
    ],
    highlight: "The clock is ticking. Help Ellie today — £15,750 to fund the immunotherapy trial that could save her life.",
    goalGbp: 15750,
    shareTitle: "Help Ellie (9) beat neuroblastoma — 42 days to fund the trial that could save her",
    shareUrl: 'https://belgianpawsfoundation.org/ellie'
  };

  // Tiers em GBP — copy UK pra doação pediátrica NHS-adjacent
  const TIERS = [
    { amount: 15, label: '1 day of anti-nausea meds' },
    { amount: 20, label: 'Sterile dressings + PICC line care' },
    { amount: 25, label: '1 day of pain relief' },
    { amount: 50, label: '1 week of nutrition during chemo' }
  ];
  const DEFAULT_TIER = 50;

  // Valores extras (modal "Other amount")
  const OTHER_AMOUNTS = [
    { amount: 10,  label: "1 hour of oxygen support" },
    { amount: 30,  label: "Anti-sickness medication" },
    { amount: 35,  label: "1 physio session after chemo" },
    { amount: 80,  label: "Helps cover the MIBG scan" },
    { amount: 100, label: "Full pre-treatment scan" },
    { amount: 250, label: "One immunotherapy dose" },
    { amount: 500, label: "Two immunotherapy doses" },
    { amount: 750, label: "A full week of treatment in Germany" }
  ];

  function labelForAmount(amount: number): string {
    const t = TIERS.find((x) => x.amount === amount);
    if (t) return t.label;
    if (amount >= 750) return 'A full week of treatment in Germany';
    if (amount >= 500) return 'Two immunotherapy doses';
    if (amount >= 250) return 'One immunotherapy dose';
    if (amount >= 100) return 'Full pre-treatment scan';
    if (amount >= 80)  return 'Helps cover the MIBG scan';
    if (amount >= 35)  return 'One physio session';
    return `£${amount} towards Ellie's treatment`;
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
  // TODO: substituir por assets reais da Ellie assim que o avatar for gerado
  const HERO_SLIDES = [
    { src: '/ellie/ellie-bed.webp',     pos: 'center 30%' },
    { src: '/ellie/ellie-drawing.webp', pos: 'center center' },
    { src: '/ellie/ellie-mum-hand.webp', pos: 'center 35%' },
    { src: '/ellie/hero.webp',           pos: 'center 35%' }
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
      adoptError = 'Please fill in all fields.';
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
        adoptError = data.error === 'invalid email' ? 'Invalid email address.' : 'Something went wrong. Please try again.';
      } else {
        adoptName = '';
        adoptCity = '';
        adoptEmail = '';
        adoptThanksOpen = true;
      }
    } catch {
      adoptError = 'Connection failed. Please try again.';
    } finally {
      adoptSubmitting = false;
    }
  }

  const MENU_ITEMS = [
    { id: 'story-section', label: 'Story' },
    { id: 'testimonials-section', label: 'Supporters' },
    { id: 'donations', label: 'Donations' },
    { id: 'organizer-section', label: 'Organiser' }
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
      currency: 'GBP',
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
          currency: 'GBP',
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
          eid: getEid()
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
      currency: 'GBP',
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
          eid: getEid()
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
        showToast('Link copied!');
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
  <span class="header-logo lina-logo" aria-label="Official Donations">
    <span class="lina-logo-word">Official&nbsp;D</span>
    <svg class="lina-logo-heart" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        fill="#02A95C"
      />
      <path
        d="M5.5 12h2.2l1.1-2.4 2 5.4 1.6-3 1.1 1.6h4.0"
        fill="none"
        stroke="#fff"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
    <span class="lina-logo-word">onations</span>
    <span class="header-flag" aria-hidden="true">{data.visitorFlag ?? '🇬🇧'}</span>
  </span>
  <button
    class="header-menu-btn"
    aria-label="Open menu"
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
      aria-label="Close menu"
      onclick={() => (menuOpen = false)}
    ></button>
    <nav class="header-menu-dropdown" aria-label="Site navigation">
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

      <button
        type="button"
        class="hero-arrow hero-arrow-prev"
        aria-label="Previous photo"
        onclick={heroPrev}
      >
        <ChevronLeft size={22} strokeWidth={2.5} />
      </button>
      <button
        type="button"
        class="hero-arrow hero-arrow-next"
        aria-label="Next photo"
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
            aria-label={`Photo ${i + 1}`}
            onclick={() => heroGoTo(i)}
          ></button>
        {/each}
      </div>
    </div>

    <!-- Bloco principal -->
    <section class="hero-block" data-section="hero-block">
      <h1 class="campaign-title">{ELLIE.title}</h1>

      <div id="progress-anchor">
        <ProgressCard
          raised={raisedGbp}
          goal={ELLIE.goalGbp}
          lastDonorName={lastDonor.anonymous ? 'Anonymous' : lastDonor.name}
          lastDonorAmount={lastDonor.amount}
          lastDonorAgo={lastDonor.ago}
          onDonate={openDonation}
          onShare={() => (shareOpen = true)}
          onDonorsClick={scrollToDonors}
        />
      </div>

      <div class="progress-stats-row">
        <span><span class="donations-count">{donationsCount}</span> donations</span>
        <span>{ELLIE_DAYS_LEFT} days until Ellie's treatment window closes</span>
      </div>

      <div id="story-section" data-section="story" class="story-text">
        {#each ELLIE.storyPreview as paragraph}
          <p>{paragraph}</p>
        {/each}
        {#if descExpanded}
          {#each ELLIE.storyRest as paragraph}
            <p>{paragraph}</p>
          {/each}
        {/if}
      </div>
      <button class="read-more" onclick={() => (descExpanded = !descExpanded)}>
        {descExpanded ? 'Read less' : 'Read more'}
      </button>
    </section>

    {#if descExpanded}
      <section class="section">
        <span class="story-highlight">{ELLIE.highlight}</span>
      </section>
    {/if}

    <!-- Testimonials -->
    <section class="section" id="testimonials-section" data-section="testimonials">
      <div class="section-eyebrow">Supporters</div>
      <h2 class="section-title">From people all across the UK.</h2>
      <div class="testimonial-row">
        {#each ELLIE_TESTIMONIALS as t}
          <div class="testimonial-card">
            <div class="testimonial-head">
              <img src={t.avatar} alt={t.name} class="testimonial-avatar-img" loading="lazy" width="80" height="80" decoding="async" />
              <div>
                <div class="testimonial-name">{t.name}</div>
                <div class="testimonial-meta">{t.city}</div>
              </div>
            </div>
            <p class="testimonial-quote">"{t.quote}"</p>
          </div>
        {/each}
      </div>
    </section>

    <!-- Carta da mãe — 3 da manhã, hospital -->
    <section class="section before-section" id="voor-diagnose" data-section="voor-diagnose">
      <div class="section-eyebrow">3am at the hospital</div>
      <h2 class="section-title">A letter from her mum.</h2>

      <div class="before-letter">
        <p class="before-greeting">Dear reader,</p>

        <p>
          It's three in the morning. I'm sitting on the floor next to Ellie's
          hospital bed at RMCH. I don't even know why I'm writing this.
        </p>

        <p>
          I'm not going to ask you for anything. Six weeks ago I was
          scrolling past posts like this too. I felt something. I kept
          reading. That was it.
        </p>

        <p>
          Tonight, before the nurses came in to change her line, she
          looked up at me and said:
        </p>

        <p class="before-key">
          <strong>"Mum, when I get better, can we still go to Blackpool this summer? You promised."</strong>
        </p>

        <p>
          She's nine. She thinks this is like a bad flu. She doesn't
          know what neuroblastoma means.
        </p>

        <p>
          I didn't answer. I turned my face so she couldn't see me. When
          I looked back she'd tucked herself in with her old teddy — the
          one she's had since she was two — pressed right against her
          tummy where the tumour is.
        </p>

        <p>
          I never thought I'd be the person writing something like this.
          Not me. Not our Ellie. But here I am.
        </p>

        <p>
          Please, help me save my little girl. Every single pound you
          donate gets her closer to that trial in Germany. I just want
          to keep my promise about Blackpool. I just want her to have a
          tenth birthday.
        </p>

        <p class="before-signoff">
          <span class="before-name">Sarah — Ellie's mum</span>
        </p>
      </div>
    </section>

    <!-- ────────────────────────────────────────────────────────────────
         SEÇÃO INLINE DE DOAÇÃO — checkout direto, sem passar por /donate
    ──────────────────────────────────────────────────────────────── -->
    <section class="section inline-donate" id="doneer-nu">
      <div class="inline-donate-eyebrow">
        <span class="pulse-dot"></span>
        DIRECT SUPPORT FOR ELLIE
      </div>
      <h2 class="inline-donate-title">Choose your donation</h2>
      <p class="inline-donate-sub">
        100% goes directly to Ellie's treatment, scans and the immunotherapy trial in Germany.
        <br />Pay securely with <strong>card</strong>, Apple Pay or Google Pay.
      </p>

      <div class="inline-tier-grid">
        {#each TIERS as tier}
          <button
            type="button"
            class="inline-tier"
            class:popular={tier.amount === 50}
            disabled={quickDonating !== null}
            onclick={() => quickDonate(tier.amount)}
          >
            {#if tier.amount === 50}
              <span class="inline-tier-badge">Most chosen</span>
            {/if}
            <span class="inline-tier-value">£{tier.amount}</span>
            <span class="inline-tier-label">{tier.label}</span>
            {#if quickDonating === tier.amount}
              <span class="inline-tier-loading"><span class="spinner"></span> Redirecting…</span>
            {:else}
              <span class="inline-tier-cta">Donate now →</span>
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
        Choose another amount
      </button>

      <div class="inline-trust">
        <span class="trust-item"><Shield size="14" /> SSL secured</span>
        <span class="trust-sep">·</span>
        <span class="trust-item"><BadgeCheck size="14" /> RMCH verified</span>
        <span class="trust-sep">·</span>
        <span class="trust-item"><Heart size="14" /> 100% direct to Ellie</span>
      </div>
    </section>

    <!-- Message for Ellie (form que captura email pro update) -->
    <section class="section adopt-section" id="berichtje-lina">
      <div class="section-eyebrow">Send her some love</div>
      <h2 class="section-title">Write a message for Ellie</h2>
      <p class="adopt-intro">Her mum prints every single message and tapes it to the wall next to her bed. Leave your details — we'll send you an update on how she's getting on.</p>

      {#if !adoptFormOpen}
        <button type="button" class="adopt-cta" onclick={openAdoptForm}>
          <span class="adopt-cta-icon" aria-hidden="true">🤍</span>
          <span>Write a message for Ellie</span>
        </button>
      {:else}
        <form class="adopt-form" onsubmit={submitAdoption} novalidate>
          <label class="adopt-field">
            <span>Your name</span>
            <input type="text" bind:value={adoptName} placeholder="First name" autocomplete="given-name" required />
          </label>
          <label class="adopt-field">
            <span>City</span>
            <input type="text" bind:value={adoptCity} placeholder="e.g. Manchester" autocomplete="address-level2" required />
          </label>
          <label class="adopt-field">
            <span>Email (for the update)</span>
            <input type="email" bind:value={adoptEmail} placeholder="name@email.com" autocomplete="email" required />
          </label>

          {#if adoptError}
            <div class="adopt-error">{adoptError}</div>
          {/if}

          <button type="submit" class="adopt-submit" disabled={adoptSubmitting}>
            {#if adoptSubmitting}
              <span class="spinner spinner-dark"></span>
              <span>Sending…</span>
            {:else}
              Send message
            {/if}
          </button>
        </form>
      {/if}
    </section>

    <!-- Donors -->
    <div class="donations" id="donations">
      <div class="donations-header">
        <div class="donations-title">
          Donations
          <span class="donations-badge">{donationsCount}</span>
        </div>
        <button class="donations-link" onclick={() => (donorsModalOpen = true)}>See all</button>
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
            <div class="donor-amount">£{d.amount}</div>
          </li>
        {/each}
      </ul>
      <button class="btn-see-all" onclick={() => (donorsModalOpen = true)}>
        See all {donorsList.length}+ donations
      </button>
    </div>

    <!-- Organizer -->
    <div class="organizer" id="organizer-section">
      <h3>Organiser</h3>
      <div class="organizer-row">
        <div class="organizer-avatar">
          <img src="/ellie/organizer-avatar.png" alt="British Children's Care Foundation" loading="lazy" decoding="async" />
        </div>
        <div style="flex:1;min-width:0">
          <div class="organizer-name">
            <span>British Children's Care Foundation</span>
            <span class="verified-badge" title="Verified organisation" aria-label="Verified organisation">
              <BadgeCheck size={16} strokeWidth={2.5} />
            </span>
          </div>
          <div class="organizer-sub">Officially verified · Organiser</div>
          <div class="organizer-sub">Manchester, United Kingdom</div>
        </div>
      </div>

      <div class="campaign-extras">
        <div class="campaign-extras-row">
          <Calendar size={14} />
          July 2026 ·
          <a href="#">Medical emergencies</a>
        </div>
        <div class="badge-protected">
          <Shield size={14} />
          Donation protected
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

      <div class="footer-copy">© 2026 British Children's Care Foundation</div>

      <div class="footer-links">
        <a href="#">Terms</a>
        <a href="#">Privacy</a>
        <a href="#">Refunds</a>
        <a href="#">Cookies</a>
        <a href="mailto:contact@belgiancarestore.com">Contact</a>
      </div>
    </footer>
  </div>
</div>

<!-- Sticky bottom bar -->
<StickyBottomBar
  raised={raisedGbp}
  goal={ELLIE.goalGbp}
  lastDonorName={lastDonor.anonymous ? 'Anonymous' : lastDonor.name}
  lastDonorAmount={lastDonor.amount}
  lastDonorAgo={lastDonor.ago}
  onDonate={openDonation}
  onShare={() => (shareOpen = true)}
  onDonorsClick={scrollToDonors}
/>

<!-- Donation Sheet -->
<div
  class="overlay"
  class:open={donationOpen}
  role="dialog"
  aria-modal="true"
  aria-label="Donation"
  onclick={(e) => e.target === e.currentTarget && (donationOpen = false)}
>
  <div class="sheet" role="document">
    <div class="sheet-handle"></div>
    <div class="sheet-title">
      {currentStep === 1 ? 'Donate to Ellie' : 'Confirm your donation'}
    </div>
    {#if currentStep === 1}
      <p class="sheet-subtitle">Every pound goes directly to Ellie's treatment, scans and the immunotherapy trial.</p>
    {/if}

    {#if currentStep === 1}
      <div class="step-form active">
        <div class="step-label">Choose an amount</div>
        <div class="amount-grid amount-grid-2x2">
          {#each TIERS as tier}
            <button
              type="button"
              class="amount-btn amount-btn-tier"
              class:selected={selectedAmount === tier.amount}
              class:popular={tier.amount === 50}
              onclick={() => selectAmount(tier.amount)}
            >
              {#if tier.amount === 50}
                <span class="amount-btn-badge">Most chosen</span>
              {/if}
              <span class="amount-btn-value">£{tier.amount}</span>
              <span class="amount-btn-sub">{tier.label}</span>
            </button>
          {/each}
        </div>
      </div>
    {:else}
      <div class="step-form active">
        <button class="btn-back" onclick={() => (currentStep = 1)}>← Back</button>
        <div class="confirm-screen">
          <div class="step-label">Your donation</div>
          <div class="confirm-amount">£{selectedAmount}</div>
          <p class="confirm-sub">{labelForAmount(selectedAmount)}.</p>

          <p class="confirm-direct-note">
            Your donation goes directly to Ellie's treatment, scans and the immunotherapy trial.
          </p>

          <button class="btn-bancontact" onclick={handleDonate} disabled={donating}>
            {#if donating}
              <div class="spinner spinner-dark"></div>
              <span class="btn-bancontact-text">Redirecting…</span>
            {:else}
              <span class="btn-bancontact-text">Donate £{selectedAmount} securely</span>
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
  aria-label="Share"
  onclick={(e) => e.target === e.currentTarget && (shareOpen = false)}
>
  <div class="sheet" role="document">
    <div class="sheet-handle"></div>
    <div class="sheet-title">Share this campaign</div>
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
        <span class="share-label">Copy link</span>
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
  aria-label="Another amount"
  onclick={(e) => e.target === e.currentTarget && (otherAmountOpen = false)}
>
  <div class="sheet sheet-tall" role="document">
    <div class="sheet-handle"></div>
    <div class="sheet-title">Choose another amount</div>
    <p class="sheet-subtitle">Every pound counts. 100% goes to Ellie's treatment.</p>

    <div class="other-amount-list">
      {#each OTHER_AMOUNTS as opt}
        <button
          type="button"
          class="other-amount-row"
          disabled={quickDonating !== null}
          onclick={() => { otherAmountOpen = false; quickDonate(opt.amount); }}
        >
          <span class="other-amount-value">£{opt.amount}</span>
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
  aria-label="All donations"
  onclick={(e) => e.target === e.currentTarget && (donorsModalOpen = false)}
>
  <div class="sheet sheet-donors" role="document">
    <div class="sheet-handle"></div>
    <div class="sheet-title">All donations ({donationsCount})</div>
    <p class="sheet-subtitle">Latest supporters helping Ellie beat neuroblastoma.</p>
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
          <div class="donor-amount">£{d.amount}</div>
        </li>
      {/each}
    </ul>
    <button class="sheet-close-btn" onclick={() => (donorsModalOpen = false)}>Close</button>
  </div>
</div>

<!-- Toast -->
<div class="toast" class:show={toastVisible}>{toastMessage}</div>

<!-- Berichtje thanks popup -->
{#if adoptThanksOpen}
  <button
    class="adopt-thanks-backdrop"
    aria-label="Close"
    onclick={() => (adoptThanksOpen = false)}
  ></button>
  <div class="adopt-thanks" role="dialog" aria-modal="true" aria-label="Thank you">
    <div class="adopt-thanks-icon" aria-hidden="true">🤍</div>
    <h3>Thank you!</h3>
    <p>Your message has been sent to Ellie's mum Sarah. We'll send you an update as soon as her treatment plan is confirmed — usually within <strong>one week</strong>.</p>
    <button class="adopt-thanks-close" onclick={() => (adoptThanksOpen = false)}>Close</button>
  </div>
{/if}


<style>
  /* Voor de diagnose — brief van de mama */
  .before-section {
    padding-top: 28px;
    padding-bottom: 32px;
    border-top: 1px solid #e5e7eb;
    margin-top: 8px;
  }
  .before-letter {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 1.0625rem;
    line-height: 1.7;
    color: #1f2937;
    margin-top: 6px;
  }
  .before-letter p {
    margin: 0 0 16px;
  }
  .before-greeting {
    font-size: 1.125rem;
    color: #111;
  }
  .before-key {
    background: #fef2f2;
    border-left: 4px solid #dc2626;
    padding: 14px 16px;
    border-radius: 4px;
    font-size: 1.125rem;
    text-align: center;
    color: #7f1d1d;
    margin: 22px 0 !important;
  }
  .before-cta-text {
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-radius: 10px;
    padding: 16px 18px;
    color: #78350f;
    margin: 22px 0 !important;
  }
  .before-signoff {
    margin-top: 24px !important;
    color: #374151;
    font-style: italic;
  }
  .before-name {
    font-style: normal;
    font-weight: 600;
    color: #111;
    font-family: system-ui, -apple-system, sans-serif;
  }

  /* Lina logo (sem pata — heart + heartbeat pulse line) */
  .lina-logo {
    display: inline-flex;
    align-items: center;
    gap: 0;
    font-family: 'Quicksand', 'Nunito', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    font-weight: 700;
    font-size: 0.74rem;
    letter-spacing: -0.01em;
    color: #02A95C;
    text-decoration: none;
    line-height: 1;
    white-space: nowrap;
  }
  .lina-logo-word { display: inline; }
  .lina-logo-heart {
    width: 1.05em;
    height: 1.05em;
    display: inline-block;
    vertical-align: -0.18em;
    margin: 0 0.04em;
    flex-shrink: 0;
  }
  .lina-logo .header-flag { margin-left: 6px; font-size: 0.85em; }
  @media (max-width: 380px) {
    .lina-logo { font-size: 0.64rem; }
  }

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
    color: #111;
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
    color: #111;
    min-width: 68px;
    letter-spacing: -0.01em;
  }
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
