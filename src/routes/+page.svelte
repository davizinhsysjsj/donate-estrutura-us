<script lang="ts">
  import {
    ChevronRight, Calendar, Shield, Heart, Mail,
    Facebook, Youtube, Twitter, Instagram, ArrowRight,
    Menu, X
  } from 'lucide-svelte';
  import { onMount, onDestroy } from 'svelte';
  import { CAMPAIGN } from '$lib/data/campaign';
  import { TIERS, DEFAULT_TIER, dogsForAmount } from '$lib/data/tiers';
  import ProgressCard from '$lib/components/ProgressCard.svelte';
  import StickyBottomBar from '$lib/components/StickyBottomBar.svelte';
  import {
    captureAndPersistFbclid, getFbp, trackEvent, uuid, buildShopifyCartUrl
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

  // Rotacao do "ultimo doador" no ProgressCard e StickyBottomBar — cycle a cada 4.2s
  let donorIdx = $state(0);
  let donorTimer: ReturnType<typeof setInterval> | null = null;
  const lastDonor = $derived(CAMPAIGN.donors[donorIdx % CAMPAIGN.donors.length]);

  onMount(() => {
    // Captura fbclid da URL (anuncio Meta) ou recupera do storage
    const tracking = captureAndPersistFbclid();
    fbclid = tracking.fbclid;
    fbc = tracking.fbc;
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
    { id: 'story-section', label: 'Story' },
    { id: 'stats-section', label: 'The numbers' },
    { id: 'how-section', label: 'How it works' },
    { id: 'testimonials-section', label: 'Supporters' },
    { id: 'donations', label: 'Donations' },
    { id: 'organizer-section', label: 'Organizer' }
  ];

  function scrollToSection(id: string) {
    menuOpen = false;
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const STEPS = [
    { icon: Heart, title: 'You choose a donation amount', desc: 'Pick what feels right — every euro feeds an animal in need.' },
    { icon: Shield, title: 'Funds reach partner shelters within 7 days', desc: 'No bureaucracy. Direct wires to verified rescues, prioritized by need.' },
    { icon: Mail, title: 'You hear back from the shelter', desc: 'Occasional photos and stories from the animals you helped.' }
  ];

  function showToast(msg: string) {
    toastMessage = msg;
    toastVisible = true;
    setTimeout(() => (toastVisible = false), 2500);
  }

  function openDonation() {
    currentStep = 1;
    selectedAmount = DEFAULT_TIER;
    donating = false;
    donationOpen = true;

    // GA4 view_item — usuario abriu o modal de doacao (viu os tiers)
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'view_item', {
        currency: 'EUR',
        value: DEFAULT_TIER,
        items: TIERS.map((t) => ({
          item_id: VARIANT_BY_TIER[t.amount] || String(t.amount),
          item_name: 'Belgian Paws Care Bundle',
          item_variant: TIER_NAME_BY_AMOUNT[t.amount] || String(t.amount),
          price: t.amount,
          quantity: 1
        }))
      });
    }
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
        // Modo prod: redireciona pra Shopify com attributes + UTMs
        window.location.href = buildShopifyCartUrl({
          shopDomain: SHOPIFY_SHOP_DOMAIN,
          variantId,
          fbclid,
          fbp,
          eventId
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
        showToast('Link copied!');
        shareOpen = false;
      });
    }
  }

</script>

