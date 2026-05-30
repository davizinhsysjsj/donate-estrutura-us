<script lang="ts">
  import { goto } from '$app/navigation';
  import { CAMPAIGN } from '$lib/data/campaign';

  function donate() {
    goto('/donate');
  }

  function leave() {
    // Tenta voltar pra página anterior fora do site; fallback: fecha a aba
    if (window.history.length > 2) {
      window.history.go(-2);
    } else {
      window.close();
    }
  }
</script>

<svelte:head>
  <title>Wacht even | {CAMPAIGN.brand}</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="wacht-page">
  <header class="wacht-header">
    <img src="/logo.webp" alt="PawsCo" class="wacht-logo" />
  </header>

  <main class="wacht-main">

    <!-- Emotionele opening -->
    <div class="wacht-paw">🐾</div>
    <h1 class="wacht-title">Je gaat weg zonder te doneren.</h1>
    <p class="wacht-lead">
      Dat is oké. Maar laat ons je eerst iets vertellen over <strong>Loki</strong>.
    </p>

    <!-- Verhaal card -->
    <div class="wacht-story">
      <div class="wacht-story-header">
        <div class="wacht-dog-avatar">🐕</div>
        <div>
          <strong>Loki, 9 jaar</strong>
          <span>Herder — 3 jaar in het opvang</span>
        </div>
      </div>
      <p>
        Loki werd achtergelaten toen hij 6 was. Sindsdien wacht hij elke dag op iemand
        die hem mee naar huis neemt. Het opvangcentrum kan hem voeden dankzij donaties
        van mensen zoals jij.
      </p>
      <p>
        <strong>€10</strong> — één pizza, één koffie met gebak — voedt Loki
        en een katje gedurende een hele week.
      </p>
    </div>

    <!-- Impact-stats -->
    <div class="wacht-stats">
      <div class="wacht-stat">
        <span class="wacht-stat-val">€4,20</span>
        <span class="wacht-stat-label">voedt 1 dier 1 week</span>
      </div>
      <div class="wacht-stat">
        <span class="wacht-stat-val">88%</span>
        <span class="wacht-stat-label">gaat naar de dieren</span>
      </div>
      <div class="wacht-stat">
        <span class="wacht-stat-val">2.847</span>
        <span class="wacht-stat-label">dieren geholpen</span>
      </div>
    </div>

    <!-- Social proof -->
    <p class="wacht-proof">
      <span class="wacht-proof-dot"></span>
      412 mensen doneerden al deze maand. Jij kunt het verschil maken voor dier #413.
    </p>

    <!-- CTA -->
    <button class="wacht-cta" onclick={donate}>
      Ik doneer €10 voor Loki →
    </button>

    <div class="wacht-amounts">
      <button class="wacht-amount-btn" onclick={() => goto('/donate?amount=5')}>€5</button>
      <button class="wacht-amount-btn" onclick={() => goto('/donate?amount=15')}>€15</button>
      <button class="wacht-amount-btn" onclick={() => goto('/donate?amount=25')}>€25</button>
    </div>

    <p class="wacht-safe">🔒 Veilige betaling · Eenmalig · Geen abonnement</p>

    <!-- Toch weggaan -->
    <!-- svelte-ignore a11y_invalid_attribute -->
    <button class="wacht-leave" onclick={leave}>
      Nee, ik wil toch weggaan
    </button>

  </main>
</div>

