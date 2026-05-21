<script lang="ts">
  const partners = [
    { name: 'Galway Paw Haven', location: 'Galway' },
    { name: 'Cork Tails Sanctuary', location: 'Cork' },
    { name: 'Dublin Hope Kennel', location: 'Dublin' },
    { name: 'Limerick Rescue Co-op', location: 'Limerick' },
    { name: 'Donegal Stray Project', location: 'Donegal' }
  ];

  const testimonials = [
    { initials: 'S.M.', color: 'bg-amber-accent/15 text-amber-accent', name: 'Siobhan M.', city: 'Dublin', quote: '“Got the report two weeks later with a photo of the dog I helped. Made me cry. Worth every cent.”' },
    { initials: 'D.O.', color: 'bg-copper/15 text-copper', name: 'Declan O.', city: 'Cork', quote: '“Transparent, no monthly nag, no guilt-trip emails. I came back twice on my own.”' },
    { initials: 'A.K.', color: 'bg-urgency-red/15 text-urgency-red', name: 'Aoife K.', city: 'Galway', quote: '“Met one of the shelter coordinators at a fundraiser. The money really is reaching the dogs.”' }
  ];

  const faqs = [
    {
      q: 'Where does my money go?',
      a: '88 cents of every euro reaches feeding and medical care on the ground. The rest covers card processing fees. We publish a quarterly transparency report.'
    },
    {
      q: 'Are you a registered charity?',
      a: 'PawsCo Rescue is a grassroots fundraising initiative supporting verified rescue partners. We are not a registered Irish charity — we operate as a transparent for-cause campaign.'
    },
    {
      q: 'Can I get a refund?',
      a: 'Yes — full refund within 30 days, no questions asked. Email hello@pawsco.com and we will process it within 48 hours.'
    }
  ];
</script>

<section id="trust" class="py-20 md:py-28 bg-warm-charcoal/40 border-y border-white/5">
  <div class="container-narrow">
    <div class="text-center max-w-2xl mx-auto mb-12 md:mb-16">
      <h2 class="font-serif text-3xl sm:text-4xl md:text-5xl font-bold leading-tight tracking-tight text-balance">
        Trust is earned. Here's ours.
      </h2>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-10">
      <div>
        <h3 class="text-xs uppercase tracking-[0.2em] text-amber-accent font-semibold mb-5">Our partner shelters</h3>
        <ul class="space-y-3">
          {#each partners as p}
            <li class="bg-black-deep/60 border border-white/5 rounded-xl px-4 py-3 flex items-baseline justify-between gap-3 hover:border-amber-accent/30 transition-colors">
              <span class="text-sm font-medium text-snow leading-snug">{p.name}</span>
              <span class="text-[10px] uppercase tracking-[0.15em] text-muted shrink-0">{p.location}</span>
            </li>
          {/each}
        </ul>
      </div>

      <div>
        <h3 class="text-xs uppercase tracking-[0.2em] text-amber-accent font-semibold mb-5">What supporters say</h3>
        <ul class="space-y-4">
          {#each testimonials as t}
            <li class="bg-black-deep/60 border border-white/5 rounded-xl p-5">
              <div class="flex items-center gap-3 mb-3">
                <div class="w-10 h-10 rounded-full {t.color} flex items-center justify-center text-xs font-bold tracking-tight">
                  {t.initials}
                </div>
                <div>
                  <div class="text-sm font-medium text-snow leading-tight">{t.name}</div>
                  <div class="text-[10px] uppercase tracking-[0.15em] text-muted mt-0.5">{t.city}</div>
                </div>
              </div>
              <p class="text-sm text-muted leading-relaxed">{t.quote}</p>
            </li>
          {/each}
        </ul>
      </div>

      <div>
        <h3 class="text-xs uppercase tracking-[0.2em] text-amber-accent font-semibold mb-5">Common questions</h3>
        <ul class="space-y-3">
          {#each faqs as f}
            <li class="bg-black-deep/60 border border-white/5 rounded-xl p-5">
              <div class="text-sm font-semibold text-snow mb-2 leading-snug">{f.q}</div>
              <p class="text-sm text-muted leading-relaxed">{f.a}</p>
            </li>
          {/each}
        </ul>
      </div>
    </div>
  </div>
</section>
