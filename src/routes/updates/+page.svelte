<script lang="ts">
  import { CAMPAIGN } from '$lib/data/campaign';

  const UPDATES = [
    {
      date: '28 mei 2026',
      emoji: '🐕',
      title: 'Loki is geadopteerd!',
      body: 'Na drie winters in het opvangcentrum heeft onze 9 jaar oude herder Loki eindelijk een thuis gevonden. Een gezin uit Gent nam hem mee naar huis afgelopen weekend. Dit is waarom we dit doen. Dank aan iedereen die doneerde — jullie maakten dit mee mogelijk.',
      highlight: true
    },
    {
      date: '22 mei 2026',
      emoji: '📦',
      title: 'Levering aan 3 nieuwe opvangcentra',
      body: 'Met de donaties van de afgelopen twee weken hebben we voeding geleverd aan drie nieuwe partneropvangen in Luik, Namen en Charleroi. In totaal werden 184 honden en katten voorzien van eten voor de komende maand.',
    },
    {
      date: '15 mei 2026',
      emoji: '🎯',
      title: 'We hebben €1.000 bereikt!',
      body: 'Dankzij 412 donateurs hebben we onze eerste mijlpaal van €1.000 bereikt. Het bedrag is volledig doorgestort naar onze partneropvangen. We zijn enorm dankbaar voor dit vertrouwen — en we gaan door tot we €5.000 halen.',
    },
    {
      date: '8 mei 2026',
      emoji: '🤝',
      title: 'Nieuw partnerschap met opvangcentrum Antwerpen Noord',
      body: 'We hebben een overeenkomst gesloten met een opvangcentrum in Antwerpen Noord dat momenteel 47 dieren huisvest. Hun opslagkamer was bijna leeg — met de donaties van deze week konden we een voorraadbezorging regelen.',
    }
  ];
</script>

<svelte:head>
  <title>Updates | {CAMPAIGN.brand}</title>
  <meta name="description" content="Lees de laatste updates over de campagne voor Belgische opvangdieren." />
</svelte:head>

<div class="updates-page">
  <header class="updates-header">
    <a href="/" class="updates-back">← Terug naar campagne</a>
    <div class="updates-logo-wrap">
      <img src="/logo.webp" alt="PawsCo" class="updates-logo" />
    </div>
  </header>

  <main class="updates-main">
    <div class="updates-hero">
      <h1>Campagne-updates</h1>
      <p>Hier lees je wat er is gebeurd met jouw donatie en hoe het gaat met onze partner-opvangen.</p>
    </div>

    <div class="updates-list">
      {#each UPDATES as update}
        <article class="update-card" class:highlight={update.highlight}>
          {#if update.highlight}
            <div class="update-new-badge">Nieuw</div>
          {/if}
          <div class="update-date">{update.emoji} {update.date}</div>
          <h2 class="update-title">{update.title}</h2>
          <p class="update-body">{update.body}</p>
        </article>
      {/each}
    </div>

    <div class="updates-cta-wrap">
      <p>Wil jij ook bijdragen?</p>
      <a href="/" class="updates-cta-btn">Doneer nu →</a>
    </div>
  </main>
</div>

<style>
  .updates-page {
    min-height: 100vh;
    background: #f9f9f7;
    font-family: var(--font, 'Inter', sans-serif);
  }

  .updates-header {
    background: #fff;
    border-bottom: 1px solid #e8e8e8;
    padding: 14px 20px;
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .updates-back {
    font-size: 0.875rem; color: #02A95C; text-decoration: none; font-weight: 600;
  }
  .updates-back:hover { text-decoration: underline; }
  .updates-logo-wrap { flex: 1; display: flex; justify-content: center; }
  .updates-logo { height: 32px; object-fit: contain; }

  .updates-main {
    max-width: 600px;
    margin: 0 auto;
    padding: 32px 20px 60px;
  }

  .updates-hero { margin-bottom: 32px; }
  .updates-hero h1 {
    font-size: 1.75rem; font-weight: 800; color: #1a1a1a;
    margin: 0 0 8px; letter-spacing: -0.02em;
  }
  .updates-hero p {
    font-size: 0.9375rem; color: #666; line-height: 1.6; margin: 0;
  }

  .updates-list { display: flex; flex-direction: column; gap: 16px; }

  .update-card {
    background: #fff;
    border: 1px solid #e8e8e8;
    border-radius: 16px;
    padding: 20px;
    position: relative;
  }
  .update-card.highlight {
    border-color: #02A95C;
    box-shadow: 0 0 0 2px rgba(2,169,92,0.12);
  }

  .update-new-badge {
    position: absolute; top: -10px; left: 16px;
    background: #02A95C; color: #fff; font-size: 0.7rem; font-weight: 700;
    padding: 2px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.05em;
  }

  .update-date {
    font-size: 0.8125rem; color: #888; font-weight: 500; margin-bottom: 8px;
  }
  .update-title {
    font-size: 1.125rem; font-weight: 700; color: #1a1a1a;
    margin: 0 0 10px; letter-spacing: -0.01em; line-height: 1.3;
  }
  .update-body {
    font-size: 0.9375rem; color: #555; line-height: 1.65; margin: 0;
  }

  .updates-cta-wrap {
    text-align: center; margin-top: 40px;
  }
  .updates-cta-wrap p {
    font-size: 0.9375rem; color: #666; margin-bottom: 14px;
  }
  .updates-cta-btn {
    display: inline-block; background: #02A95C; color: #fff;
    padding: 14px 28px; border-radius: 14px; font-weight: 700; font-size: 0.9375rem;
    text-decoration: none; transition: background 0.15s;
  }
  .updates-cta-btn:hover { background: #008F4C; }
</style>
