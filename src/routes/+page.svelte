<script lang="ts">
  // Raiz "/" — nao recebe trafego direto.
  // Trafego de ads vai todo pra /vsl. Aqui mostramos apenas um popup
  // "voltamos ja" (NL: "We zijn zo terug") para visitantes diretos.
</script>

<svelte:head>
  <title>We zijn zo terug | Belgische Dierenopvang</title>
  <meta name="referrer" content="no-referrer" />
  <meta name="robots" content="noindex,nofollow" />
</svelte:head>

<div class="brb-page">
  <div class="brb-card" role="dialog" aria-modal="true" aria-labelledby="brb-title">
    <div class="brb-spinner" aria-hidden="true">
      <div class="brb-paw">🐾</div>
    </div>
    <h1 id="brb-title" class="brb-title">We zijn zo terug</h1>
    <p class="brb-text">
      Onze website wordt op dit moment bijgewerkt.<br />
      Kom binnenkort terug — de dieren wachten op jouw steun. ❤️
    </p>
    <p class="brb-sub">Bedankt voor je geduld.</p>
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    background: #0d1117;
    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .brb-page {
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background:
      radial-gradient(1200px 600px at 50% -10%, rgba(255, 76, 76, 0.18), transparent 60%),
      radial-gradient(800px 400px at 50% 110%, rgba(76, 175, 255, 0.12), transparent 60%),
      #0d1117;
  }

  .brb-card {
    width: 100%;
    max-width: 460px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 24px;
    padding: 44px 28px 36px;
    text-align: center;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
    animation: brb-in 420ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes brb-in {
    from { opacity: 0; transform: translateY(12px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  .brb-spinner {
    width: 84px;
    height: 84px;
    margin: 0 auto 22px;
    border-radius: 50%;
    background: linear-gradient(135deg, #ff4c4c 0%, #ff8a3d 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    animation: brb-pulse 1.8s ease-in-out infinite;
    box-shadow: 0 8px 24px rgba(255, 76, 76, 0.35);
  }

  @keyframes brb-pulse {
    0%, 100% { transform: scale(1); box-shadow: 0 8px 24px rgba(255, 76, 76, 0.35); }
    50%      { transform: scale(1.06); box-shadow: 0 12px 32px rgba(255, 76, 76, 0.5); }
  }

  .brb-paw {
    font-size: 40px;
    line-height: 1;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
  }

  .brb-title {
    font-size: 28px;
    font-weight: 700;
    margin: 0 0 14px;
    color: #fff;
    letter-spacing: -0.02em;
  }

  .brb-text {
    font-size: 16px;
    line-height: 1.55;
    color: rgba(255, 255, 255, 0.78);
    margin: 0 0 18px;
  }

  .brb-sub {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.5);
    margin: 0;
  }

  @media (max-width: 480px) {
    .brb-card { padding: 36px 22px 28px; }
    .brb-title { font-size: 24px; }
    .brb-text  { font-size: 15px; }
    .brb-spinner { width: 72px; height: 72px; }
    .brb-paw { font-size: 34px; }
  }
</style>