<header class="header">
  <a href="/" class="header-logo">
    <img src="/logo.png" alt="DogPaws" class="logo-img" />
  </a>
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
    <!-- Hero full-width com curva inferior -->
    <div class="hero-image-wrap">
      {#if CAMPAIGN.heroImage}
        <img class="hero-image" src={CAMPAIGN.heroImage} alt={CAMPAIGN.title} loading="eager" />
      {:else}
        <div class="hero-image img-placeholder">
          <div class="img-placeholder-stack">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <circle cx="9" cy="11" r="2" />
              <path d="m21 17-5-5-9 9" />
            </svg>
            <span class="img-placeholder-label">Photo coming soon</span>
          </div>
        </div>
      {/if}
    </div>

    <!-- Bloco principal: titulo + progress card + descricao curta -->
    <section class="hero-block">
      <h1 class="campaign-title">{CAMPAIGN.title}</h1>

      <div id="progress-anchor">
        <ProgressCard
          raised={CAMPAIGN.raisedEur}
          goal={CAMPAIGN.goalEur}
          lastDonorName={lastDonor.anonymous ? 'Anonymous' : lastDonor.name}
          lastDonorAmount={lastDonor.amount}
          lastDonorAgo={lastDonor.ago}
          onDonate={openDonation}
          onShare={() => (shareOpen = true)}
          onDonorsClick={scrollToDonors}
        />
      </div>

      <div class="progress-stats-row">
        <span><span class="donations-count">{CAMPAIGN.donationsCount}</span> donations</span>
        <span>{CAMPAIGN.daysLeft} days left</span>
      </div>

      <div id="story-section" class="story-text" class:story-text-collapsed={!descExpanded}>
        {#each CAMPAIGN.story as paragraph}
          <p>{paragraph}</p>
        {/each}
      </div>
      <button class="read-more" onclick={() => (descExpanded = !descExpanded)}>
        {descExpanded ? 'Read less' : 'Read more'}
      </button>
    </section>

    <!-- Story image (bloco proprio, full-width igual hero) -->
    <div class="story-image-wrap">
      {#if CAMPAIGN.storyImage}
        <img class="story-image-img" src={CAMPAIGN.storyImage} alt="Story photo" loading="lazy" />
      {:else}
        <div class="story-image-img img-placeholder">
          <div class="img-placeholder-stack">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <circle cx="9" cy="11" r="2" />
              <path d="m21 17-5-5-9 9" />
            </svg>
            <span class="img-placeholder-label">Photo coming soon</span>
          </div>
        </div>
      {/if}
    </div>

    {#if descExpanded}
      <section class="section">
        <span class="story-highlight">{CAMPAIGN.highlight}</span>
      </section>
    {/if}

    <!-- Stats grid -->
    <section class="stats-section" id="stats-section">
      <div class="section-eyebrow">The reality</div>
      <h2 class="section-title">The situation, in numbers.</h2>
      <div class="stats-grid">
        {#each CAMPAIGN.stats as stat}
          <div class="stat-card">
            <div class="stat-value">{stat.value}</div>
            <div class="stat-label">{stat.label}</div>
          </div>
        {/each}
      </div>
    </section>

    <!-- How it works -->
    <section class="section" id="how-section">
      <div class="section-eyebrow">How it works</div>
      <h2 class="section-title">How your support reaches them.</h2>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:6px">
        {#each STEPS as step, i}
          <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:14px;display:flex;gap:12px;align-items:flex-start">
            <div style="width:40px;height:40px;border-radius:9999px;background:var(--primary-soft);color:var(--primary-darker);display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <step.icon size={20} />
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-size:0.6875rem;color:var(--muted-fg);font-weight:700;letter-spacing:0.06em;text-transform:uppercase">Step 0{i + 1}</div>
              <div style="font-size:0.9375rem;font-weight:600;color:var(--fg);margin-top:2px;line-height:1.3">{step.title}</div>
              <div style="font-size:0.8125rem;color:var(--muted-fg);margin-top:4px;line-height:1.45">{step.desc}</div>
            </div>
          </div>
        {/each}
      </div>
    </section>

    <!-- Words of support / testimonials -->
    <section class="section" id="testimonials-section">
      <div class="section-eyebrow">Words of support</div>
      <h2 class="section-title">From supporters across Belgium.</h2>
      <div class="testimonial-row">
        {#each CAMPAIGN.testimonials as t}
          <div class="testimonial-card">
            <div class="testimonial-head">
              <img src={t.avatar} alt={t.name} class="testimonial-avatar-img" loading="lazy" referrerpolicy="no-referrer" />
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
      <div class="urgency-eyebrow">Time matters</div>
      <h2 class="urgency-title">Animals are waiting tonight.</h2>
      <p class="urgency-sub">You can feed one of them right now.</p>
      <button class="urgency-cta" onclick={openDonation}>
        Help feed them
        <ChevronRight size={18} strokeWidth={2.5} />
      </button>
    </section>

    <!-- Donors list (preview com 5; botao abre modal com lista completa) -->
    <div class="donations" id="donations">
      <div class="donations-header">
        <div class="donations-title">
          Donations
          <span class="donations-badge">{CAMPAIGN.donationsCount}</span>
        </div>
        <button class="donations-link" onclick={() => (donorsModalOpen = true)}>See all</button>
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
        See all {CAMPAIGN.donors.length}+ donations
      </button>
    </div>

    <!-- Organizer -->
    <div class="organizer" id="organizer-section">
      <h3>Organizer</h3>
      <div class="organizer-row">
        <div class="organizer-avatar">
          {CAMPAIGN.organizer.split(' ').map((s) => s[0]).join('').slice(0, 2)}
        </div>
        <div style="flex:1;min-width:0">
          <div class="organizer-name">{CAMPAIGN.organizer}</div>
          <div class="organizer-sub">Organizer</div>
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

      <div class="footer-copy">© 2026 {CAMPAIGN.brand} Rescue</div>

      <div class="footer-links">
        <a href="#">Terms</a>
        <a href="#">Privacy</a>
        <a href="#">Refunds</a>
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
      {currentStep === 1 ? 'Make a donation' : 'Confirm your donation'}
    </div>
    {#if currentStep === 1}
      <p class="sheet-subtitle">Every donation feeds rescue animals in our Belgian partner shelters.</p>
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
              onclick={() => selectAmount(tier.amount)}
            >
              <span class="amount-btn-value">€{tier.amount}</span>
              <span class="amount-btn-sub">feeds {tier.dogs} {tier.dogs === 1 ? 'animal' : 'animals'}</span>
            </button>
          {/each}
        </div>
      </div>
    {:else}
      <div class="step-form active">
        <button class="btn-back" onclick={() => (currentStep = 1)}>← Back</button>
        <div class="confirm-screen">
          <div class="step-label">Your donation</div>
          <div class="confirm-amount">€{selectedAmount}</div>
          <p class="confirm-sub">You're saving {dogsForAmount(selectedAmount)} {dogsForAmount(selectedAmount) === 1 ? 'animal' : 'animals'} today.</p>

          <p class="confirm-direct-note">
            Your donation will go directly to feed and care for rescued animals at our partner shelters in Belgium.
          </p>

          <button class="btn-next" onclick={handleDonate} disabled={donating}>
            {#if donating}
              <div class="spinner"></div>
              Redirecting…
            {:else}
              Donate €{selectedAmount} now
              <ArrowRight size={18} />
            {/if}
          </button>
          <div class="security-note">
            <Shield size={14} />
            Secure payment via card or Apple/Google Pay
          </div>
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
    <div class="sheet-title">All donations ({CAMPAIGN.donationsCount})</div>
    <p class="sheet-subtitle">Latest supporters helping Belgian rescues.</p>
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
    <button class="sheet-close-btn" onclick={() => (donorsModalOpen = false)}>Close</button>
  </div>
</div>

<!-- Toast -->
<div class="toast" class:show={toastVisible}>{toastMessage}</div>
