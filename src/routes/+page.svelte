<script lang="ts">
  import Hero from '$lib/components/funnel/Hero.svelte';
  import Story from '$lib/components/funnel/Story.svelte';
  import Stats from '$lib/components/funnel/Stats.svelte';
  import HowItWorks from '$lib/components/funnel/HowItWorks.svelte';
  import Tiers from '$lib/components/funnel/Tiers.svelte';
  import Trust from '$lib/components/funnel/Trust.svelte';
  import Urgency from '$lib/components/funnel/Urgency.svelte';
  import Footer from '$lib/components/Footer.svelte';
</script>

<main class="min-h-screen bg-black-deep text-snow">
  <Hero />
  <Story />
  <Stats />
  <HowItWorks />
  <Tiers />
  <Trust />
  <Urgency />
  <Footer />
</main>
