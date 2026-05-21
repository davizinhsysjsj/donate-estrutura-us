<script lang="ts">
  import { ArrowRight } from 'lucide-svelte';
</script>

<section class="relative min-h-[90vh] md:min-h-[100vh] flex items-center overflow-hidden">
  <div class="absolute inset-0 -z-10">
    <div class="absolute inset-0 bg-gradient-to-tr from-[#2a1d14] via-[#0f0c0a] to-black-deep"></div>
    <div class="absolute inset-0 opacity-50" style="background-image: radial-gradient(ellipse at 70% 40%, rgba(232, 168, 87, 0.32) 0%, transparent 55%);"></div>
    <div class="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.45)_60%,rgba(0,0,0,0.95)_100%)]"></div>
  </div>

  <div class="container-narrow py-20 md:py-32 w-full text-center">
    <span class="inline-block text-[10px] md:text-xs uppercase tracking-[0.25em] text-urgency-red font-semibold mb-6 animate-pulse">
      Tonight
    </span>
    <h2 class="font-serif text-4xl sm:text-5xl md:text-7xl font-bold leading-[1.05] tracking-tight text-balance max-w-3xl mx-auto">
      47 dogs are waiting tonight.
    </h2>
    <p class="mt-6 text-lg md:text-2xl text-muted text-balance max-w-2xl mx-auto">
      You can help one of them right now.
    </p>

    <div class="mt-10 md:mt-12 flex justify-center">
      <a
        href="#tiers"
        class="inline-flex items-center justify-center gap-2 bg-urgency-red text-snow font-semibold px-8 md:px-10 py-4 md:py-5 rounded-xl hover:bg-amber-accent hover:text-black-deep transition-all hover:scale-[1.02] shadow-soft text-base md:text-lg"
      >
        Yes, I want to help
        <ArrowRight size={20} />
      </a>
    </div>

    <p class="mt-8 text-sm text-muted">From EUR 10 · One-time · 30-day refund</p>
  </div>
</section>
