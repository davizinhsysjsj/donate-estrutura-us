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
  import { TIERS, DEFAULT_TIER, dogsForAmount } from '$lib/data/tiers';
  import ProgressCard from '$lib/components/ProgressCard.svelte';
  import StickyBottomBar from '$lib/components/StickyBottomBar.svelte';
  import {
    captureAndPersistFbclid, getFbp, getEid, trackEvent, uuid, buildShopifyCartUrl,
    type UtmData
  } from '$lib/utils/fbtracking';
  import { attachVslTracking, getSid } from '$lib/utils/analytics';
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

  // Estado de tracking (preenchido no onMount, usado no handleDonate)
  let fbclid: string | null = $state(null);
  let fbc: string | null = $state(null);
  let fbp: string | null = $state(null);
  let utm: UtmData | null = $state(null);

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
    setTimeout(() => { fbp = getFbp(); }, 500);

    // Preload /donate em background: quando o user clicar em Doneren,
    // dados + codigo ja estao em cache → goto() navega instantaneo
    preloadCode('/donate').catch(() => {});
    setTimeout(() => { preloadData('/donate').catch(() => {}); }, 1200);

    // Lazy load do video VSL (16MB) — so seta o src quando o video
    // estiver perto de entrar na viewport. Evita que o download do
    // video bloqueie a renderizacao inicial e a hidratacao.
    const vslWrap = document.querySelector('.vsl-wrap');
    if (vslWrap && 'IntersectionObserver' in window) {
      const obs = new IntersectionObserver(
        ([entry], o) => {
          if (entry.isIntersecting) {
            videoSrc = VSL_URL;
            o.disconnect();
          }
        },
        { rootMargin: '400px' }
      );
      obs.observe(vslWrap);
    } else {
      videoSrc = VSL_URL;
    }

    donorTimer = setInterval(() => {
      donorIdx = (donorIdx + 1) % donorsList.length;
    }, 4200);

    heroTimer = setInterval(() => {
      heroIdx = (heroIdx + 1) % heroImages.length;
    }, 3000);

    // Back guard: mesmo comportamento da LP
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
    if (heroTimer) clearInterval(heroTimer);
  });

  let exitPopupVsl: ReturnType<typeof ExitIntentPopup> | null = $state(null);

  function scrollToDonors() {
    const el = document.getElementById('donations');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // VSL player
  const VSL_URL = 'https://belgianpaws-vsl.vercel.app/vsl.mp4';
  let videoEl: HTMLVideoElement | null = $state(null);
  let audioEnabled = $state(false);
  // src e carregado lazy via IntersectionObserver no onMount (video tem 16MB,
  // se carregar imediato compete com bundle/imagens criticas e trava a UI)
  let videoSrc = $state<string>('');

  function enableAudio() {
    if (!videoEl) return;
    // Se o lazy-load ainda nao setou o src, forca agora pro user nao
    // ficar olhando pra um play que nao toca
    if (!videoSrc) videoSrc = VSL_URL;
    videoEl.muted = false;
    videoEl.currentTime = 0;
    videoEl.play().catch(() => {});
    audioEnabled = true;
  }

  // Liga analytics no player quando estiver disponivel
  $effect(() => {
    if (videoEl) attachVslTracking(videoEl);
  });

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

  // ── Hero carousel ──
  const heroImages = [
    '/hero1.webp',
    '/hero-rescue.webp',
    '/hero3.webp',
    '/hero4.webp',
  ];
  let heroIdx = $state(0);
  let heroTimer: ReturnType<typeof setInterval> | null = null;

  // ── Carousel de cães resgatados ──
  const rescuedDogs = [
    { src: '/dogs/dog1.webp' },
    { src: '/dogs/dog2.webp' },
    { src: '/dogs/dog3.webp' },
    { src: '/dogs/dog4.webp' },
    { src: '/dogs/dog5.webp' },
  ];
  let rescuedIndex = $state(0);

  let cTouchX = 0;

  function carouselPrev() {
    rescuedIndex = (rescuedIndex - 1 + rescuedDogs.length) % rescuedDogs.length;
  }
  function carouselNext() {
    rescuedIndex = (rescuedIndex + 1) % rescuedDogs.length;
  }
  function carouselGoTo(i: number) { rescuedIndex = i; }

  const MENU_ITEMS = [
    { id: 'story-section', label: 'Historia' },
    { id: 'testimonials-section', label: 'Apoyos' },
    { id: 'donations', label: 'Donaciones' },
    { id: 'organizer-section', label: 'Organizador' }
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

    // 2. Dispara InitiateCheckout client-side (Meta + Taboola)
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
          sid: getSid(),
          eid: getEid()
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
        showToast('¡Enlace copiado!');
        shareOpen = false;
      });
    }
  }

