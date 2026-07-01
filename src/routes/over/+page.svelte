<script lang="ts">
  import { CAMPAIGN } from '$lib/data/campaign';
</script>

<svelte:head>
  <title>Over ons | {CAMPAIGN.brand}</title>
  <meta name="description" content="Wie zijn wij? Leer meer over PawsCo, onze missie en hoe uw donaties de Belgische opvangdieren bereiken." />
</svelte:head>

<div class="over-page">
  <header class="over-header">
    <a href="/" class="over-back">← Terug naar campagne</a>
    <div class="over-logo-wrap">
      <img src="/logo.webp" alt="PawsCo" class="over-logo" />
    </div>
  </header>

  <main class="over-main">
    <!-- Hero -->
    <section class="over-hero">
      <h1>Over PawsCo</h1>
      <p class="over-lead">
        Wij zijn een Belgisch initiatief dat opvangcentra steunt met voeding, verzorging en middelen
        die ze zelf niet kunnen bekostigen.
      </p>
    </section>

    <!-- Missie -->
    <section class="over-section">
      <h2>Onze missie</h2>
      <p>
        Elk jaar komen duizenden honden en katten terecht in Belgische opvangcentra. Veel van deze
        centra zijn afhankelijk van vrijwilligers en donaties — zonder steun kunnen ze de dieren
        niet voldoende voeden of verzorgen.
      </p>
      <p>
        PawsCo brengt donateurs rechtstreeks in contact met partner-opvangcentra in heel België.
        We zorgen voor transparantie: u weet altijd waar uw geld naartoe gaat.
      </p>
    </section>

    <!-- Hoe werkt het -->
    <section class="over-section">
      <h2>Hoe werkt uw donatie?</h2>
      <div class="over-steps">
        <div class="over-step">
          <div class="over-step-num">1</div>
          <div>
            <strong>U doneert online</strong>
            <p>Veilige betaling via Visa, Mastercard of Bancontact. Eenmalig, geen abonnement.</p>
          </div>
        </div>
        <div class="over-step">
          <div class="over-step-num">2</div>
          <div>
            <strong>Wij verwerken binnen 24u</strong>
            <p>88% van elk bedrag gaat rechtstreeks naar voedsel en verzorging voor de dieren.</p>
          </div>
        </div>
        <div class="over-step">
          <div class="over-step-num">3</div>
          <div>
            <strong>U ontvangt een bevestiging</strong>
            <p>U krijgt een betalingsbewijs per e-mail, plus een update over hoe uw donatie is gebruikt.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Verdeling -->
    <section class="over-section over-verdeling">
      <h2>Verdeling van de donaties</h2>
      <div class="over-bars">
        <div class="over-bar-item">
          <div class="over-bar-label">
            <span>Voeding & verzorging dieren</span>
            <strong>88%</strong>
          </div>
          <div class="over-bar-bg">
            <div class="over-bar-fill" style="width: 88%"></div>
          </div>
        </div>
        <div class="over-bar-item">
          <div class="over-bar-label">
            <span>Operationele kosten</span>
            <strong>8%</strong>
          </div>
          <div class="over-bar-bg">
            <div class="over-bar-fill over-bar-muted" style="width: 8%"></div>
          </div>
        </div>
        <div class="over-bar-item">
          <div class="over-bar-label">
            <span>Communicatie & platform</span>
            <strong>4%</strong>
          </div>
          <div class="over-bar-bg">
            <div class="over-bar-fill over-bar-muted" style="width: 4%"></div>
          </div>
        </div>
      </div>
    </section>

    <!-- Organisator -->
    <section class="over-section over-organizer">
      <h2>De organisator</h2>
      <div class="over-org-card">
        <div class="over-org-avatar">AM</div>
        <div class="over-org-info">
          <strong>Aoife Murphy</strong>
          <span>Oprichter, PawsCo — Antwerpen, België</span>
          <p>
            "Ik ben begonnen met PawsCo nadat ik zag hoe kleine opvangcentra moeite hadden om
            de maandelijkse voedselrekeningen te betalen. Met een paar tientjes per persoon kunnen
            we samen honderden dieren een veilige winter geven."
          </p>
        </div>
      </div>
    </section>

    <!-- Partner opvangen -->
    <section class="over-section">
      <h2>Onze partneropvangen</h2>
      <p>
        Wij werken samen met <strong>12 erkende opvangcentra</strong> verspreid over heel België —
        van Antwerpen en Gent tot Luik en Namen. Elk centrum wordt jaarlijks geëvalueerd op
        dierenwelzijn en transparantie in gebruik van middelen.
      </p>
      <div class="over-stats-row">
        <div class="over-stat">
          <span class="over-stat-val">12</span>
          <span class="over-stat-label">Partneropvangen</span>
        </div>
        <div class="over-stat">
          <span class="over-stat-val">2.847</span>
          <span class="over-stat-label">Dieren geholpen</span>
        </div>
        <div class="over-stat">
          <span class="over-stat-val">€4,20</span>
          <span class="over-stat-label">Voedt 1 dier 1 week</span>
        </div>
      </div>
    </section>

    <!-- Contact -->
    <section class="over-section over-contact">
      <h2>Contact</h2>
      <p>Heeft u vragen over uw donatie of wilt u meer weten?</p>
      <a href="mailto:contact@belgiancarestore.com" class="over-contact-btn">
        contact@belgiancarestore.com
      </a>
    </section>

    <!-- CTA -->
    <div class="over-cta-wrap">
      <a href="/" class="over-cta-btn">Doneer nu en help de dieren →</a>
    </div>
  </main>
