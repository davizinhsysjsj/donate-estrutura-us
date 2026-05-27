<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { META_PIXEL_ID } from '$lib/utils/fbtracking';

  let { children } = $props();

  // Carrega Meta Pixel apenas no client, depois do hydrate, pra nao quebrar SSR
  onMount(() => {
    const w = window as unknown as {
      fbq?: (...args: unknown[]) => void;
      _fbq?: unknown;
    };
    if (w.fbq) return; // ja carregado

    const stub: any = function (...args: unknown[]) {
      stub.callMethod ? stub.callMethod.apply(stub, args) : stub.queue.push(args);
    };
    stub.push = stub;
    stub.loaded = true;
    stub.version = '2.0';
    stub.queue = [];
    w.fbq = stub;
    w._fbq = stub;

    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(s);

    stub('init', META_PIXEL_ID);
    stub('track', 'PageView');
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
