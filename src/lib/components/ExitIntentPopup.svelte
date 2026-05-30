<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  interface Props {
    onDonate: () => void;
  }
  const { onDonate }: Props = $props();

  let visible = $state(false);
  let dismissed = $state(false);

  function handleMouseLeave(e: MouseEvent) {
    // Só dispara se o cursor sair pelo topo da janela (indo pra barra de endereço)
    if (e.clientY <= 5 && !dismissed) {
      visible = true;
      dismissed = true; // dispara só 1x por sessão
      document.removeEventListener('mouseleave', handleMouseLeave);
    }
  }

  onMount(() => {
    // Espera 8s antes de ativar (não dispara logo no carregamento)
    const timer = setTimeout(() => {
      document.addEventListener('mouseleave', handleMouseLeave);
    }, 8000);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  });

  function close() {
    visible = false;
  }

  function handleDonate() {
    visible = false;
    onDonate();
  }
</script>

{#if visible}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="exit-overlay" onclick={close}>
    <div class="exit-popup" role="dialog" aria-modal="true" onclick={(e) => e.stopPropagation()}>
      <button class="exit-close" onclick={close} aria-label="Sluiten">✕</button>

      <div class="exit-icon">🐾</div>
      <h2 class="exit-title">Wacht — Loki heeft je nodig.</h2>
      <p class="exit-body">
        Voor slechts <strong>€10</strong> voed je vanavond 2 opvangdieren.<br />
        Eenmalig. Geen abonnement. 88% gaat rechtstreeks naar de dieren.
      </p>

      <button class="exit-cta" onclick={handleDonate}>
        Ik doneer €10 voor Loki
      </button>

      <button class="exit-skip" onclick={close}>Nee, ik ga weg</button>
    </div>
  </div>
{/if}

<style>
  .exit-overlay {
    position: fixed; inset: 0; z-index: 9999;
    background: rgba(0,0,0,0.55); backdrop-filter: blur(3px);
    display: flex; align-items: center; justify-content: center;
    padding: 20px;
    animation: fadeIn 0.2s ease;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

  .exit-popup {
    background: #fff; border-radius: 20px;
    padding: 32px 28px 24px; max-width: 360px; width: 100%;
    text-align: center; position: relative;
    box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    animation: slideUp 0.25s ease;
  }
  @keyframes slideUp { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

  .exit-close {
    position: absolute; top: 14px; right: 16px;
    background: none; border: none; cursor: pointer;
    font-size: 1rem; color: #aaa; line-height: 1;
  }
  .exit-close:hover { color: #333; }

  .exit-icon { font-size: 2.5rem; margin-bottom: 10px; line-height: 1; }

  .exit-title {
    font-size: 1.25rem; font-weight: 800; color: #1a1a1a;
    margin: 0 0 10px; line-height: 1.3;
  }

  .exit-body {
    font-size: 0.9375rem; color: #444; line-height: 1.55;
    margin: 0 0 22px;
  }
  .exit-body strong { color: #02A95C; font-weight: 700; }

  .exit-cta {
    display: block; width: 100%;
    background: #02A95C; color: #fff; border: none; border-radius: 12px;
    padding: 15px 20px; font-size: 1rem; font-weight: 700; cursor: pointer;
    margin-bottom: 12px;
    transition: background 0.15s;
  }
  .exit-cta:hover { background: #008F4C; }

  .exit-skip {
    background: none; border: none; cursor: pointer;
    font-size: 0.8125rem; color: #aaa; text-decoration: underline;
    padding: 4px;
  }
  .exit-skip:hover { color: #666; }
</style>
