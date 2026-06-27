<script lang="ts">
  import {
    ChevronRight, Calendar, Shield, Heart,
    Facebook, Youtube, Twitter, Instagram,
    Menu, X
  } from 'lucide-svelte';
  import { onMount, onDestroy } from 'svelte';
  import { goto, preloadData, preloadCode } from '$app/navigation';
  import ExitIntentPopup from '$lib/components/ExitIntentPopup.svelte';
  import { CAMPAIGN } from '$lib/data/campaign';
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
  const donorsList = $derived(data.donors);
  const raisedEur = $derived(data.raisedEur ?? 2157);
  const donationsCount = $derived(data.donationsCount ?? 412);
  const daysLeft = $derived(data.daysLeft ?? 21);

  // ──────────────────────────────────────────────────────────────
  // Campanha PIF (Feline Infectious Peritonitis) + behandeling GS-441524
  // Tot 2019: 100% dodelijk. Vandaag: geneesmiddel met 89% slagingspercentage.
  // ──────────────────────────────────────────────────────────────
  const KATTEN = {
    title: 'Tot 2019 was PIF een doodvonnis. Vandaag bestaat er een geneesmiddel.',
    subtitle: 'Shadow heeft 48 uur om de eerste injectie te krijgen.',
    storyPreview: [
      "Dit is Shadow 🖤",
      "Toen zijn baasje overleed, bleef Shadow alleen achter — met zijn neus tegen de tralies, wachtend op iemand die nooit terugkwam. 487 dagen later begonnen de eerste symptomen: koorts die niet wegging, opgezette buik, geen eetlust meer."
    ],
    storyRest: [
      "Bloedonderzoek en PCR bevestigden de diagnose: <strong>Feliene Infectieuze Peritonitis (FIP)</strong>. Tot 2019 was dit een zeker doodvonnis — 100% van de besmette katten stierf binnen 4 tot 8 weken.",
      "Maar in 2019 ontdekten onderzoekers aan UC Davis een geneesmiddel: <strong>GS-441524</strong>. Een antiviraal middel dat PIF geneest in 84 dagen. Slagingspercentage: <strong>89%</strong>. Sinds 2024 officieel goedgekeurd in België.",
      "Shadow heeft 48 uur om de eerste injectie te krijgen. De volledige behandeling kost <strong>€850</strong> — en is al gepland voor donderdag bij Dr. Janssens (Kliniek Vossen, Antwerpen). Het enige wat ontbreekt: jouw bijdrage om de behandeling te bevestigen."
    ],
    highlight: 'PIF heeft een geneesmiddel. Shadow heeft 48 uur. Behandeling: €850.',
    goalEur: 850,
    shareTitle: 'PIF was een doodvonnis. Vandaag bestaat er een geneesmiddel — help Shadow.',
    shareUrl: 'https://belgianpawshelter.help/pif'
  };

  // Tiers especificos pra gatos: copy NL "X katten redden"
  const TIERS = [
    { amount: 10, cats: 2 },
    { amount: 25, cats: 5 },
    { amount: 40, cats: 8 },
    { amount: 100, cats: 20 }
  ];
  const DEFAULT_TIER = 25;

  function catsForAmount(amount: number): number {
    const t = TIERS.find((x) => x.amount === amount);
    if (t) return t.cats;
    return Math.max(1, Math.round(amount / 5));
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
    const contentId = `cat-${selectedAmount}`;

    // Meta + Taboola + TikTok IC com content_id especifico de gato pra distinguir do funil de cachorro
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
    const text = `${KATTEN.shareTitle} ${KATTEN.shareUrl}`;
    if (target === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    } else if (target === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(KATTEN.shareUrl)}`, '_blank');
    } else {
      navigator.clipboard?.writeText(KATTEN.shareUrl).then(() => {
        showToast('Link gekopieerd!');
        shareOpen = false;
      });
    }
  }
</script>

<svelte:head>
  <title>{KATTEN.title}</title>
  <meta name="description" content={KATTEN.subtitle} />
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
    <!-- Hero image -->
    <div class="hero-image-wrap" data-section="hero-image">
      <img
        class="hero-image hero-slide-active"
        src="/pif/hero.jpg"
        alt={KATTEN.title}
        loading="eager"
        fetchpriority="high"
        decoding="async"
        width="900"
        height="600"
      />
    </div>

    <!-- Banner urgente: PIF agora TEM CURA — angulo de esperança -->
    <div class="pif-urgent-banner" role="status">
      <span class="pif-urgent-badge">URGENT</span>
      <p class="pif-urgent-text">
        Tot 2019 was PIF een doodvonnis. Vandaag bestaat er een <strong>geneesmiddel met 89% slagingspercentage</strong>. Shadow heeft <strong>48 uur</strong>.
      </p>
    </div>

    <!-- Bloco principal -->
    <section class="hero-block" data-section="hero-block">
      <h1 class="campaign-title">{KATTEN.title}</h1>

      <div id="progress-anchor">
        <ProgressCard
          raised={raisedEur}
          goal={KATTEN.goalEur}
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
        <span>8 dagen voor Shadow</span>
      </div>

      <div id="story-section" data-section="story" class="story-text">
        {#each KATTEN.storyPreview as paragraph}
          <p>{paragraph}</p>
        {/each}
        {#if descExpanded}
          {#each KATTEN.storyRest as paragraph}
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
        <span class="story-highlight">{KATTEN.highlight}</span>
      </section>
    {/if}

    <!-- Verklaring Dr. Janssens — bevestiging diagnose + prognose 89% -->
    <section class="section pif-verklaring" data-section="verklaring">
      <div class="section-eyebrow">Medische bevestiging</div>
      <h2 class="section-title">Verklaring van Dr. Janssens</h2>
      <p class="pif-verklaring-intro">Officieel diagnoserapport en behandelplan van de behandelend dierenarts.</p>
      <div class="pif-verklaring-grid">
        <figure class="pif-diagnostic">
          <img
            src="/pif/diagnostic.jpg"
            alt="Bloedonderzoek en PCR-resultaat: FIPV positief"
            loading="lazy"
            width="600"
            height="600"
          />
          <figcaption>Bloedonderzoek & PCR — Kliniek Vossen, Antwerpen</figcaption>
        </figure>
        <article class="pif-letter">
          <header class="pif-letter-head">
            <div class="pif-letter-clinic">KLINIEK VOSSEN</div>
            <div class="pif-letter-meta">Veterinaire Diagnostiek · Antwerpen · 26-06-2026</div>
          </header>
          <p>
            Hierbij verklaar ik dat <strong>Shadow</strong> (Felis catus, 4 jaar) gediagnosticeerd is met <strong>Feliene Infectieuze Peritonitis (FIP)</strong>, bevestigd via bloedonderzoek en PCR-test op 26 juni 2026.
          </p>
          <p>
            Tot 2019 was deze ziekte een zeker doodvonnis — 100% sterfte binnen 4 tot 8 weken. Sinds de ontdekking van het antivirale middel <strong>GS-441524</strong> aan UC Davis (Californië), is genezing mogelijk geworden. De behandeling duurt 84 dagen met dagelijkse injecties.
          </p>
          <p class="pif-prognose">
            <strong>Prognose na behandeling: 89% volledig herstel.</strong> Shadow zal binnen 14 dagen weer normaal eten, en binnen 12 weken volledig gezond zijn. Verwachte levensduur na herstel: <strong>12 tot 16 jaar</strong>.
          </p>
          <p>
            De behandeling is bevestigd voor <strong>donderdag 3 juli 2026</strong>. Totale kosten: <strong>€850</strong>. Zonder bevestiging vóór die datum vervalt de planning en blijft alleen palliatieve zorg over.
          </p>
          <footer class="pif-letter-sign">
            <span class="pif-letter-name">— Dr. Lukas Janssens</span>
            <span class="pif-letter-reg">KMVD #47842 · Kliniek Vossen, Antwerpen</span>
          </footer>
        </article>
      </div>
    </section>

    <!-- Testimonials -->
    <section class="section" id="testimonials-section" data-section="testimonials">
      <div class="section-eyebrow">Steunbetuigingen</div>
      <h2 class="section-title">Van supporters in heel België.</h2>
      <div class="testimonial-row">
        {#each CAMPAIGN.testimonials as t}
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

    <!-- Adoption form -->
    <section class="section adopt-section" id="adopt-shadow">
      <div class="section-eyebrow">Geef hem een thuis</div>
      <h2 class="section-title">Adopteer Shadow</h2>
      <p class="adopt-intro">Wil jij Shadow een veilige plek geven na zijn behandeling? Laat je gegevens achter — wij nemen binnen 24 uur contact met je op.</p>

      {#if !adoptFormOpen}
        <button type="button" class="adopt-cta" onclick={openAdoptForm}>
          <span class="adopt-cta-icon" aria-hidden="true">🐾</span>
          <span>Ik wil Shadow adopteren</span>
        </button>
      {:else}
        <form class="adopt-form" onsubmit={submitAdoption} novalidate>
          <label class="adopt-field">
            <span>Naam</span>
            <input type="text" bind:value={adoptName} placeholder="Jouw volledige naam" autocomplete="name" required />
          </label>
          <label class="adopt-field">
            <span>Stad</span>
            <input type="text" bind:value={adoptCity} placeholder="Bijv. Antwerpen" autocomplete="address-level2" required />
          </label>
          <label class="adopt-field">
            <span>E-mail</span>
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
              Verstuur
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
        <div class="organizer-avatar">
          {#if CAMPAIGN.organizerImage}
            <img src={CAMPAIGN.organizerImage} alt={CAMPAIGN.organizer} loading="lazy" />
          {:else}
            {CAMPAIGN.organizer.split(' ').map((s) => s[0]).join('').slice(0, 2)}
          {/if}
        </div>
        <div style="flex:1;min-width:0">
          <div class="organizer-name">{CAMPAIGN.organizer}</div>
          <div class="organizer-sub">Organisator</div>
          <div class="organizer-sub">{CAMPAIGN.organizerCity}</div>
        </div>
      </div>

      <div class="campaign-extras">
        <div class="campaign-extras-row">
          <Calendar size={14} />
          {CAMPAIGN.createdMonth} ·
          <a href="#">{CAMPAIGN.category}</a>
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

      <div class="footer-copy">© 2026 {CAMPAIGN.brand} Opvang</div>

      <div class="footer-links">
        <a href="#">Voorwaarden</a>
        <a href="#">Privacy</a>
        <a href="#">Terugbetalingen</a>
        <a href="#">Cookies</a>
        <a href="mailto:hello@pawsco.com">Contact</a>
      </div>
    </footer>
  </div>
</div>

<!-- Sticky bottom bar -->
<StickyBottomBar
  raised={raisedEur}
  goal={KATTEN.goalEur}
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
      {currentStep === 1 ? 'Doneer voor Shadow' : 'Bevestig je donatie'}
    </div>
    {#if currentStep === 1}
      <p class="sheet-subtitle">Elke euro gaat rechtstreeks naar Shadow's PIF-behandeling (GS-441524) en eten voor de andere katten.</p>
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
              class:popular={tier.amount === 25}
              onclick={() => selectAmount(tier.amount)}
            >
              {#if tier.amount === 25}
                <span class="amount-btn-badge">Meest gekozen</span>
              {/if}
              <span class="amount-btn-value">€{tier.amount}</span>
              <span class="amount-btn-sub">voedt {tier.cats} {tier.cats === 1 ? 'kat' : 'katten'}</span>
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
          <p class="confirm-sub">Vandaag red je {catsForAmount(selectedAmount)} {catsForAmount(selectedAmount) === 1 ? 'kat' : 'katten'}.</p>

          <p class="confirm-direct-note">
            Jouw donatie gaat rechtstreeks naar Shadow's PIF-behandeling met GS-441524 en de zorg voor andere opvangkatten in België.
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

<!-- Adoption thanks popup -->
{#if adoptThanksOpen}
  <button
    class="adopt-thanks-backdrop"
    aria-label="Sluiten"
    onclick={() => (adoptThanksOpen = false)}
  ></button>
  <div class="adopt-thanks" role="dialog" aria-modal="true" aria-label="Bedankt">
    <div class="adopt-thanks-icon" aria-hidden="true">🐾</div>
    <h3>Bedankt!</h3>
    <p>We hebben jouw aanvraag ontvangen. Het team van Belgian Paws Shelter neemt binnen <strong>24 uur</strong> contact met je op om de volgende stappen te bespreken.</p>
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

  /* ══════════════════════════════════════════════════════════════
     PIF — Banner urgência (esperança + 48u) e Verklaring vet
     ══════════════════════════════════════════════════════════════ */
  .pif-urgent-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    background: linear-gradient(135deg, #02a95c 0%, #0a3a20 100%);
    color: #fff;
    padding: 14px 16px;
    border-radius: 12px;
    margin: 14px 0 8px;
    box-shadow: 0 4px 14px rgba(2, 169, 92, 0.25);
  }
  .pif-urgent-badge {
    flex-shrink: 0;
    background: #fff;
    color: #02a95c;
    font-size: 0.6875rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    padding: 4px 10px;
    border-radius: 999px;
  }
  .pif-urgent-text {
    margin: 0;
    font-size: 0.9375rem;
    line-height: 1.4;
    color: #fff;
  }
  .pif-urgent-text strong { color: #fff; font-weight: 700; }

  .pif-verklaring { padding-top: 8px; padding-bottom: 16px; }
  .pif-verklaring-intro {
    margin: 0 0 16px;
    color: #6b7280;
    font-size: 0.9375rem;
  }
  .pif-verklaring-grid {
    display: grid;
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
    gap: 24px;
    align-items: start;
  }
  .pif-diagnostic {
    margin: 0;
  }
  .pif-diagnostic img {
    width: 100%;
    height: auto;
    border-radius: 12px;
    border: 1px solid #e5e7eb;
    box-shadow: 0 6px 20px rgba(0,0,0,0.08);
    display: block;
  }
  .pif-diagnostic figcaption {
    margin-top: 8px;
    font-size: 0.75rem;
    color: #6b7280;
    text-align: center;
  }
  .pif-letter {
    background: #fafafa;
    border: 1px solid #e5e7eb;
    border-left: 4px solid #02a95c;
    border-radius: 10px;
    padding: 20px 22px;
    font-size: 0.9375rem;
    line-height: 1.55;
    color: #1f2937;
  }
  .pif-letter p { margin: 0 0 12px; }
  .pif-letter p:last-of-type { margin-bottom: 16px; }
  .pif-letter strong { color: #02a95c; font-weight: 700; }
  .pif-letter-head {
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 12px;
    margin-bottom: 14px;
  }
  .pif-letter-clinic {
    font-weight: 800;
    letter-spacing: 0.04em;
    color: #02a95c;
    font-size: 0.875rem;
  }
  .pif-letter-meta {
    font-size: 0.75rem;
    color: #6b7280;
    margin-top: 2px;
  }
  .pif-prognose {
    background: #effaf3;
    border-radius: 8px;
    padding: 10px 14px;
    border-left: 3px solid #02a95c;
  }
  .pif-letter-sign {
    display: flex;
    flex-direction: column;
    border-top: 1px dashed #e5e7eb;
    padding-top: 12px;
  }
  .pif-letter-name {
    font-weight: 700;
    color: #1f2937;
    font-style: italic;
  }
  .pif-letter-reg {
    font-size: 0.75rem;
    color: #6b7280;
    margin-top: 2px;
  }

  @media (max-width: 768px) {
    .pif-verklaring-grid { grid-template-columns: 1fr; gap: 18px; }
    .pif-urgent-banner { flex-direction: column; align-items: flex-start; }
    .pif-urgent-text { font-size: 0.875rem; }
  }
</style>
