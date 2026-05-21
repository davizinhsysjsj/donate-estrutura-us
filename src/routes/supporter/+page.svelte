<script lang="ts">
  import { Heart, Download, CheckCircle2, Share2, Instagram, ArrowRight } from 'lucide-svelte';
  import Footer from '$lib/components/Footer.svelte';
  import Logo from '$lib/components/Logo.svelte';

  let { data } = $props();
  const { tier, dateStr, orderId } = data;

  const shareText = encodeURIComponent(
    `I just helped feed ${tier.dogsForWeek} rescue dogs through @pawsco.rescue 🐾 Join me at pawsco.com`
  );

  const shareLinks = {
    x: `https://twitter.com/intent/tweet?text=${shareText}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=https://pawsco.com&quote=${shareText}`,
    whatsapp: `https://wa.me/?text=${shareText}`
  };

  const bundleItems = [
    { label: 'Personalized PDF Certificate of Appreciation', action: 'Download' },
    { label: 'Rescue Stories Vol. 1 — Digital Ebook', action: 'Download' },
    { label: 'Access to PawsCo Supporter Community', action: 'Open' },
    { label: 'Quarterly Impact Reports', action: 'Sent monthly to your inbox', static: true }
  ];
</script>

<main class="min-h-screen bg-black-deep text-snow">
  <header class="border-b border-white/5">
    <div class="container-tight py-5 flex items-center justify-between">
      <Logo />
      <a href="/" class="text-xs uppercase tracking-[0.18em] text-muted hover:text-amber-accent transition-colors">
        ← Back to home
      </a>
    </div>
  </header>

  <!-- Section 1: Thank you hero -->
  <section class="container-tight pt-16 md:pt-24 pb-12 md:pb-16 text-center">
    <div class="inline-flex w-16 h-16 md:w-20 md:h-20 items-center justify-center rounded-full bg-amber-accent/15 mb-7">
      <Heart size={36} fill="currentColor" class="text-amber-accent" />
    </div>
    <h1 class="font-serif text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.05] tracking-tight text-balance">
      Thank you, friend.
    </h1>
    <p class="mt-6 text-base md:text-xl text-muted leading-relaxed text-balance max-w-xl mx-auto">
      Your <span class="text-snow font-medium">EUR {tier.amount}</span> contribution will feed
      <span class="text-amber-accent font-display font-bold">{tier.dogsForWeek}</span>
      rescue dog{tier.dogsForWeek === 1 ? '' : 's'} this week.
      <br class="hidden md:block" />
      We mean it when we say: this changes lives.
    </p>
  </section>

  <!-- Section 2: Receipt -->
  <section class="container-tight pb-12 md:pb-16">
    <div class="bg-warm-charcoal/60 border border-white/5 rounded-2xl p-6 md:p-8">
      <div class="flex items-center justify-between mb-5 pb-5 border-b border-white/5">
        <div>
          <div class="text-xs uppercase tracking-[0.2em] text-muted mb-1">Order receipt</div>
          <div class="font-display text-lg md:text-xl font-semibold text-snow tracking-tight">{orderId}</div>
        </div>
        <span class="inline-flex items-center gap-1.5 bg-emerald-500/15 text-emerald-400 text-xs font-semibold uppercase tracking-[0.15em] px-3 py-1.5 rounded-full">
          <CheckCircle2 size={13} />
          Paid
        </span>
      </div>

      <dl class="grid grid-cols-2 md:grid-cols-4 gap-5">
        <div>
          <dt class="text-[10px] uppercase tracking-[0.18em] text-muted mb-1.5">Date</dt>
          <dd class="text-sm text-snow font-medium">{dateStr}</dd>
        </div>
        <div>
          <dt class="text-[10px] uppercase tracking-[0.18em] text-muted mb-1.5">Tier</dt>
          <dd class="text-sm text-snow font-medium">{tier.name}</dd>
        </div>
        <div>
          <dt class="text-[10px] uppercase tracking-[0.18em] text-muted mb-1.5">Amount</dt>
          <dd class="text-sm text-snow font-medium font-display">EUR {tier.amount}.00</dd>
        </div>
        <div>
          <dt class="text-[10px] uppercase tracking-[0.18em] text-muted mb-1.5">Email</dt>
          <dd class="text-sm text-snow font-medium truncate">your-email@example.com</dd>
        </div>
      </dl>
    </div>
  </section>

  <!-- Section 3: Digital bundle -->
  <section class="container-tight pb-12 md:pb-16">
    <h2 class="font-serif text-2xl md:text-3xl font-semibold leading-tight tracking-tight mb-6">
      Your supporter bundle is ready.
    </h2>
    <ul class="space-y-3">
      {#each bundleItems as item}
        <li class="bg-warm-charcoal/60 border border-white/5 rounded-xl p-4 md:p-5 flex items-center justify-between gap-4">
          <div class="flex items-start gap-3 flex-1 min-w-0">
            <CheckCircle2 size={20} class="text-amber-accent shrink-0 mt-0.5" />
            <span class="text-sm md:text-base text-snow leading-snug">{item.label}</span>
          </div>
          {#if item.static}
            <span class="text-xs text-muted shrink-0 hidden sm:block">{item.action}</span>
          {:else}
            <button class="inline-flex items-center gap-1.5 bg-white/5 hover:bg-amber-accent hover:text-black-deep text-snow text-xs md:text-sm font-medium px-4 py-2 rounded-lg transition-colors shrink-0">
              {#if item.action === 'Download'}<Download size={14} />{:else}<ArrowRight size={14} />{/if}
              {item.action}
            </button>
          {/if}
        </li>
      {/each}
    </ul>
  </section>

  <!-- Section 4: Next step -->
  <section class="container-tight pb-12 md:pb-16">
    <h2 class="font-serif text-2xl md:text-3xl font-semibold leading-tight tracking-tight mb-6">
      Want to help even more?
    </h2>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
      <div class="bg-warm-charcoal/60 border border-white/5 rounded-2xl p-6">
        <div class="w-11 h-11 rounded-xl bg-amber-accent/15 text-amber-accent flex items-center justify-center mb-4">
          <Share2 size={20} />
        </div>
        <h3 class="font-serif text-lg md:text-xl font-semibold text-snow mb-2">Share your impact</h3>
        <p class="text-sm text-muted leading-relaxed mb-5">
          Word of mouth feeds more dogs than any ad we could buy. Tell one friend.
        </p>
        <div class="flex flex-wrap gap-2">
          <a href={shareLinks.x} target="_blank" rel="noopener" class="text-xs font-medium bg-white/5 hover:bg-amber-accent hover:text-black-deep px-3.5 py-2 rounded-lg transition-colors">Share on X</a>
          <a href={shareLinks.facebook} target="_blank" rel="noopener" class="text-xs font-medium bg-white/5 hover:bg-amber-accent hover:text-black-deep px-3.5 py-2 rounded-lg transition-colors">Facebook</a>
          <a href={shareLinks.whatsapp} target="_blank" rel="noopener" class="text-xs font-medium bg-white/5 hover:bg-amber-accent hover:text-black-deep px-3.5 py-2 rounded-lg transition-colors">WhatsApp</a>
        </div>
      </div>

      <div class="bg-warm-charcoal/60 border border-white/5 rounded-2xl p-6">
        <div class="w-11 h-11 rounded-xl bg-copper/15 text-copper flex items-center justify-center mb-4">
          <Instagram size={20} />
        </div>
        <h3 class="font-serif text-lg md:text-xl font-semibold text-snow mb-2">Follow our work</h3>
        <p class="text-sm text-muted leading-relaxed mb-5">
          See the dogs you helped, before-and-after stories, weekly updates from the shelters.
        </p>
        <a href="https://instagram.com/pawsco.rescue" target="_blank" rel="noopener" class="inline-flex items-center gap-2 bg-amber-accent text-black-deep text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-copper transition-colors">
          Follow @pawsco.rescue
          <ArrowRight size={15} />
        </a>
      </div>
    </div>
  </section>

  <!-- Section 5: Emotional footer / quote -->
  <section class="container-tight pb-16 md:pb-24">
    <div class="bg-gradient-to-br from-amber-accent/8 via-warm-charcoal/40 to-warm-charcoal/40 border border-amber-accent/20 rounded-2xl p-8 md:p-12 text-center">
      <p class="font-serif italic text-xl md:text-2xl text-snow leading-snug max-w-xl mx-auto text-balance">
        “We don't see ourselves as a charity. We see ourselves as the bridge between people who care and dogs who need it most.”
      </p>
      <p class="mt-5 text-sm text-muted">— Aoife Murphy, Founder</p>
    </div>
  </section>

  <Footer />
</main>
