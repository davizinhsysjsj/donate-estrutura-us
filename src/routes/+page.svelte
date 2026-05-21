<script lang="ts">
  import { Search, Menu, Share2, ChevronRight, Star, Calendar, Shield, Heart, Truck, Mail, Facebook, Youtube, Twitter, Instagram, ChevronDown } from 'lucide-svelte';
  import { DONORS, RAISED_EUR, GOAL_EUR } from '$lib/data/donors';

  const HERO_IMG = 'https://images.unsplash.com/photo-1601758124510-52d02ddb7cbd?w=800&q=80';
  const STORY_IMG = 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800&q=80';

  const progressPct = Math.min(100, Math.round((RAISED_EUR / GOAL_EUR) * 100));
  const progressDash = 2 * Math.PI * 22;
  const progressOffset = progressDash * (1 - progressPct / 100);

  const PRESET_AMOUNTS = [10, 25, 50, 100, 250];
  const lastDonor = DONORS[0];

  let descExpanded = $state(false);
  let donationOpen = $state(false);
  let shareOpen = $state(false);
  let currentStep = $state<1 | 2 | 3 | 4>(1);
  let selectedAmount = $state<number | null>(25);
  let customAmount = $state<string>('');
  let useCustom = $state(false);
  let selectedMethod = $state<'card' | 'express'>('card');
  let payerName = $state('');
  let payerEmail = $state('');
  let payerPhone = $state('');
  let submitting = $state(false);
  let amountError = $state(false);
  let payerError = $state('');
  let toastMessage = $state('');
  let toastVisible = $state(false);
  let openFaq = $state<number | null>(null);

  const TESTIMONIALS = [
    { initial: 'S', color: 'av-skyblue', name: 'Sarah M.', city: 'Cork', quote: 'Knowing exactly where my donation goes makes all the difference.' },
    { initial: 'D', color: 'av-teal', name: 'Declan O.', city: 'Dublin', quote: 'No guilt-trip emails. Just clear updates. Came back twice on my own.' },
    { initial: 'A', color: 'av-coral', name: 'Aoife K.', city: 'Galway', quote: 'I met one of the shelter coordinators in person. The money is reaching the dogs.' }
  ];

  const FAQS = [
    { q: 'Where does my money go?', a: '88 cents of every euro reaches feeding and medical care on the ground. The rest covers card processing fees. We publish a quarterly transparency report.' },
    { q: 'Are you a registered charity?', a: 'PawsCo Rescue is a grassroots fundraising initiative supporting verified rescue partners. We are not a registered Irish charity — we operate as a transparent for-cause campaign.' },
    { q: 'Can I get a refund?', a: 'Yes — full refund within 30 days, no questions asked. Email hello@pawsco.com and we will process it within 48 hours.' }
  ];

  const STATS = [
    { value: '2,847', label: 'dogs waiting in our partner shelters' },
    { value: '12', label: 'rescue partners across Ireland' },
    { value: '€4.20', label: 'feeds one dog for a week' },
    { value: '88%', label: 'of every euro goes directly to feeding' }
  ];

  const STEPS = [
    { icon: Heart, title: 'You choose a donation amount', desc: 'Pick what feels right — from a starter pack to a guardian role.' },
    { icon: Truck, title: 'Funds reach partner shelters within 7 days', desc: 'No bureaucracy. Direct wires to verified rescues, prioritized by need.' },
    { icon: Mail, title: 'You receive an impact report by email', desc: 'Photos, names, outcomes — and your digital supporter bundle.' }
  ];

  function showToast(msg: string) {
    toastMessage = msg;
    toastVisible = true;
    setTimeout(() => (toastVisible = false), 2500);
  }

  function openDonation() {
    currentStep = 1;
    selectedAmount = 25;
    useCustom = false;
    customAmount = '';
    selectedMethod = 'card';
    payerName = '';
    payerEmail = '';
    payerPhone = '';
    payerError = '';
    amountError = false;
    donationOpen = true;
  }

  function selectAmount(amount: number | 'custom') {
    if (amount === 'custom') {
      useCustom = true;
      selectedAmount = null;
    } else {
      useCustom = false;
      selectedAmount = amount;
      customAmount = '';
    }
  }

  function getEffectiveAmount(): number | null {
    if (useCustom) {
      const n = parseFloat(customAmount);
      return Number.isFinite(n) && n >= 1 ? n : null;
    }
    return selectedAmount;
  }

  function nextStep1() {
    amountError = false;
    const amt = getEffectiveAmount();
    if (!amt) {
      amountError = true;
      return;
    }
    selectedAmount = amt;
    currentStep = 2;
  }

  function nextStep2() {
    currentStep = 3;
  }

  function submitDonation() {
    payerError = '';
    if (!payerName.trim()) {
      payerError = 'Please enter your full name.';
      return;
    }
    if (!payerEmail.trim() || !payerEmail.includes('@')) {
      payerError = 'Please enter a valid email.';
      return;
    }
    if (selectedMethod === 'express' && !payerPhone.trim()) {
      payerError = 'Please enter a phone number for express checkout.';
      return;
    }

    submitting = true;
    setTimeout(() => {
      submitting = false;
      currentStep = 4;
      setTimeout(() => {
        const amt = getEffectiveAmount() ?? 25;
        window.location.href = `/supporter?tier=${amt}`;
      }, 2200);
    }, 1500);
  }

  const PAGE_URL = 'https://donate-estrutura.vercel.app';
  const PAGE_TITLE = 'Help feed Irish rescue dogs tonight';

  function shareTo(target: 'whatsapp' | 'facebook' | 'copy') {
    if (target === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${PAGE_TITLE} ${PAGE_URL}`)}`, '_blank');
    } else if (target === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(PAGE_URL)}`, '_blank');
    } else {
      navigator.clipboard?.writeText(PAGE_URL).then(() => {
        showToast('Link copied!');
        shareOpen = false;
      });
    }
  }

  function toggleFaq(i: number) {
    openFaq = openFaq === i ? null : i;
  }
</script>

<header class="header">
  <button class="header-btn" aria-label="Search">
    <Search size={20} />
  </button>
  <a href="/" class="header-logo">
    <svg class="logo-icon" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 4C11.163 4 4 11.163 4 20s7.163 16 16 16 16-7.163 16-16S28.837 4 20 4z" fill="#3B82F6" />
      <path d="M20 8c-1.5 3-5 6-8 7 1 4 4 8 8 9 4-1 7-5 8-9-3-1-6.5-4-8-7z" fill="#DBEAFE" />
      <path d="M20 12c-1 2-3 4-5 5 .7 2.5 2.5 5 5 6 2.5-1 4.3-3.5 5-6-2-1-4-3-5-5z" fill="#3B82F6" />
    </svg>
    <span class="logo-text">pawsco</span>
  </a>
  <button class="header-btn" aria-label="Menu">
    <Menu size={20} />
  </button>
</header>

<div class="page">
  <div class="container-app">
    <!-- Hero -->
    <div class="hero">
      <img src={HERO_IMG} alt="Rescue dog waiting in shelter" loading="eager" />
      <div class="hero-gradient"></div>
      <div class="hero-avatar">
        <img src="https://ui-avatars.com/api/?name=Aoife+Murphy&background=3B82F6&color=fff&size=56" alt="Aoife Murphy" />
        <span class="hero-avatar-name">Aoife Murphy</span>
      </div>
      <div class="hero-title">
        <h1>Help feed Irish rescue dogs tonight</h1>
      </div>
    </div>

    <!-- Progress -->
    <div class="progress-section">
      <div class="progress-row">
        <div class="progress-circle">
          <svg width="52" height="52" viewBox="0 0 52 52">
            <circle cx="26" cy="26" r="22" fill="none" stroke="#e5e5e5" stroke-width="4" />
            <circle
              cx="26"
              cy="26"
              r="22"
              fill="none"
              stroke="#3B82F6"
              stroke-width="4"
              stroke-dasharray={progressDash}
              stroke-dashoffset={progressOffset}
              stroke-linecap="round"
            />
          </svg>
          <div class="progress-circle-text">{progressPct}%</div>
        </div>
        <div class="progress-info">
          <h2>
            <strong>€{RAISED_EUR.toLocaleString('en-IE')}</strong> raised
            <span>of €{GOAL_EUR.toLocaleString('en-IE')}</span>
          </h2>
        </div>
      </div>
      <div class="progress-last">
        <span>{lastDonor.name} donated €{lastDonor.amount}</span>
        <ChevronRight size={12} strokeWidth={2.5} />
      </div>
    </div>

    <!-- Buttons -->
    <div class="btn-row">
      <button class="btn btn-primary" onclick={openDonation}>Donate</button>
      <button class="btn btn-outline" onclick={() => (shareOpen = true)}>
        <Share2 size={16} />
        Share
      </button>
    </div>

    <!-- Description -->
    <div class="description">
      <p class="description-text" class:expanded={descExpanded}>
        Help us feed dogs who can't ask for help themselves 🐾
        <br /><br />
        Right now, our partner shelters across Ireland are running on empty. Dozens of rescued dogs — abandoned, surrendered, or pulled off the street — depend entirely on us for food, medical care, and a safe place to sleep.
        <br /><br />
        Every euro you donate goes directly to feeding and basic care on the ground. We don't run a charity office. We run a network of small shelters that put every cent into bowls and vet bills.
        <br /><br />
        One donation can change a dog's week. Five donations can change a shelter's month. You can be one of them tonight.
      </p>
      <button class="read-more" onclick={() => (descExpanded = !descExpanded)}>
        {descExpanded ? 'Read less' : 'Read more'}
      </button>
    </div>

    <!-- Why this matters -->
    <section class="section">
      <div class="section-eyebrow">Why this matters</div>
      <h2 class="section-title">Three weeks ago, a call came in from Galway.</h2>
      <div class="why-image">
        <img src={STORY_IMG} alt="Rescued dog at shelter" loading="lazy" />
      </div>
      <div class="why-text">
        <p>A retired farmer found her behind a shuttered restaurant — ribs visible through matted fur, leg torn from barbed wire, too scared to come close.</p>
        <p>It took our partner shelter three days to coax her into a van. Another two weeks of vet care and patient hands before she would let anyone touch her ears.</p>
        <p>Yesterday she fell asleep on a kid's lap in a forever home in Cork. The family named her Maeve.</p>
      </div>
      <span class="why-highlight">Maeve was lucky. Hundreds aren't.</span>
    </section>

    <!-- Stats -->
    <section class="stats-section">
      <div class="section-eyebrow">The reality</div>
      <h2 class="section-title">The situation, in numbers.</h2>
      <div class="stats-grid">
        {#each STATS as stat}
          <div class="stat-card">
            <div class="stat-value">{stat.value}</div>
            <div class="stat-label">{stat.label}</div>
          </div>
        {/each}
      </div>
    </section>

    <!-- How it works -->
    <section class="section">
      <div class="section-eyebrow">How it works</div>
      <h2 class="section-title">How your support reaches them.</h2>
      <div class="steps-list">
        {#each STEPS as step, i}
          <div class="step-card">
            <div class="step-icon"><step.icon size={20} /></div>
            <div class="step-body">
              <div class="step-no">Step 0{i + 1}</div>
              <div class="step-title">{step.title}</div>
              <div class="step-desc">{step.desc}</div>
            </div>
          </div>
        {/each}
      </div>
    </section>

    <!-- Trust -->
    <section class="section">
      <div class="section-eyebrow">Trust</div>
      <h2 class="section-title">From supporters across Ireland.</h2>
      <div class="testimonial-row">
        {#each TESTIMONIALS as t}
          <div class="testimonial-card">
            <div class="testimonial-head">
              <div class="testimonial-avatar {t.color}">{t.initial}</div>
              <div>
                <div class="testimonial-name">{t.name}</div>
                <div class="testimonial-meta">{t.city}</div>
              </div>
            </div>
            <p class="testimonial-quote">"{t.quote}"</p>
          </div>
        {/each}
      </div>

      <h3 class="faq-title">Common questions</h3>
      <div class="faq-list">
        {#each FAQS as faq, i}
          <div class="faq-item">
            <button
              class="faq-question"
              aria-expanded={openFaq === i}
              onclick={() => toggleFaq(i)}
            >
              {faq.q}
              <ChevronDown size={16} class="faq-chevron" />
            </button>
            {#if openFaq === i}
              <p class="faq-answer">{faq.a}</p>
            {/if}
          </div>
        {/each}
      </div>
    </section>

    <!-- Urgency -->
    <section class="urgency">
      <div class="urgency-eyebrow">Time matters</div>
      <h2 class="urgency-title">47 dogs are waiting tonight.</h2>
      <p class="urgency-sub">You can help one of them right now.</p>
      <button class="urgency-cta" onclick={openDonation}>
        Help feed them
        <ChevronRight size={18} strokeWidth={2.5} />
      </button>
    </section>

    <!-- Donations list -->
    <div class="donations">
      <div class="donations-header">
        <div class="donations-title">
          Donations
          <span class="donations-badge">{DONORS.length + 41}</span>
        </div>
        <a href="#" class="donations-link">
          <Star size={14} />
          Top donors
        </a>
      </div>
      <ul class="donor-list">
        {#each DONORS as d}
          <li class="donor-item">
            <div class="donor-avatar {d.color}">
              {#if d.anonymous}
                <Heart size={16} />
              {:else}
                {d.name.charAt(0)}
              {/if}
            </div>
            <div class="donor-info">
              <div class="donor-name">{d.name}</div>
              <div class="donor-meta">€{d.amount} · {d.ago}</div>
            </div>
          </li>
        {/each}
      </ul>
      <button class="btn-ver-todos">See all donations</button>
    </div>

    <!-- Organizer -->
    <div class="organizer">
      <h3>Organizer</h3>
      <div class="organizer-row">
        <div class="organizer-avatar">
          <img src="https://ui-avatars.com/api/?name=Aoife+Murphy&background=DBEAFE&color=1E40AF&size=96" alt="Aoife Murphy" />
        </div>
        <div>
          <div class="organizer-name">Aoife Murphy</div>
          <div class="organizer-sub">Organizer</div>
          <div class="organizer-sub">Galway, Ireland</div>
        </div>
      </div>
      <button class="btn-contact">Contact</button>

      <div class="campaign-meta">
        <div class="campaign-meta-row">
          <Calendar size={14} />
          March 2026 ·
          <a href="#">Animals</a>
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

      <div class="footer-copy">© 2026 PawsCo Rescue</div>

      <div class="footer-links">
        <a href="#">Terms</a>
        <a href="#">Privacy Notice</a>
        <a href="#">Refund Policy</a>
        <a href="#">Cookie Policy</a>
        <a href="mailto:hello@pawsco.com">Contact us</a>
      </div>
    </footer>
  </div>
</div>

<!-- Sticky Bar -->
<div class="sticky-bar">
  <button class="btn btn-primary" style="flex:1" onclick={openDonation}>Donate</button>
  <button class="btn btn-outline" style="width:52px;flex:none;padding:0" aria-label="Share" onclick={() => (shareOpen = true)}>
    <Share2 size={18} />
  </button>
</div>

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
      {#if currentStep === 1}Make a donation{:else if currentStep === 2}Payment method{:else if currentStep === 3}Your details{:else}Thank you{/if}
    </div>
    {#if currentStep === 1}
      <p class="sheet-subtitle">From €10. One-time. No subscription.</p>
    {/if}

    {#if currentStep === 1}
      <div class="step-form active">
        <div class="step-label">Choose an amount (€)</div>
        <div class="amount-grid">
          {#each PRESET_AMOUNTS as a}
            <button
              type="button"
              class="amount-btn"
              class:selected={!useCustom && selectedAmount === a}
              onclick={() => selectAmount(a)}
            >€{a}</button>
          {/each}
          <button
            type="button"
            class="amount-btn"
            class:selected={useCustom}
            onclick={() => selectAmount('custom')}
          >Custom</button>
        </div>
        {#if useCustom}
          <input
            type="number"
            class="input-field"
            placeholder="Custom amount (€)"
            min="1"
            step="0.01"
            bind:value={customAmount}
          />
        {/if}
        <div class="error-msg" class:visible={amountError}>Please select or enter a valid amount.</div>
        <button class="btn-next" onclick={nextStep1}>Continue →</button>
      </div>
    {:else if currentStep === 2}
      <div class="step-form active">
        <button class="btn-back" onclick={() => (currentStep = 1)}>← Back</button>
        <div class="step-label">Payment method</div>
        <div class="method-grid">
          <button
            type="button"
            class="method-btn"
            class:selected={selectedMethod === 'card'}
            onclick={() => (selectedMethod = 'card')}
          >
            <span style="font-size:24px">💳</span>
            <span class="method-btn-name">Card</span>
            <span class="method-btn-sub">Visa · Mastercard</span>
          </button>
          <button
            type="button"
            class="method-btn"
            class:selected={selectedMethod === 'express'}
            onclick={() => (selectedMethod = 'express')}
          >
            <span style="font-size:24px">📱</span>
            <span class="method-btn-name">Apple / Google Pay</span>
            <span class="method-btn-sub">Express checkout</span>
          </button>
        </div>
        <button class="btn-next" onclick={nextStep2}>Continue →</button>
      </div>
    {:else if currentStep === 3}
      <div class="step-form active">
        <button class="btn-back" onclick={() => (currentStep = 2)}>← Back</button>
        <div class="step-label">Your details</div>

        <div class="field-group">
          <label class="input-label" for="payerName">Full name</label>
          <input id="payerName" type="text" class="input-field" placeholder="Sean O'Brien" autocomplete="name" bind:value={payerName} />
        </div>
        <div class="field-group">
          <label class="input-label" for="payerEmail">Email</label>
          <input id="payerEmail" type="email" class="input-field" placeholder="you@email.com" autocomplete="email" bind:value={payerEmail} />
        </div>
        {#if selectedMethod === 'express'}
          <div class="field-group">
            <label class="input-label" for="payerPhone">Phone (for express checkout)</label>
            <input id="payerPhone" type="tel" class="input-field" placeholder="+353 87 000 0000" autocomplete="tel" bind:value={payerPhone} />
          </div>
        {/if}

        <div class="error-msg" class:visible={!!payerError}>{payerError}</div>

        <button class="btn-next" onclick={submitDonation} disabled={submitting}>
          {#if submitting}
            <div class="spinner"></div>
            Processing…
          {:else}
            Confirm donation of €{getEffectiveAmount() ?? selectedAmount ?? 25}
          {/if}
        </button>
        <div class="security-note">
          <Shield size={14} />
          Secure payment · 30-day refund
        </div>
      </div>
    {:else}
      <div class="step-form active">
        <div class="result-screen">
          <div class="result-icon"><Heart size={28} fill="currentColor" /></div>
          <div class="result-title">Thank you, friend.</div>
          <div class="result-text">
            Your donation is being processed. Redirecting you to your supporter area…
          </div>
          <div class="spinner" style="margin: 0 auto; border-color: rgba(59,130,246,0.25); border-top-color: var(--primary)"></div>
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
        <div class="share-icon" style="background:#DBEAFE">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="#25D366">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
            <path d="M11.997 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.878-1.417A9.944 9.944 0 0 0 11.997 22C17.52 22 22 17.523 22 12c0-5.522-4.48-10-10.003-10zm0 18.18a8.154 8.154 0 0 1-4.158-1.138l-.297-.178-3.087.897.923-3.01-.196-.309A8.145 8.145 0 0 1 3.817 12c0-4.516 3.664-8.18 8.18-8.18s8.18 3.664 8.18 8.18c0 4.517-3.664 8.18-8.18 8.18z" />
          </svg>
        </div>
        <span class="share-label">WhatsApp</span>
      </button>
      <button class="share-btn" onclick={() => shareTo('facebook')}>
        <div class="share-icon" style="background:#DBEAFE">
          <Facebook size={22} color="#1877F2" />
        </div>
        <span class="share-label">Facebook</span>
      </button>
      <button class="share-btn" onclick={() => shareTo('copy')}>
        <div class="share-icon" style="background:#f3f4f6">
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

<!-- Toast -->
<div class="toast" class:show={toastVisible}>{toastMessage}</div>