<style>
  .wacht-page {
    min-height: 100vh;
    background: #fff;
    font-family: var(--font, 'Inter', sans-serif);
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .wacht-header {
    padding: 18px 20px;
    width: 100%;
    display: flex;
    justify-content: center;
    border-bottom: 1px solid #f0f0f0;
  }
  .wacht-logo { height: 32px; object-fit: contain; }

  .wacht-main {
    max-width: 480px;
    width: 100%;
    padding: 40px 20px 60px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
  }

  .wacht-paw {
    font-size: 3rem;
    line-height: 1;
    margin-bottom: 16px;
    animation: bounce 0.6s ease;
  }
  @keyframes bounce {
    0% { transform: scale(0.5); opacity: 0; }
    70% { transform: scale(1.15); }
    100% { transform: scale(1); opacity: 1; }
  }

  .wacht-title {
    font-size: 1.75rem;
    font-weight: 800;
    color: #1a1a1a;
    letter-spacing: -0.02em;
    line-height: 1.2;
    margin: 0 0 10px;
  }

  .wacht-lead {
    font-size: 1.0625rem;
    color: #555;
    line-height: 1.55;
    margin: 0 0 28px;
  }
  .wacht-lead strong { color: #1a1a1a; }

  /* Story card */
  .wacht-story {
    background: #f9f9f7;
    border: 1px solid #e8e8e8;
    border-radius: 16px;
    padding: 20px;
    text-align: left;
    width: 100%;
    margin-bottom: 24px;
  }
  .wacht-story-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
  }
  .wacht-dog-avatar {
    font-size: 2.25rem;
    line-height: 1;
    background: #f0f8f4;
    border-radius: 50%;
    width: 52px;
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .wacht-story-header strong {
    display: block;
    font-size: 1rem;
    font-weight: 700;
    color: #1a1a1a;
    margin-bottom: 2px;
  }
  .wacht-story-header span {
    font-size: 0.8125rem;
    color: #888;
  }
  .wacht-story p {
    font-size: 0.9375rem;
    color: #444;
    line-height: 1.65;
    margin: 0 0 10px;
  }
  .wacht-story p:last-child { margin-bottom: 0; }
  .wacht-story strong { color: #02A95C; font-weight: 700; }

  /* Stats */
  .wacht-stats {
    display: flex;
    gap: 10px;
    width: 100%;
    margin-bottom: 20px;
  }
  .wacht-stat {
    flex: 1;
    background: #f9f9f7;
    border: 1px solid #e8e8e8;
    border-radius: 12px;
    padding: 12px 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
  }
  .wacht-stat-val {
    font-size: 1.25rem;
    font-weight: 800;
    color: #02A95C;
    letter-spacing: -0.02em;
  }
  .wacht-stat-label {
    font-size: 0.6875rem;
    color: #777;
    text-align: center;
    line-height: 1.3;
  }

  /* Social proof */
  .wacht-proof {
    font-size: 0.875rem;
    color: #555;
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 24px;
  }
  .wacht-proof-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #02A95C;
    flex-shrink: 0;
    animation: pulse 1.5s infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.6; transform: scale(0.85); }
  }

  /* CTA */
  .wacht-cta {
    display: block;
    width: 100%;
    background: #02A95C;
    color: #fff;
    border: none;
    border-radius: 14px;
    padding: 17px 20px;
    font-size: 1.0625rem;
    font-weight: 700;
    cursor: pointer;
    margin-bottom: 12px;
    transition: background 0.15s;
    letter-spacing: -0.01em;
  }
  .wacht-cta:hover { background: #008F4C; }

  .wacht-amounts {
    display: flex;
    gap: 10px;
    width: 100%;
    margin-bottom: 14px;
  }
  .wacht-amount-btn {
    flex: 1;
    background: #f0f8f4;
    color: #02A95C;
    border: 1.5px solid #02A95C;
    border-radius: 10px;
    padding: 11px 8px;
    font-size: 0.9375rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.12s;
  }
  .wacht-amount-btn:hover { background: #ddf2e8; }

  .wacht-safe {
    font-size: 0.8125rem;
    color: #888;
    margin: 0 0 28px;
  }

  /* Leave link */
  .wacht-leave {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.8125rem;
    color: #bbb;
    text-decoration: underline;
    padding: 4px;
  }
  .wacht-leave:hover { color: #888; }
</style>
