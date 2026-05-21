<script lang="ts">
  const stats = [
    { value: '2,847', label: 'dogs waiting in partner shelters' },
    { value: '12', label: 'rescue partners across Ireland' },
    { value: 'EUR 4.20', label: 'feeds one dog for a week' },
    { value: '0%', label: 'donations lost to admin overhead' }
  ];
</script>

<section class="bg-warm-charcoal/60 border-y border-white/5 py-20 md:py-28">
  <div class="container-narrow">
    <h2 class="font-serif text-3xl sm:text-4xl md:text-5xl font-bold leading-tight tracking-tight text-balance max-w-2xl">
      The situation, in numbers.
    </h2>
    <p class="mt-4 text-base md:text-lg text-muted max-w-xl">
      Every euro tracked, reported, and accounted for. No middlemen, no offshore foundations.
    </p>

    <div class="mt-12 md:mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
      {#each stats as stat}
        <div class="bg-black-deep/60 rounded-2xl p-6 md:p-8 border border-white/5 hover:border-amber-accent/30 transition-colors">
          <div class="font-display text-4xl sm:text-5xl md:text-6xl font-bold text-amber-accent leading-none tracking-tight">
            {stat.value}
          </div>
          <div class="mt-3 text-sm text-muted leading-snug">
            {stat.label}
          </div>
        </div>
      {/each}
    </div>
  </div>
</section>
