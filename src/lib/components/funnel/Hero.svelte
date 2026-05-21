<script lang="ts">
  import { ArrowRight } from 'lucide-svelte';
</script>

<section class="relative min-h-[100vh] w-full flex items-end overflow-hidden">
  <!-- Background placeholder gradient (image will be /images/hero/maeve.webp once generated) -->
  <div class="absolute inset-0 -z-10">
    <div class="absolute inset-0 bg-gradient-to-br from-[#2a1d14] via-[#0A0A0A] to-[#0A0A0A]"></div>
    <div class="absolute inset-0 opacity-40 mix-blend-overlay" style="background-image: radial-gradient(ellipse at 30% 70%, rgba(232, 168, 87, 0.35) 0%, transparent 55%), radial-gradient(ellipse at 70% 30%, rgba(201, 166, 107, 0.18) 0%, transparent 50%);"></div>
    <div class="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_60%,rgba(0,0,0,0.9)_100%)]"></div>
    <div class="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black-deep via-black-deep/70 to-transparent"></div>
  </div>

  <div class="container-narrow pb-16 md:pb-24 pt-24 w-full">
    <span class="inline-block text-[10px] md:text-xs uppercase tracking-[0.25em] text-amber-accent font-semibold mb-6">
      PawsCo Rescue Initiative
    </span>
    <h1 class="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight text-balance max-w-3xl">
      Last week, Maeve was eating from a garbage bag.
    </h1>
    <p class="mt-6 text-lg md:text-xl text-muted leading-relaxed max-w-2xl text-balance">
      Today she has a home. <span class="text-snow">47 dogs in our partner shelters are still waiting.</span>
    </p>

    <div class="mt-10 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
      <a
        href="#tiers"
        class="inline-flex items-center justify-center gap-2 bg-amber-accent text-black-deep font-semibold px-7 py-4 rounded-xl hover:bg-copper transition-all hover:scale-[1.02] shadow-soft text-base"
      >
        Help feed them tonight
        <ArrowRight size={18} />
      </a>
      <span class="text-sm text-muted">
        From <span class="font-display text-snow">EUR 10</span>. One-time. No subscription.
      </span>
    </div>
  </div>
</section>
