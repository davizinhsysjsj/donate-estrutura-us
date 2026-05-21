<script lang="ts">
  import '../app.css';
  let { children } = $props();
</script>

<svelte:head>
  <title>PawsCo Rescue — Help feed dogs in Irish shelters tonight</title>
  <meta name="description" content="Help feed rescue dogs in Irish partner shelters. From EUR 10. One-time. No subscription." />
  <meta name="referrer" content="no-referrer" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
</svelte:head>

{@render children()}
