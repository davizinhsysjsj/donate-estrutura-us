<script lang="ts">
  import '../app.css';
  let { children } = $props();
</script>

<svelte:head>
  <title>Help feed Irish rescue dogs tonight | PawsCo Rescue</title>
  <meta
    name="description"
    content="Help us feed rescue dogs in our Irish partner shelters tonight. From EUR 10. One-time. No subscription."
  />
  <meta name="referrer" content="no-referrer" />
</svelte:head>

{@render children()}
