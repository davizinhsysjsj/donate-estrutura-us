<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    onDonate: () => void;
    onBack?: () => void;
  }
  const { onDonate, onBack }: Props = $props();

  let visible = $state(false);
  let dismissed = $state(false);
  let wasBackPress = $state(false);

  const INACTIVITY_MS = 5 * 60 * 1000; // 5 minutos
  let inactivityTimer: ReturnType<typeof setTimeout>;

  export function triggerBackExit() {
    if (dismissed) { onBack?.(); return; }
    clearTimeout(inactivityTimer);
    wasBackPress = true;
    dismissed = true;
    visible = true;
  }

  function show() {
    if (dismissed) return;
    dismissed = true;
    visible = true;
  }

  function resetInactivity() {
    clearTimeout(inactivityTimer);
    if (!dismissed) inactivityTimer = setTimeout(show, INACTIVITY_MS);
  }

  onMount(() => {
    resetInactivity();
    const opts = { passive: true };
    window.addEventListener('click',      resetInactivity, opts);
    window.addEventListener('keydown',    resetInactivity, opts);
    window.addEventListener('touchstart', resetInactivity, opts);
    window.addEventListener('scroll',     resetInactivity, opts);
    window.addEventListener('mousemove',  resetInactivity, opts);

    return () => {
      clearTimeout(inactivityTimer);
      window.removeEventListener('click',      resetInactivity);
      window.removeEventListener('keydown',    resetInactivity);
      window.removeEventListener('touchstart', resetInactivity);
      window.removeEventListener('scroll',     resetInactivity);
      window.removeEventListener('mousemove',  resetInactivity);
    };
  });

  function close() {
    visible = false;
    if (wasBackPress) onBack?.();
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
      <button class="exit-close" onclick={close} aria-label="Cerrar">✕</button>

      <div class="exit-icon">🐾</div>
      <h2 class="exit-title">Espera — Loki te necesita.</h2>
      <p class="exit-body">
        Por sólo <strong>€10</strong> alimentas esta noche a 2 animales rescatados.<br />
        Una sola vez. Sin suscripción. 88% va directamente a los animales.
      </p>

      <button class="exit-cta" onclick={handleDonate}>
        Dono €10 por Loki
      </button>

      <button class="exit-skip" onclick={close}>No, salir</button>
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
