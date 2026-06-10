<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { initAnalytics, trackPageview, reattachSectionsOnNavigate } from '$lib/utils/analytics';

  let { children } = $props();
  // Pixel Meta inicializado inline em app.html — dispara antes da hidratação JS

  onMount(() => {
    if (window.location.pathname.startsWith('/dashboard')) return;
    // Adia init de analytics pra nao competir com hidratacao + carregamento
    // de assets criticos (hero, video poster). requestIdleCallback se disponivel,
    // fallback pra setTimeout pra Safari/iOS.
    const ric: (cb: () => void) => void =
      (window as unknown as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback ??
      ((cb) => setTimeout(cb, 1200));
    ric(() => initAnalytics());
  });

  // Re-trackeia a cada navegacao client-side
  $effect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.pathname.startsWith('/dashboard')) return;
    const _ = page.url.pathname;
    trackPageview();
    // Aguarda DOM novo montar, re-anexa observers de secao
    requestAnimationFrame(() => reattachSectionsOnNavigate());
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
