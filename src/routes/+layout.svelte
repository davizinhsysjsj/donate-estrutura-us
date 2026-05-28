<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { trackPageview, startHeartbeat, attachScrollDepth } from '$lib/utils/analytics';

  let { children } = $props();
  // Pixel Meta inicializado inline em app.html — dispara antes da hidratação JS

  onMount(() => {
    // Nao trackear o proprio dashboard (sujaria os dados)
    if (window.location.pathname.startsWith('/dashboard')) return;
    trackPageview();
    startHeartbeat();
    attachScrollDepth();
  });

  // SvelteKit SPA — re-dispara pageview a cada navegacao client-side
  $effect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.pathname.startsWith('/dashboard')) return;
    // page.url muda → trackeia
    const _ = page.url.pathname;
    trackPageview();
  });
</script>

<svelte:head>
  <title>Help vanavond Belgische opvangdieren te voeden | PawsCo</title>
  <meta
    name="description"
    content="Help ons vanavond opvangdieren te voeden in onze Belgische partneropvangen. Vanaf EUR 10. Eenmalig. Geen abonnement."
  />
  <meta name="referrer" content="no-referrer" />
</svelte:head>

{@render children()}
