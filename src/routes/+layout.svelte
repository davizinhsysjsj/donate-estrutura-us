<script lang="ts">
  import '../app.css';

  let { children } = $props();
  // Pixel Meta inicializado inline em app.html — dispara antes da hidratação JS
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
