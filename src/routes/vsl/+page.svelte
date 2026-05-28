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
  import {
    captureAndPersistFbclid, getFbp, trackEvent, uuid, buildShopifyCartUrl,
    type UtmData
  } from '$lib/utils/fbtracking';

  // Configuracao do destino Shopify — produto real complete-care-package-for-belgian-dogs
  // 4 variants reais mapeadas por tier (Bronze/Silver/Gold/Platinum)
  const SHOPIFY_SHOP_DOMAIN = 'inigualavelshop.myshopify.com';
  const VARIANT_BY_TIER: Record<number, string> = {
    10: '49461830844554', // Bronze  — BPCB-BRONZE
    20: '49461830877322', // Silver  — BPCB-SILVER
    25: '49461830910090', // Gold    — BPCB-GOLD
    35: '49461830942858'  // Platinum — BPCB-PLATINUM
  };
  const TIER_NAME_BY_AMOUNT: Record<number, string> = {
    10: 'Bronze',
    20: 'Silver',
    25: 'Gold',
    35: 'Platinum'
  };

  // Estado de tracking Meta (preenchido no onMount, usado no handleDonate)
  let fbclid: string | null = $state(null);
  let fbc: string | null = $state(null);
  let fbp: string | null = $state(null);
  let utm: UtmData | null = $state(null);

  // Rotacao do "ultimo doador" no ProgressCard e StickyBottomBar — cycle a cada 4.2s
  let donorIdx = $state(0);
  let donorTimer: ReturnType<typeof setInterval> | null = null;
  const lastDonor = $derived(CAMPAIGN.donors[donorIdx % CAMPAIGN.donors.length]);

  onMount(() => {
    // Captura fbclid + UTMs reais da URL (anuncio Meta) ou recupera do storage
    const tracking = captureAndPersistFbclid();
    fbclid = tracking.fbclid;
    fbc = tracking.fbc;
    utm = tracking.utm;
    // fbp e setado pelo Pixel JS via cookie — le com pequeno delay pro Pixel inicializar
    setTimeout(() => { fbp = getFbp(); }, 500);

    donorTimer = setInterval(() => {
      donorIdx = (donorIdx + 1) % CAMPAIGN.donors.length;
    }, 4200);
  });

  onDestroy(() => {
    if (donorTimer) clearInterval(donorTimer);
  });

  function scrollToDonors() {
    const el = document.getElementById('donations');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // VSL player
  const VSL_URL = 'https://belgianpaws-vsl.vercel.app/vsl.mp4'; // substituir após upload
  let videoEl: HTMLVideoElement | null = $state(null);
  let audioEnabled = $state(false);

  function enableAudio() {
    if (!videoEl) return;
    videoEl.muted = false;
    videoEl.currentTime = 0;
    videoEl.play().catch(() => {});
    audioEnabled = true;
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
    const variantId = VARIANT_BY_TIER[selectedAmount];
    const isPlaceholder = !variantId || variantId.startsWith('PLACEHOLDER');
    const tierName = TIER_NAME_BY_AMOUNT[selectedAmount] || String(selectedAmount);

    // 4. Eventos GA4 — disparados ANTES do redirect pro checkout
    if (typeof window !== 'undefined' && (window as any).gtag) {
      // Evento custom — clique no botao de doar
      (window as any).gtag('event', 'click_donate', {
        tier: tierName,
        value: selectedAmount,
        currency: 'EUR',
        variant_id: variantId
      });

      // Evento padrao GA4 e-commerce — inicio de checkout
      (window as any).gtag('event', 'begin_checkout', {
        currency: 'EUR',
        value: selectedAmount,
        items: [{
          item_id: variantId,
          item_name: 'Belgian Paws Care Bundle',
          item_variant: tierName,
          price: selectedAmount,
          quantity: 1
        }]
      });
    }

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
          utm
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
    <!-- VSL player -->
    <div class="vsl-wrap">
      <video
        bind:this={videoEl}
        src={VSL_URL}
        autoplay
        muted
        playsinline
        preload="auto"
        class="vsl-video"
      ></video>

      {#if !audioEnabled}
        <button class="vsl-overlay" onclick={enableAudio} aria-label="Klik om te horen">
          <div class="vsl-play-circle">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
              <polygon points="6,4 20,12 6,20" />
            </svg>
          </div>
          <span class="vsl-click-label">Klik om te horen</span>
        </button>
      {/if}
    </div>

    <!-- Bloco principal: titulo + progress card + descricao curta -->
    <section class="hero-block">
      <h1 class="campaign-title">{CAMPAIGN.title}</h1>

      <div id="progress-anchor">
        <ProgressCard
          raised={CAMPAIGN.raisedEur}
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
        <span><span class="donations-count">{CAMPAIGN.donationsCount}</span> donaties</span>
        <span>{CAMPAIGN.daysLeft} dagen over</span>
      </div>

      <div id="story-section" class="story-text" class:story-text-collapsed={!descExpanded}>
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
    <section class="section" id="testimonials-section">
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
    <section class="urgency">
      <div class="urgency-eyebrow">Tijd telt</div>
      <h2 class="urgency-title">Vanavond wachten er dieren.</h2>
      <p class="urgency-sub">Jij kan er nu eentje voeden.</p>
      <button class="urgency-cta" onclick={openDonation}>
        Help ze voeden
        <ChevronRight size={18} strokeWidth={2.5} />
      </button>
    </section>

    <!-- Donors list (preview com 5; botao abre modal com lista completa) -->
    <div class="donations" id="donations">
      <div class="donations-header">
        <div class="donations-title">
          Donaties
          <span class="donations-badge">{CAMPAIGN.donationsCount}</span>
        </div>
        <button class="donations-link" onclick={() => (donorsModalOpen = true)}>Alles bekijken</button>
      </div>
      <ul class="donor-list">
        {#each CAMPAIGN.donors.slice(0, 5) as d}
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
        Bekijk alle {CAMPAIGN.donors.length}+ donaties
      </button>
    </div>

    <!-- Organizer -->
    <div class="organizer" id="organizer-section">
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

<!-- Sticky bottom bar (aparece quando o card principal sai da viewport) -->
<StickyBottomBar
  raised={CAMPAIGN.raisedEur}
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
              onclick={() => selectAmount(tier.amount)}
            >
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
    <div class="sheet-title">Alle donaties ({CAMPAIGN.donationsCount})</div>
    <p class="sheet-subtitle">Laatste supporters die Belgische opvangcentra helpen.</p>
    <ul class="donor-list donor-list-full">
      {#each CAMPAIGN.donors as d}
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
