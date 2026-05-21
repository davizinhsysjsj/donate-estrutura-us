<script lang="ts">
  import { TIERS } from '$lib/data/tiers';
  import { ArrowRight, Sparkles } from 'lucide-svelte';
  import { cn } from '$lib/utils/cn';
</script>

<section id="tiers" class="py-20 md:py-32 scroll-mt-10">
  <div class="container-narrow">
    <div class="text-center max-w-2xl mx-auto">
      <h2 class="font-serif text-3xl sm:text-4xl md:text-5xl font-bold leading-tight tracking-tight text-balance">
        Pick your bundle. Feed a paw tonight.
      </h2>
      <p class="mt-4 text-base md:text-lg text-muted text-balance">
        Every contribution comes with a digital supporter bundle and a personalized impact report.
      </p>
    </div>

    <div class="mt-12 md:mt-16 -mx-6 md:mx-0">
      <div class="flex md:grid md:grid-cols-5 gap-4 md:gap-5 overflow-x-auto md:overflow-visible px-6 md:px-0 pb-4 md:pb-0 hide-scrollbar snap-x snap-mandatory">
        {#each TIERS as tier}
          <a
            href={`/supporter?tier=${tier.amount}`}
            class={cn(
              'group relative flex-shrink-0 w-[78vw] sm:w-[50vw] md:w-auto snap-center bg-warm-charcoal/60 border rounded-2xl p-6 flex flex-col transition-all hover:-translate-y-1 hover:shadow-soft',
              tier.featured
                ? 'border-amber-accent/60 bg-gradient-to-b from-amber-accent/8 to-warm-charcoal/60 md:scale-[1.04]'
                : 'border-white/5 hover:border-amber-accent/30'
            )}
          >
            {#if tier.badge}
              <span class="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 bg-copper text-black-deep text-[10px] uppercase tracking-[0.18em] font-bold px-3 py-1 rounded-full whitespace-nowrap">
                <Sparkles size={11} />
                {tier.badge}
              </span>
            {/if}

            <div class="text-xs uppercase tracking-[0.22em] text-muted font-semibold">{tier.name}</div>
            <div class="mt-4 flex items-baseline gap-1.5">
              <span class="text-xs font-medium text-muted">EUR</span>
              <span class="font-display text-5xl md:text-6xl font-bold text-snow leading-none tracking-tight">{tier.amount}</span>
            </div>

            <p class="mt-5 text-sm font-medium text-snow leading-snug">{tier.feeds}</p>
            <p class="mt-2 text-xs text-muted leading-relaxed flex-1">{tier.bonuses}</p>

            <div
              class={cn(
                'mt-6 inline-flex items-center justify-center gap-2 font-semibold rounded-xl px-4 py-3 transition-colors text-sm',
                tier.featured
                  ? 'bg-amber-accent text-black-deep group-hover:bg-copper'
                  : 'bg-white/5 text-snow group-hover:bg-amber-accent group-hover:text-black-deep'
              )}
            >
              Choose
              <ArrowRight size={15} class="group-hover:translate-x-0.5 transition-transform" />
            </div>
          </a>
        {/each}
      </div>
    </div>

    <p class="mt-8 text-center text-xs text-muted max-w-md mx-auto">
      Secure checkout · One-time payment · 30-day refund · Tax receipt available on request
    </p>
  </div>
</section>
