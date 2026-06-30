<script lang="ts">
  import {
    ChevronRight, Calendar, Shield, Heart,
    Facebook, Youtube, Twitter, Instagram,
    Menu, X
  } from 'lucide-svelte';
  import { onMount, onDestroy } from 'svelte';
  import { goto, preloadData, preloadCode } from '$app/navigation';
  import ExitIntentPopup from '$lib/components/ExitIntentPopup.svelte';
  import ProgressCard from '$lib/components/ProgressCard.svelte';
  import StickyBottomBar from '$lib/components/StickyBottomBar.svelte';
  import {
    captureAndPersistFbclid, getFbp, getEid, trackEvent, uuid, buildShopifyCartUrl,
    type UtmData
  } from '$lib/utils/fbtracking';
  import { initTaboola, trackTaboola, getTblci } from '$lib/utils/taboola';
  import { initTikTok, trackTikTok, getTtclid, getTtp } from '$lib/utils/tiktok';
  import { getSid } from '$lib/utils/analytics';
  import {
    SHOPIFY_SHOP_DOMAIN, TIER_NAME_BY_AMOUNT, pickVariantForAmount
  } from '$lib/data/variants';
  import type { PageData } from './$types';

  const { data } = $props<{ data: PageData }>();
  // Doadores fakes da Lina (sobrescreve o feed global de doação animal)
  // Mistura de doadores reais (se houver) com nomes belgas/NL
  const LINA_DONORS = [
    { name: 'Sophie M.', amount: 50,  ago: 'zojuist',           initials: 'SM', color: 'av-green',  anonymous: false },
    { name: 'Lukas D.',  amount: 25,  ago: '4 min geleden',     initials: 'LD', color: 'av-teal',   anonymous: false },
    { name: 'Anoniem',   amount: 200, ago: '11 min geleden',    initials: '',   color: 'av-gray',   anonymous: true },
    { name: 'Marie V.',  amount: 100, ago: '23 min geleden',    initials: 'MV', color: 'av-coral',  anonymous: false },
    { name: 'Jan P.',    amount: 50,  ago: '38 min geleden',    initials: 'JP', color: 'av-amber',  anonymous: false },
    { name: 'Emma R.',   amount: 25,  ago: '55 min geleden',    initials: 'ER', color: 'av-purple', anonymous: false },
    { name: 'Bram H.',   amount: 75,  ago: '1 u geleden',       initials: 'BH', color: 'av-skyblue', anonymous: false },
    { name: 'Charlotte L.', amount: 100, ago: '2 u geleden',    initials: 'CL', color: 'av-rose',   anonymous: false },
    { name: 'Anoniem',   amount: 500, ago: '2 u geleden',       initials: '',   color: 'av-gray',   anonymous: true },
    { name: 'Niels V.',  amount: 35,  ago: '3 u geleden',       initials: 'NV', color: 'av-green',  anonymous: false },
    { name: 'Camille B.', amount: 50, ago: '4 u geleden',       initials: 'CB', color: 'av-teal',   anonymous: false },
    { name: 'Tom S.',    amount: 25,  ago: '5 u geleden',       initials: 'TS', color: 'av-coral',  anonymous: false },
    { name: 'Sarah K.',  amount: 200, ago: '7 u geleden',       initials: 'SK', color: 'av-amber',  anonymous: false },
    { name: 'Pieter J.', amount: 50,  ago: '9 u geleden',       initials: 'PJ', color: 'av-purple', anonymous: false },
    { name: 'Lieve B.',  amount: 35,  ago: '11 u geleden',      initials: 'LB', color: 'av-skyblue', anonymous: false },
    { name: 'Anoniem',   amount: 150, ago: '13 u geleden',      initials: '',   color: 'av-gray',   anonymous: true },
    { name: 'Eva D.',    amount: 25,  ago: '15 u geleden',      initials: 'ED', color: 'av-rose',   anonymous: false },
    { name: 'Vincent M.', amount: 100, ago: '18 u geleden',     initials: 'VM', color: 'av-green',  anonymous: false },
    { name: 'Anke V.',   amount: 50,  ago: '20 u geleden',      initials: 'AV', color: 'av-teal',   anonymous: false },
    { name: 'Mathieu R.', amount: 35, ago: '22 u geleden',      initials: 'MR', color: 'av-coral',  anonymous: false }
  ];

  // Testimonials reais sobre a Lina (sobrescreve CAMPAIGN.testimonials)
  const LINA_TESTIMONIALS = [
    {
      avatar: '/avatars/women-44.webp',
      name: 'Emma B.',
      city: 'Antwerpen',
      quote: "Mijn eigen dochter is 7 — net als Lina. Ik kon niet stoppen met huilen toen ik haar verhaal las. €50 gedoneerd, en deelde het meteen in mijn moedersgroep."
    },
    {
      avatar: '/avatars/men-32.webp',
      name: 'Niels V.',
      city: 'Gent',
      quote: 'UZ Gent is mijn ziekenhuis. Mijn nichtje werd daar geboren. Te weten dat een klein meisje daar nu vecht voor haar been — dat raakte me. €100 gedoneerd.'
    },
    {
      avatar: '/avatars/women-68.webp',
      name: 'Camille L.',
      city: 'Brussel',
      quote: 'Mijn man overleed vorig jaar aan kanker. Ik weet hoe het is om te wachten op een operatie die alles kan veranderen. Lina is nog zo klein. €200 voor haar.'
    },
    {
      avatar: '/avatars/women-12.webp',
      name: 'Lieve D.',
      city: 'Brugge',
      quote: "Ik zag de röntgenfoto en kon niet meer ademen. Mijn zoontje is ook 7. Dit had hij kunnen zijn. €75 gedoneerd, en ik kom morgen weer."
    },
    {
      avatar: '/avatars/men-76.webp',
      name: 'Mathieu R.',
      city: 'Luik',
      quote: 'Ik werk in de orthopedie. Wat Lina doormaakt is brutaal voor een kind. De prothese die ze nodig heeft is technisch hoogstaand maar duur. €100 gedoneerd, en heel veel kracht aan haar familie.'
    },
    {
      avatar: '/avatars/men-52.webp',
      name: 'Sven J.',
      city: 'Leuven',
      quote: "Mijn beste vriend verloor zijn dochter aan leukemie toen ze 9 was. Ik wist niet wat te zeggen toen. Nu wist ik het: doneren. €50 voor Lina, in herinnering aan kleine Saar."
    }
  ];

  const donorsList = $derived(LINA_DONORS);
  // Stats independentes do funil de doação animal — Lina é uma campanha separada
  const raisedEur = $derived(3247);
  const donationsCount = $derived(89);
  // Operatie urgente: 42 dagen (countdown a partir de 2026-06-30)
  const LINA_SURGERY_DATE = new Date('2026-08-11T00:00:00Z');
  const linaDaysLeft = Math.max(0, Math.ceil((LINA_SURGERY_DATE.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  const LINA_DAYS_LEFT = linaDaysLeft;

  // ──────────────────────────────────────────────────────────────
  // Campanha: LINA · 7 JAAR · OSTEOSARCOMA (BOTKANKER) IN HET RECHTERBEEN
  // ──────────────────────────────────────────────────────────────
  const LINA = {
    title: 'Lina is 7. Ze heeft 42 dagen om haar been te redden.',
    subtitle: 'Botkanker. Eén operatie. Eén kans.',
    storyPreview: [
      "Dit is Lina 🤍",
      "Drie weken geleden viel ze tijdens het buitenspelen. Een gewone val — dachten haar ouders. De arts maakte een röntgenfoto. En toen viel de wereld stil."
    ],
    storyRest: [
      "Osteosarcoma. Een agressieve bottumor in haar rechterdijbeen. Haar arts in UZ Gent zegt het zonder eromheen te draaien: zonder operatie binnen 42 dagen verspreidt de tumor zich naar haar longen. Met operatie + chemo + een pediatrische prothese is haar overlevingskans 78%.",
      "Haar ouders verkochten hun auto. Haar moeder werkt nachtdiensten. Haar vader (monteur in Gent) pakt extra shifts. Ze hebben €3.200 bij elkaar. De operatie + behandeling kost €12.450. Het ontbrekende bedrag is wat tussen Lina en haar volgende verjaardag staat.",
      "€25 dekt één dag pijnstilling. €100 helpt mee voor de scan vóór de operatie. €200 betaalt één chemo-sessie. Elke euro brengt haar dichter bij een toekomst waarin ze opnieuw kan rennen."
    ],
    highlight: 'De klok tikt. Help Lina vandaag — €12.450 voor haar operatie.',
    goalEur: 12450,
    shareTitle: 'Help Lina (7) haar been redden — botkanker, operatie binnen 42 dagen',
    shareUrl: 'https://belgianpawsfoundation.org/lina'
  };

  // Tiers humanos: copy NL pra doação pediátrica
  const TIERS = [
    { amount: 25,  label: '1 dag pijnstilling' },
    { amount: 50,  label: '1 week voeding tijdens chemo' },
    { amount: 100, label: 'Helpt mee voor de scan' },
    { amount: 200, label: 'Eén chemo-sessie' }
  ];
  const DEFAULT_TIER = 50;

  function labelForAmount(amount: number): string {
    const t = TIERS.find((x) => x.amount === amount);
    if (t) return t.label;
    if (amount >= 500) return 'Een hele behandelingsweek';
    if (amount >= 300) return 'Twee chemo-sessies';
    if (amount >= 80)  return 'Helpt mee voor de scan';
    if (amount >= 35)  return 'Een paar dagen voeding';
    return `€${amount} naar Lina's behandeling`;
  }

  // Estado de tracking
  let fbclid: string | null = $state(null);
  let fbc: string | null = $state(null);
  let fbp: string | null = $state(null);
  let utm: UtmData | null = $state(null);
  let tblci: string | null = $state(null);
  let ttclid: string | null = $state(null);
  let ttp: string | null = $state(null);

  let donorIdx = $state(0);
  let donorTimer: ReturnType<typeof setInterval> | null = null;
  const lastDonor = $derived(donorsList[donorIdx % donorsList.length]);

  onMount(() => {
    const tracking = captureAndPersistFbclid();
    fbclid = tracking.fbclid;
    fbc = tracking.fbc;
    utm = tracking.utm;
    setTimeout(() => { fbp = getFbp(); }, 500);

    initTaboola();
    tblci = getTblci();

    initTikTok();
    ttclid = getTtclid();
    setTimeout(() => { ttp = getTtp(); }, 500);

    preloadCode('/donate').catch(() => {});
    setTimeout(() => { preloadData('/donate').catch(() => {}); }, 1200);

    donorTimer = setInterval(() => {
      donorIdx = (donorIdx + 1) % donorsList.length;
    }, 4200);

    if (typeof history !== 'undefined') {
      history.pushState({ pawsBackGuard: true }, '', window.location.pathname + window.location.search);
      const handlePopState = () => {
        window.removeEventListener('popstate', handlePopState);
        history.pushState({ pawsBackGuard: true }, '', window.location.pathname + window.location.search);
        exitPopupVsl?.triggerBackExit();
      };
      window.addEventListener('popstate', handlePopState);
    }
  });

  onDestroy(() => {
    if (donorTimer) clearInterval(donorTimer);
  });

  let exitPopupVsl: ReturnType<typeof ExitIntentPopup> | null = $state(null);

  function scrollToDonors() {
    const el = document.getElementById('donations');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  let descExpanded = $state(false);
  let donationOpen = $state(false);
  let shareOpen = $state(false);
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
        adoptError = data.error === 'invalid email' ? 'Ongeldig e-mailadres.' : 'Er ging iets mis. Probeer opnieuw.';
      } else {
        adoptName = '';
        adoptCity = '';
        adoptEmail = '';
        adoptThanksOpen = true;
      }
    } catch {
      adoptError = 'Verbinding mislukt. Probeer opnieuw.';
    } finally {
      adoptSubmitting = false;
    }
  }

  const MENU_ITEMS = [
    { id: 'story-section', label: 'Verhaal' },
    { id: 'testimonials-section', label: 'Supporters' },
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
    goto('/donate');
  }

  function selectAmount(amount: number) {
    selectedAmount = amount;
    setTimeout(() => {
      currentStep = 2;
    }, 200);
  }

  function handleDonate() {
    donating = true;

    const eventId = uuid();
    const contentId = `lina-${selectedAmount}`;

    // Meta + Taboola + TikTok IC com content_id especifico de Lina pra atribuicao limpa
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
          tblci,
          ttclid,
          ttp,
          eid: getEid()
        });
      }
    }, 800);
  }

  function shareTo(target: 'whatsapp' | 'facebook' | 'copy') {
    const text = `${LINA.shareTitle} ${LINA.shareUrl}`;
    if (target === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    } else if (target === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(LINA.shareUrl)}`, '_blank');
    } else {
      navigator.clipboard?.writeText(LINA.shareUrl).then(() => {
        showToast('Link gekopieerd!');
        shareOpen = false;
      });
    }
  }
</script>

<svelte:head>
  <title>{LINA.title}</title>
  <meta name="description" content={LINA.subtitle} />
</svelte:head>

<header class="header">
  <a href="/" class="header-logo">
    <img src="/logo.webp" alt="Officiële Donaties België" class="logo-img" />
    <span class="header-flag" aria-hidden="true">🇧🇪</span>
  </a>
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
    <nav class="header-menu-dropdown" aria-label="Sitenavigatie">
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
    <!-- Hero image: split foto Lina + raio-x femur -->
    <div class="hero-image-wrap" data-section="hero-image">
      <img
        class="hero-image hero-slide-active"
        src="/lina/hero.jpg"
        alt={LINA.title}
        loading="eager"
        fetchpriority="high"
        decoding="async"
        width="900"
        height="600"
      />
    </div>

    <!-- Bloco principal -->
    <section class="hero-block" data-section="hero-block">
      <h1 class="campaign-title">{LINA.title}</h1>

      <div id="progress-anchor">
        <ProgressCard
          raised={raisedEur}
          goal={LINA.goalEur}
          lastDonorName={lastDonor.anonymous ? 'Anoniem' : lastDonor.name}
          lastDonorAmount={lastDonor.amount}
          lastDonorAgo={lastDonor.ago}
          onDonate={openDonation}
          onShare={() => (shareOpen = true)}
          onDonorsClick={scrollToDonors}
        />
      </div>

      <div class="progress-stats-row">
        <span><span class="donations-count">{donationsCount}</span> donaties</span>
        <span>{LINA_DAYS_LEFT} dagen voor Lina's operatie</span>
      </div>

      <div id="story-section" data-section="story" class="story-text">
        {#each LINA.storyPreview as paragraph}
          <p>{paragraph}</p>
        {/each}
        {#if descExpanded}
          {#each LINA.storyRest as paragraph}
            <p>{paragraph}</p>
          {/each}
        {/if}
      </div>
      <button class="read-more" onclick={() => (descExpanded = !descExpanded)}>
        {descExpanded ? 'Minder lezen' : 'Meer lezen'}
      </button>
    </section>

    {#if descExpanded}
      <section class="section">
        <span class="story-highlight">{LINA.highlight}</span>
      </section>
    {/if}

    <!-- Testimonials -->
    <section class="section" id="testimonials-section" data-section="testimonials">
      <div class="section-eyebrow">Steunbetuigingen</div>
      <h2 class="section-title">Van supporters in heel België.</h2>
      <div class="testimonial-row">
        {#each LINA_TESTIMONIALS as t}
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

    <!-- Berichtje voor Lina (mantém form que captura email pro update) -->
    <section class="section adopt-section" id="berichtje-lina">
      <div class="section-eyebrow">Stuur haar kracht</div>
      <h2 class="section-title">Schrijf een berichtje voor Lina</h2>
      <p class="adopt-intro">Haar ouders printen elk bericht en plakken het in haar kamer. Laat je gegevens achter — we sturen je later een update over hoe het met haar gaat.</p>

      {#if !adoptFormOpen}
        <button type="button" class="adopt-cta" onclick={openAdoptForm}>
          <span class="adopt-cta-icon" aria-hidden="true">🤍</span>
          <span>Schrijf een berichtje voor Lina</span>
        </button>
      {:else}
        <form class="adopt-form" onsubmit={submitAdoption} novalidate>
          <label class="adopt-field">
            <span>Jouw naam</span>
            <input type="text" bind:value={adoptName} placeholder="Voornaam" autocomplete="given-name" required />
          </label>
          <label class="adopt-field">
            <span>Stad</span>
            <input type="text" bind:value={adoptCity} placeholder="Bijv. Antwerpen" autocomplete="address-level2" required />
          </label>
          <label class="adopt-field">
            <span>E-mail (voor de update)</span>
            <input type="email" bind:value={adoptEmail} placeholder="naam@email.be" autocomplete="email" required />
          </label>

          {#if adoptError}
            <div class="adopt-error">{adoptError}</div>
          {/if}

          <button type="submit" class="adopt-submit" disabled={adoptSubmitting}>
            {#if adoptSubmitting}
              <span class="spinner spinner-dark"></span>
              <span>Versturen…</span>
            {:else}
              Verstuur berichtje
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
        <button class="donations-link" onclick={() => (donorsModalOpen = true)}>Alles bekijken</button>
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
        <div class="organizer-avatar">BC</div>
        <div style="flex:1;min-width:0">
          <div class="organizer-name">Belgian Care Foundation</div>
          <div class="organizer-sub">Organisator</div>
          <div class="organizer-sub">Gent, België</div>
        </div>
      </div>

      <div class="campaign-extras">
        <div class="campaign-extras-row">
          <Calendar size={14} />
          Juni 2026 ·
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

      <div class="footer-copy">© 2026 Belgian Care Foundation</div>

      <div class="footer-links">
        <a href="#">Voorwaarden</a>
        <a href="#">Privacy</a>
        <a href="#">Terugbetalingen</a>
        <a href="#">Cookies</a>
        <a href="mailto:contact@belgiancare.online">Contact</a>
      </div>
    </footer>
  </div>
</div>

<!-- Sticky bottom bar -->
<StickyBottomBar
  raised={raisedEur}
  goal={LINA.goalEur}
  lastDonorName={lastDonor.anonymous ? 'Anoniem' : lastDonor.name}
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
  aria-label="Donatie"
  onclick={(e) => e.target === e.currentTarget && (donationOpen = false)}
>
  <div class="sheet" role="document">
    <div class="sheet-handle"></div>
    <div class="sheet-title">
      {currentStep === 1 ? 'Doneer voor Lina' : 'Bevestig je donatie'}
    </div>
    {#if currentStep === 1}
      <p class="sheet-subtitle">Elke euro gaat rechtstreeks naar Lina's operatie, chemo en pediatrische prothese.</p>
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
              class:popular={tier.amount === 50}
              onclick={() => selectAmount(tier.amount)}
            >
              {#if tier.amount === 50}
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
          <div class="step-label">Jouw donatie</div>
          <div class="confirm-amount">€{selectedAmount}</div>
          <p class="confirm-sub">{labelForAmount(selectedAmount)}.</p>

          <p class="confirm-direct-note">
            Jouw donatie gaat rechtstreeks naar Lina's operatie, chemo en de pediatrische prothese in UZ Gent.
          </p>

          <button class="btn-bancontact" onclick={handleDonate} disabled={donating}>
            {#if donating}
              <div class="spinner spinner-dark"></div>
              <span class="btn-bancontact-text">Doorverwijzen…</span>
            {:else}
              <img src="/bancontact.webp" alt="Bancontact" class="btn-bancontact-logo" />
              <span class="btn-bancontact-text">Doe €{selectedAmount} met Bancontact</span>
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
    <p class="sheet-subtitle">Laatste supporters die Belgische opvangcentra helpen.</p>
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
    <p>Je berichtje is verstuurd naar Lina's ouders. We sturen je een update zodra haar operatie gepland is — meestal binnen <strong>één week</strong>.</p>
    <button class="adopt-thanks-close" onclick={() => (adoptThanksOpen = false)}>Sluiten</button>
  </div>
{/if}

<!-- Exit intent popup -->
<ExitIntentPopup bind:this={exitPopupVsl} onDonate={openDonation} onBack={() => goto('/wacht')} />

<style>
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
</style>
