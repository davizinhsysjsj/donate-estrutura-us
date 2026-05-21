<script lang="ts">
  import { Heart, Truck, Mail } from 'lucide-svelte';

  const steps = [
    { icon: Heart, title: 'Choose a Supporter Bundle', body: 'Pick the impact level that feels right. From a starter pack to a guardian role — every bundle includes a digital reward.' },
    { icon: Truck, title: 'Funds reach shelters within 7 days', body: 'No bureaucracy. We wire directly to partner rescues, prioritized by urgency and need on the ground.' },
    { icon: Mail, title: 'You get the impact report + your bundle', body: 'A real update with photos, names, and outcomes — plus your digital supporter rewards delivered to your inbox.' }
  ];
</script>

<section class="py-20 md:py-28">
  <div class="container-narrow">
    <div class="text-center max-w-2xl mx-auto">
      <h2 class="font-serif text-3xl sm:text-4xl md:text-5xl font-bold leading-tight tracking-tight text-balance">
        How your support works.
      </h2>
      <p class="mt-4 text-base md:text-lg text-muted text-balance">
        Simple, transparent, fast. From your card to a dog's bowl in under a week.
      </p>
    </div>

    <div class="mt-12 md:mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
      {#each steps as step, i}
        <div class="bg-warm-charcoal/50 border border-white/5 rounded-2xl p-7 md:p-8 hover:border-amber-accent/30 transition-colors">
          <div class="w-12 h-12 rounded-xl bg-amber-accent/10 text-amber-accent flex items-center justify-center mb-6">
            <step.icon size={22} />
          </div>
          <div class="text-xs uppercase tracking-[0.2em] text-muted mb-2">Step 0{i + 1}</div>
          <h3 class="font-serif text-xl md:text-2xl font-semibold text-snow leading-snug">
            {step.title}
          </h3>
          <p class="mt-3 text-sm md:text-base text-muted leading-relaxed">
            {step.body}
          </p>
        </div>
      {/each}
    </div>
  </div>
</section>