</script>

<svelte:head>
  <!-- Preconnect pro domínio do video (resolve DNS+TLS antes do user dar play) -->
  <link rel="preconnect" href="https://belgianpaws-vsl.vercel.app" crossorigin />
  <link rel="dns-prefetch" href="https://belgianpaws-vsl.vercel.app" />
</svelte:head>

<header class="header">
  <a href="/" class="header-logo">
    <img src="/logo.webp" alt="Donaciones Oficiales España" class="logo-img" />
    <span class="header-flag" aria-hidden="true">🇪🇸</span>
  </a>
  <button
    class="header-menu-btn"
    aria-label="Abrir menú"
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
      aria-label="Cerrar menú"
      onclick={() => (menuOpen = false)}
    ></button>
    <nav class="header-menu-dropdown" aria-label="Navegación del sitio">
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
    <!-- Hero carousel com setas -->
    <div class="hero-image-wrap" data-section="hero-image">
      {#each heroImages as src, i}
        <img
          class="hero-image hero-slide {i === heroIdx ? 'hero-slide-active' : ''}"
          {src}
          alt={CAMPAIGN.title}
          loading={i === 0 ? 'eager' : 'lazy'}
          fetchpriority={i === 0 ? 'high' : 'auto'}
          decoding="async"
          width="900"
          height="600"
        />
      {/each}
      <button
        class="hero-arrow hero-arrow-prev"
        onclick={() => { heroIdx = (heroIdx - 1 + heroImages.length) % heroImages.length; }}
        aria-label="Anterior"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <button
        class="hero-arrow hero-arrow-next"
        onclick={() => { heroIdx = (heroIdx + 1) % heroImages.length; }}
        aria-label="Siguiente"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>

    <!-- Bloco principal: titulo + progress card + descricao curta -->
    <section class="hero-block" data-section="hero-block">
      <h1 class="campaign-title">{CAMPAIGN.title}</h1>

      <div id="progress-anchor">
        <ProgressCard
          raised={raisedEur}
          goal={CAMPAIGN.goalEur}
          lastDonorName={lastDonor.anonymous ? 'Anónimo' : lastDonor.name}
          lastDonorAmount={lastDonor.amount}
          lastDonorAgo={lastDonor.ago}
          onDonate={openDonation}
          onShare={() => (shareOpen = true)}
          onDonorsClick={scrollToDonors}
          currency="€"
          locale="es-ES"
          raisedLabel="recaudado"
          ofLabel="de"
          donatedVerb="donó"
          donateLabel="Donar"
          shareLabel="Compartir"
          donorsAria="Ver todos los donantes"
        />
      </div>

      <div class="progress-stats-row">
        <span><span class="donations-count">{donationsCount}</span> donaciones</span>
        <span>{daysLeft} días restantes</span>
      </div>

      <div id="story-section" data-section="story" class="story-text" class:story-text-collapsed={!descExpanded}>
        {#each CAMPAIGN.story as paragraph}
          <p>{paragraph}</p>
        {/each}
      </div>
      <button class="read-more" onclick={() => (descExpanded = !descExpanded)}>
        {descExpanded ? 'Leer menos' : 'Leer más'}
      </button>
    </section>

    <!-- VSL player (embaixo da descricao) -->
    <div class="vsl-wrap" data-section="vsl-video">
      <video
        bind:this={videoEl}
        src={videoSrc || undefined}
        poster={CAMPAIGN.heroImage}
        autoplay
        muted
        playsinline
        preload="none"
        width="900"
        height="506"
        class="vsl-video"
      ></video>

      {#if !audioEnabled}
        <button class="vsl-overlay" onclick={enableAudio} aria-label="Haz clic para escuchar">
          <div class="vsl-play-circle">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
              <polygon points="6,4 20,12 6,20" />
            </svg>
          </div>
          <span class="vsl-click-label">Haz clic para escuchar</span>
        </button>
      {/if}
    </div>

    <!-- Perros rescatados carousel -->
    <section class="section rescued-section" data-section="rescued-dogs">
      <div class="section-eyebrow">Esta semana</div>
      <h2 class="section-title">Perros rescatados esta semana</h2>

      <div
        class="carousel-wrap"
        role="region"
        aria-label="Perros rescatados"
        ontouchstart={(e) => { cTouchX = e.touches[0].clientX; }}
        ontouchend={(e) => { const dx = e.changedTouches[0].clientX - cTouchX; if (dx > 40) carouselPrev(); else if (dx < -40) carouselNext(); }}
      >
        {#each rescuedDogs as dog, i}
          <img
            src={dog.src}
            alt="Perro rescatado {i + 1}"
            class="carousel-img {i === rescuedIndex ? 'carousel-img-active' : ''}"
            loading={i === 0 ? 'eager' : 'lazy'}
            draggable="false"
          />
        {/each}

        <button class="carousel-btn carousel-btn-prev" onclick={carouselPrev} aria-label="Anterior">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <button class="carousel-btn carousel-btn-next" onclick={carouselNext} aria-label="Siguiente">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      <div class="carousel-dots">
        {#each rescuedDogs as _, i}
          <button
            class="carousel-dot {i === rescuedIndex ? 'active' : ''}"
            onclick={() => carouselGoTo(i)}
            aria-label="Imagen {i + 1}"
          ></button>
        {/each}
      </div>

      <p class="rescued-caption">Necesitan comida.</p>
    </section>

    {#if descExpanded}
      <section class="section">
        <span class="story-highlight">{CAMPAIGN.highlight}</span>
      </section>
    {/if}


    <!-- Words of support / testimonials -->
    <section class="section" id="testimonials-section" data-section="testimonials">
      <div class="section-eyebrow">Testimonios</div>
      <h2 class="section-title">De personas de toda España.</h2>
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

    <!-- Donors list (preview com 5; botao abre modal com lista completa) -->
    <div class="donations" id="donations">
      <div class="donations-header">
        <div class="donations-title">
          Donaciones
          <span class="donations-badge">{donationsCount}</span>
        </div>
        <button class="donations-link" onclick={() => (donorsModalOpen = true)}>Ver todo</button>
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
        Ver todas las {donorsList.length}+ donaciones
      </button>
    </div>

    <!-- Organizer -->
    <div class="organizer" id="organizer-section">
      <h3>Organizador</h3>
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
          <div class="organizer-sub">Organizador</div>
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
          Donación protegida
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

      <div class="footer-copy">© 2026 {CAMPAIGN.brand} Refugio</div>

      <div class="footer-links">
        <a href="#">Términos</a>
        <a href="#">Privacidad</a>
        <a href="#">Reembolsos</a>
        <a href="#">Cookies</a>
        <a href="mailto:hello@pawsco.com">Contacto</a>
      </div>
    </footer>
  </div>
</div>

<!-- Sticky bottom bar (aparece quando o card principal sai da viewport) -->
<StickyBottomBar
  raised={CAMPAIGN.raisedEur}
  goal={CAMPAIGN.goalEur}
  lastDonorName={lastDonor.anonymous ? 'Anónimo' : lastDonor.name}
  lastDonorAmount={lastDonor.amount}
  lastDonorAgo={lastDonor.ago}
  onDonate={openDonation}
  onShare={() => (shareOpen = true)}
  onDonorsClick={scrollToDonors}
  currency="€"
  locale="es-ES"
  raisedLabel="recaudado"
  ofLabel="de"
  donatedVerb="donó"
  donateLabel="Donar"
  shareLabel="Compartir"
  donorsAria="Ver todos los donantes"
/>

<!-- Donation Sheet -->
<div
  class="overlay"
  class:open={donationOpen}
  role="dialog"
  aria-modal="true"
  aria-label="Donación"
  onclick={(e) => e.target === e.currentTarget && (donationOpen = false)}
>
  <div class="sheet" role="document">
    <div class="sheet-handle"></div>
    <div class="sheet-title">
      {currentStep === 1 ? 'Haz una donación' : 'Confirma tu donación'}
    </div>
    {#if currentStep === 1}
      <p class="sheet-subtitle">Cada donación alimenta a animales rescatados en nuestros refugios asociados en España.</p>
    {/if}

    {#if currentStep === 1}
      <div class="step-form active">
        <div class="step-label">Elige un importe</div>
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
                <span class="amount-btn-badge">Más elegido</span>
              {/if}
              <span class="amount-btn-value">€{tier.amount}</span>
              <span class="amount-btn-sub">alimenta a {tier.dogs} {tier.dogs === 1 ? 'animal' : 'animales'}</span>
            </button>
          {/each}
        </div>
      </div>
    {:else}
      <div class="step-form active">
        <button class="btn-back" onclick={() => (currentStep = 1)}>← Volver</button>
        <div class="confirm-screen">
          <div class="step-label">Tu donación</div>
          <div class="confirm-amount">€{selectedAmount}</div>
          <p class="confirm-sub">Hoy salvas {dogsForAmount(selectedAmount)} {dogsForAmount(selectedAmount) === 1 ? 'animal' : 'animales'}.</p>

          <p class="confirm-direct-note">
            Tu donación va directamente a la alimentación y cuidado de animales rescatados en nuestros refugios asociados en España.
          </p>

          <button class="btn-bancontact" onclick={handleDonate} disabled={donating}>
            {#if donating}
              <div class="spinner spinner-dark"></div>
              <span class="btn-bancontact-text">Redirigiendo…</span>
            {:else}
              <span class="btn-bancontact-text">Donar €{selectedAmount} con tarjeta</span>
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
  aria-label="Compartir"
  onclick={(e) => e.target === e.currentTarget && (shareOpen = false)}
>
  <div class="sheet" role="document">
    <div class="sheet-handle"></div>
    <div class="sheet-title">Comparte esta campaña</div>
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
        <span class="share-label">Copiar enlace</span>
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
  aria-label="Todas las donaciones"
  onclick={(e) => e.target === e.currentTarget && (donorsModalOpen = false)}
>
  <div class="sheet sheet-donors" role="document">
    <div class="sheet-handle"></div>
    <div class="sheet-title">Todas las donaciones ({donationsCount})</div>
    <p class="sheet-subtitle">Últimos donantes que ayudan a refugios en toda España.</p>
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
    <button class="sheet-close-btn" onclick={() => (donorsModalOpen = false)}>Cerrar</button>
  </div>
</div>

<!-- Toast -->
<div class="toast" class:show={toastVisible}>{toastMessage}</div>

<!-- Exit intent popup (desktop: cursor sai pelo topo após 8s; mobile: back press) -->
<ExitIntentPopup bind:this={exitPopupVsl} onDonate={openDonation} onBack={() => goto('/wacht')} />

