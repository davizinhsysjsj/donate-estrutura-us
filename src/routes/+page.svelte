<script lang="ts">
  import {
    ChevronRight, Calendar, Shield, Heart,
    Facebook, Youtube, Twitter, Instagram,
    Menu, X
  } from 'lucide-svelte';
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { CAMPAIGN } from '$lib/data/campaign';
  import { TIERS, DEFAULT_TIER, dogsForAmount } from '$lib/data/tiers';
  import ProgressCard from '$lib/components/ProgressCard.svelte';
  import StickyBottomBar from '$lib/components/StickyBottomBar.svelte';
  import ExitIntentPopup from '$lib/components/ExitIntentPopup.svelte';
  import {
    captureAndPersistFbclid, getFbp, trackEvent, uuid, buildShopifyCartUrl,
    type UtmData
  } from '$lib/utils/fbtracking';
  import { getSid } from '$lib/utils/analytics';
  import {
    SHOPIFY_SHOP_DOMAIN, TIER_NAME_BY_AMOUNT, pickVariantForAmount
  } from '$lib/data/variants';
  import type { PageData } from './$types';

  // Layout server retorna `donors` mesclado (reais 24h primeiro + fakes completando)
  // e também stats dinâmicos da campanha (raisedEur, donationsCount)
  const { data } = $props<{ data: PageData }>();
  const donorsList = $derived(data.donors);
  const raisedEur = $derived(data.raisedEur ?? CAMPAIGN.raisedEur);
  const donationsCount = $derived(data.donationsCount ?? CAMPAIGN.donationsCount);
  const daysLeft = $derived(data.daysLeft ?? CAMPAIGN.daysLeft);

  // Estado de tracking Meta (preenchido no onMount, usado no handleDonate)
  let fbclid: string | null = $state(null);
  let fbc: string | null = $state(null);
  let fbp: string | null = $state(null);
  let utm: UtmData | null = $state(null);

  // Personalização por UTM: copy diferente para visitantes vindos do Facebook
  let utmSource = $state<string | null>(null);
  const isFbTraffic = $derived(utmSource === 'facebook' || utmSource === 'fb');
  const heroTitle = $derived(isFbTraffic
    ? 'Jij zag dit op Facebook — nu kun je echt helpen'
    : CAMPAIGN.title);
  const heroSubtitle = $derived(isFbTraffic
    ? 'Duizenden mensen deelden dit verhaal. Jouw donatie van €10 voedt vanavond 2 dieren.'
    : CAMPAIGN.subtitle);

  // Rotacao do "ultimo doador" no ProgressCard e StickyBottomBar — cycle a cada 4.2s
  let donorIdx = $state(0);
  let donorTimer: ReturnType<typeof setInterval> | null = null;
  const lastDonor = $derived(donorsList[donorIdx % donorsList.length]);

  onMount(() => {
    // Captura fbclid + UTMs reais da URL (anuncio Meta) ou recupera do storage
    const tracking = captureAndPersistFbclid();
    fbclid = tracking.fbclid;
    fbc = tracking.fbc;
    utm = tracking.utm;
    utmSource = tracking.utm?.utm_source ?? null;
    // fbp e setado pelo Pixel JS via cookie — le com pequeno delay pro Pixel inicializar
    setTimeout(() => { fbp = getFbp(); }, 500);

    donorTimer = setInterval(() => {
      donorIdx = (donorIdx + 1) % donorsList.length;
    }, 4200);
  });

  onDestroy(() => {
    if (donorTimer) clearInterval(donorTimer);
  });

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
    // Analytics: rastreia CTA antes de navegar
    import('$lib/utils/analytics').then((m) => m.track('cta_click', { from: 'lp' })).catch(() => {});
    // Redireciona para a página de seleção de valor (novo fluxo)
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

    // 1. Gera event_id pra dedup com Omega CAPI server-side
    const eventId = uuid();

    // 2. Dispara InitiateCheckout no Pixel client-side
    trackEvent('InitiateCheckout', {
      value: selectedAmount,
      currency: 'EUR',
      content_ids: [String(selectedAmount)],
      content_type: 'product',
      num_items: 1
    }, eventId);

    // 3. Decide destino: Shopify real (se variant ID preenchido) ou fallback /supporter
    //    Sorteia entre as variantes disponiveis pro tier (rotacao multi-produto)
    const variantId = pickVariantForAmount(selectedAmount);
    const isPlaceholder = !variantId || variantId.startsWith('PLACEHOLDER');
    const tierName = TIER_NAME_BY_AMOUNT[selectedAmount] || String(selectedAmount);

    // GA4 removido — apenas Vitrack (analytics interno) + Meta CAPI + UTMify continuam ativos

    setTimeout(() => {
      if (isPlaceholder) {
        // Modo dev: ainda nao temos produto Shopify criado, cai no mock
        window.location.href = `/supporter?tier=${selectedAmount}&event_id=${eventId}`;
      } else {
        // Modo prod: redireciona pra Shopify com attributes + UTMs reais do anuncio
        window.location.href = buildShopifyCartUrl({
          shopDomain: SHOPIFY_SHOP_DOMAIN,
          variantId,
          fbclid,
          fbp,
          eventId,
          utm,
          sid: getSid()
        });
      }
    }, 800);
  }

  function shareTo(target: 'whatsapp' | 'facebook' | 'copy') {
    const text = `${CAMPAIGN.shareTitle} ${CAMPAIGN.shareUrl}`;
    if (target === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    } else if (target === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(CAMPAIGN.shareUrl)}`, '_blank');
    } else {
      navigator.clipboard?.writeText(CAMPAIGN.shareUrl).then(() => {
        showToast('Link gekopieerd!');
        shareOpen = false;
      });
    }
  }

</script>

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
    <!-- Hero full-width com curva inferior -->
    <div class="hero-image-wrap" data-section="hero-image">
      {#if CAMPAIGN.heroImage}
        <img class="hero-image" src={CAMPAIGN.heroImage} alt={CAMPAIGN.title} loading="eager" fetchpriority="high" decoding="async" width="900" height="600" />
      {:else}
        <div class="hero-image img-placeholder">
          <div class="img-placeholder-stack">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <circle cx="9" cy="11" r="2" />
              <path d="m21 17-5-5-9 9" />
            </svg>
            <span class="img-placeholder-label">Foto komt binnenkort</span>
          </div>
        </div>
      {/if}
    </div>

    <!-- Bloco principal: titulo + progress card + descricao curta -->
    <section class="hero-block" data-section="hero-block">
      <h1 class="campaign-title">{heroTitle}</h1>
      {#if isFbTraffic}
        <p class="campaign-subtitle-fb">{heroSubtitle}</p>
      {/if}

      <div id="progress-anchor">
        <ProgressCard
          raised={raisedEur}
          goal={CAMPAIGN.goalEur}
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
        <span>{daysLeft} dagen over</span>
      </div>

      <div id="story-section" data-section="story" class="story-text" class:story-text-collapsed={!descExpanded}>
        {#each CAMPAIGN.story as paragraph}
          <p>{paragraph}</p>
        {/each}
      </div>
      <button class="read-more" onclick={() => (descExpanded = !descExpanded)}>
        {descExpanded ? 'Minder lezen' : 'Meer lezen'}
      </button>
    </section>

    {#if descExpanded}
      <section class="section">
        <span class="story-highlight">{CAMPAIGN.highlight}</span>
      </section>
    {/if}


    <!-- Words of support / testimonials -->
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

    <!-- Urgency block -->
    <section class="urgency" data-section="urgency-cta">
      <div class="urgency-eyebrow">Tijd telt</div>
      <h2 class="urgency-title">Vanavond wachten er dieren.</h2>
      <p class="urgency-sub">Jij kan er nu eentje voeden.</p>
      <button class="urgency-cta" onclick={openDonation}>
        Help ze voeden
        <ChevronRight size={18} strokeWidth={2.5} />
      </button>
    </section>

    <!-- Donors list (preview com 5; botao abre modal com lista completa) -->
    <div class="donations" id="donations" data-section="donations-list">
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
    <div class="organizer" id="organizer-section" data-section="organizer">
      <h3>Organisator</h3>
      <div class="organizer-row">
        <div class="organizer-avatar">
          {CAMPAIGN.organizer.split(' ').map((s) => s[0]).join('').slice(0, 2)}
        </div>
        <div style="flex:1;min-width:0">
          <div class="organizer-name">{CAMPAIGN.organizer}</div>
          <div class="organizer-sub">Organisator</div>
          <div class="organizer-sub">{CAMPAIGN.organizerCity}</div>
        </div>
      </div>
      <button class="btn-contact">Contact</button>

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
      <!-- Trust badges -->
      <div class="footer-trust">
        <div class="trust-badge">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Beveiligde betaling
        </div>
        <div class="trust-badge">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          SSL versleuteld
        </div>
        <div class="trust-badge">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
          88% gaat naar dieren
        </div>
        <div class="trust-badge">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          {donationsCount}+ donateurs
        </div>
      </div>

      <div class="footer-social">
        <a href="#" aria-label="Facebook"><Facebook size={20} /></a>
        <a href="#" aria-label="YouTube"><Youtube size={20} /></a>
        <a href="#" aria-label="Twitter"><Twitter size={20} /></a>
        <a href="#" aria-label="Instagram"><Instagram size={20} /></a>
      </div>

      <div class="footer-copy">© 2026 {CAMPAIGN.brand} Opvang</div>

      <div class="footer-links">
        <a href="/over">Over ons</a>
        <a href="/updates">Updates</a>
        <a href="#">Voorwaarden</a>
        <a href="#">Privacy</a>
        <a href="mailto:contact@belgianpaws.help">Contact</a>
      </div>
    </footer>
  </div>
</div>

<!-- Sticky bottom bar (aparece quando o card principal sai da viewport) -->
<StickyBottomBar
  raised={raisedEur}
  goal={CAMPAIGN.goalEur}
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
      {currentStep === 1 ? 'Doe een donatie' : 'Bevestig je donatie'}
    </div>
    {#if currentStep === 1}
      <p class="sheet-subtitle">Elke donatie voedt opvangdieren in onze Belgische partneropvangen.</p>
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
              <span class="amount-btn-sub">voedt {tier.dogs} {tier.dogs === 1 ? 'dier' : 'dieren'}</span>
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
          <p class="confirm-sub">Vandaag red je {dogsForAmount(selectedAmount)} {dogsForAmount(selectedAmount) === 1 ? 'dier' : 'dieren'}.</p>

          <p class="confirm-direct-note">
            Jouw donatie gaat rechtstreeks naar de voeding en verzorging van geredde dieren bij onze partneropvangen in België.
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

<!-- Exit intent popup (desktop: cursor sai pelo topo após 8s) -->
<ExitIntentPopup onDonate={openDonation} />