</div>

<style>
  .over-page {
    min-height: 100vh;
    background: #f9f9f7;
    font-family: var(--font, 'Inter', sans-serif);
  }

  .over-header {
    background: #fff;
    border-bottom: 1px solid #e8e8e8;
    padding: 14px 20px;
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .over-back {
    font-size: 0.875rem;
    color: #02A95C;
    text-decoration: none;
    font-weight: 600;
  }
  .over-back:hover { text-decoration: underline; }
  .over-logo-wrap { flex: 1; display: flex; justify-content: center; }
  .over-logo { height: 32px; object-fit: contain; }

  .over-main {
    max-width: 640px;
    margin: 0 auto;
    padding: 32px 20px 60px;
  }

  .over-hero { text-align: center; margin-bottom: 40px; }
  .over-hero h1 {
    font-size: 1.875rem; font-weight: 800; color: #1a1a1a;
    margin: 0 0 12px; letter-spacing: -0.02em;
  }
  .over-lead {
    font-size: 1.0625rem; color: #555; line-height: 1.6; margin: 0;
  }

  .over-section { margin-bottom: 36px; }
  .over-section h2 {
    font-size: 1.25rem; font-weight: 700; color: #1a1a1a;
    margin: 0 0 14px; letter-spacing: -0.01em;
  }
  .over-section p {
    font-size: 0.9375rem; color: #444; line-height: 1.65; margin: 0 0 10px;
  }

  /* Steps */
  .over-steps { display: flex; flex-direction: column; gap: 16px; }
  .over-step { display: flex; align-items: flex-start; gap: 14px; }
  .over-step-num {
    flex-shrink: 0; width: 32px; height: 32px; border-radius: 50%;
    background: #02A95C; color: #fff; font-weight: 800; font-size: 0.9rem;
    display: flex; align-items: center; justify-content: center;
  }
  .over-step strong { display: block; font-size: 0.9375rem; margin-bottom: 4px; color: #1a1a1a; }
  .over-step p { font-size: 0.875rem; color: #666; margin: 0; line-height: 1.5; }

  /* Barras de verdeling */
  .over-verdeling { background: #fff; border-radius: 16px; padding: 20px; border: 1px solid #e8e8e8; }
  .over-bars { display: flex; flex-direction: column; gap: 14px; }
  .over-bar-item {}
  .over-bar-label { display: flex; justify-content: space-between; font-size: 0.875rem; margin-bottom: 6px; color: #444; }
  .over-bar-label strong { color: #1a1a1a; font-weight: 700; }
  .over-bar-bg { background: #f0f0f0; border-radius: 99px; height: 8px; overflow: hidden; }
  .over-bar-fill { height: 100%; background: #02A95C; border-radius: 99px; transition: width 0.5s ease; }
  .over-bar-muted { background: #b0d4c0; }

  /* Organizer */
  .over-org-card { display: flex; align-items: flex-start; gap: 16px; background: #fff; border-radius: 16px; padding: 20px; border: 1px solid #e8e8e8; }
  .over-org-avatar {
    flex-shrink: 0; width: 52px; height: 52px; border-radius: 50%;
    background: #02A95C; color: #fff; font-weight: 800; font-size: 1.1rem;
    display: flex; align-items: center; justify-content: center;
  }
  .over-org-info { display: flex; flex-direction: column; gap: 2px; }
  .over-org-info strong { font-size: 1rem; font-weight: 700; color: #1a1a1a; }
  .over-org-info span { font-size: 0.8125rem; color: #888; }
  .over-org-info p { font-size: 0.875rem; color: #555; line-height: 1.55; margin: 8px 0 0; font-style: italic; }

  /* Stats row */
  .over-stats-row { display: flex; gap: 12px; margin-top: 20px; flex-wrap: wrap; }
  .over-stat {
    flex: 1; min-width: 100px; background: #fff; border: 1px solid #e8e8e8;
    border-radius: 12px; padding: 14px 12px; text-align: center;
  }
  .over-stat-val { display: block; font-size: 1.375rem; font-weight: 800; color: #02A95C; letter-spacing: -0.02em; }
  .over-stat-label { display: block; font-size: 0.75rem; color: #777; margin-top: 3px; }

  /* Contact */
  .over-contact-btn {
    display: inline-block; margin-top: 8px;
    color: #02A95C; font-weight: 600; font-size: 0.9375rem;
    text-decoration: none; border-bottom: 2px solid #02A95C; padding-bottom: 2px;
  }
  .over-contact-btn:hover { opacity: 0.8; }

  /* CTA final */
  .over-cta-wrap { text-align: center; margin-top: 40px; }
  .over-cta-btn {
    display: inline-block; background: #02A95C; color: #fff;
    padding: 16px 28px; border-radius: 14px; font-weight: 700; font-size: 1rem;
    text-decoration: none; transition: background 0.15s;
  }
  .over-cta-btn:hover { background: #008F4C; }
</style>
