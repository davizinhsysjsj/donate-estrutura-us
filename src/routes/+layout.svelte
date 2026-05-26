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
  <title>Help feed Belgian rescue animals tonight | PawsCo</title>
  <meta
    name="description"
    content="Help us feed rescue animals in our Belgian partner shelters tonight. From EUR 10. One-time. No subscription."
  />
  <meta name="referrer" content="no-referrer" />
</svelte:head>

{@render children()}
