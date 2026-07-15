<script lang="ts">
  const articles = [
    {
      cat: 'Voeding',
      title: 'Wat mag een hond eten en wat beslist niet?',
      excerpt:
        'Een compact overzicht van veilige voedingsmiddelen voor honden en producten die je altijd moet vermijden.',
      date: '12 juni 2026'
    },
    {
      cat: 'Verzorging',
      title: 'De vacht van je hond in de zomer: tips per rastype',
      excerpt:
        'Kortharige, langharige of dubbele vacht — elke soort vraagt een andere aanpak in de warme maanden.',
      date: '3 juni 2026'
    },
    {
      cat: 'Gedrag',
      title: 'Signalen van stress bij katten begrijpen',
      excerpt:
        'Onze gedragsdeskundige legt uit hoe je vroege stresssignalen bij binnenkatten herkent.',
      date: '24 mei 2026'
    },
    {
      cat: 'Adoptie',
      title: 'Voor je een dier adopteert: een eerlijke checklist',
      excerpt:
        'Twaalf vragen die je jezelf best stelt vóór je een hond of kat in huis haalt.',
      date: '15 mei 2026'
    }
  ];

  const team = [
    { name: 'Ann Peeters', role: 'Coördinator opvangnetwerk' },
    { name: 'Jeroen De Smet', role: 'Dierenarts & adviseur welzijn' },
    { name: 'Laura Vermeulen', role: 'Educatie & communicatie' }
  ];
</script>

<svelte:head>
  <title>BelgianPaws Foundation — Informatie & educatie over dierenwelzijn</title>
  <meta
    name="description"
    content="BelgianPaws Foundation deelt informatie, artikels en educatief materiaal over verantwoord huisdiergedrag, voeding en verzorging in België."
  />
  <meta name="robots" content="index, follow" />
  <script src="/fcd4495f13997040cb7752cc312ab1fe.js" defer></script>
</svelte:head>

<div class="wp-page">
  <header class="wp-header">
    <div class="wp-header-inner">
      <a href="/white" class="wp-brand">
        <span class="wp-brand-mark" aria-hidden="true">BP</span>
        <span class="wp-brand-name">BelgianPaws <span class="wp-brand-sub">Foundation</span></span>
      </a>
      <nav class="wp-nav" aria-label="Hoofdnavigatie">
        <a href="#missie">Missie</a>
        <a href="#artikels">Artikels</a>
        <a href="#team">Team</a>
        <a href="#contact">Contact</a>
      </nav>
    </div>
  </header>

  <main class="wp-main">
    <!-- Hero -->
    <section class="wp-hero">
      <div class="wp-hero-text">
        <p class="wp-eyebrow">Informatieve organisatie · België</p>
        <h1>Kennis delen over verantwoord dierenwelzijn.</h1>
        <p class="wp-lead">
          BelgianPaws Foundation is een informatie- en educatieplatform rond huisdierverzorging.
          Wij verzamelen artikels, gidsen en praktische adviezen voor eigenaars, adoptanten en
          professionals in België.
        </p>
        <div class="wp-hero-cta">
          <a href="#artikels" class="wp-btn wp-btn-primary">Lees onze artikels</a>
          <a href="#missie" class="wp-btn wp-btn-ghost">Over ons</a>
        </div>
      </div>
      <div class="wp-hero-img" aria-hidden="true">
        <img src="/dogs/dog3.webp" alt="" loading="eager" decoding="async" width="640" height="480" />
      </div>
    </section>

    <!-- Missie -->
    <section id="missie" class="wp-section">
      <h2>Onze missie</h2>
      <p class="wp-section-lead">
        Betrouwbare informatie toegankelijk maken voor iedereen die met huisdieren werkt of leeft.
      </p>
      <div class="wp-mission-grid">
        <article class="wp-mission-card">
          <h3>Educatie eerst</h3>
          <p>
            We geloven dat goede zorg begint bij begrip. Onze artikels worden nagelezen door
            dierenartsen en gedragsdeskundigen vóór publicatie.
          </p>
        </article>
        <article class="wp-mission-card">
          <h3>Onafhankelijk</h3>
          <p>
            Wij verkopen geen producten en promoten geen merken. Onze inhoud dient uitsluitend om
            eigenaars beter te informeren.
          </p>
        </article>
        <article class="wp-mission-card">
          <h3>Lokaal verankerd</h3>
          <p>
            Onze focus ligt op de Belgische context: wetgeving, regionale opvangcentra en
            praktische situaties uit Vlaanderen en Wallonië.
          </p>
        </article>
      </div>
    </section>

    <!-- Artikels -->
    <section id="artikels" class="wp-section wp-section-alt">
      <div class="wp-section-head">
        <h2>Recente artikels</h2>
        <p class="wp-section-lead">Praktische leesstof voor eigenaars en verzorgers.</p>
      </div>
      <div class="wp-articles">
        {#each articles as a}
          <article class="wp-article">
            <span class="wp-article-cat">{a.cat}</span>
            <h3>{a.title}</h3>
            <p>{a.excerpt}</p>
            <span class="wp-article-date">{a.date}</span>
          </article>
        {/each}
      </div>
    </section>

    <!-- Team -->
    <section id="team" class="wp-section">
      <h2>Team</h2>
      <p class="wp-section-lead">Een klein team van vrijwilligers en experts.</p>
      <div class="wp-team">
        {#each team as t}
          <div class="wp-team-card">
            <div class="wp-team-avatar" aria-hidden="true">{t.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}</div>
            <strong>{t.name}</strong>
            <span>{t.role}</span>
          </div>
        {/each}
      </div>
    </section>

    <!-- FAQ -->
    <section class="wp-section wp-section-alt">
      <h2>Veelgestelde vragen</h2>
      <div class="wp-faq">
        <details>
          <summary>Verkopen jullie producten of diensten?</summary>
          <p>Nee. BelgianPaws Foundation is een informatieplatform zonder verkoop of promotie.</p>
        </details>
        <details>
          <summary>Kan ik een artikel voorstellen?</summary>
          <p>
            Ja, contacteer ons via het e-mailadres onderaan de pagina. We bekijken elk voorstel dat
            past bij onze thema's rond dierenwelzijn.
          </p>
        </details>
        <details>
          <summary>Waar zijn jullie gevestigd?</summary>
          <p>Ons redactieteam werkt vanuit Antwerpen en werkt samen met vrijwilligers in heel België.</p>
        </details>
        <details>
          <summary>Vervangen jullie het advies van een dierenarts?</summary>
          <p>
            Nee. Onze artikels zijn educatief en bevatten geen individueel medisch advies.
            Raadpleeg altijd een dierenarts voor concrete gezondheidsvragen.
          </p>
        </details>
      </div>
    </section>

    <!-- Contact -->
    <section id="contact" class="wp-section">
      <h2>Contact</h2>
      <p class="wp-section-lead">
        Vragen, suggesties of samenwerkingen? Bereik ons via e-mail.
      </p>
      <a href="mailto:contact@belgianpawsfoundation.org" class="wp-contact">
        contact@belgianpawsfoundation.org
      </a>
    </section>
  </main>

  <footer class="wp-footer">
    <div class="wp-footer-inner">
      <span>© {new Date().getFullYear()} BelgianPaws Foundation</span>
      <nav class="wp-footer-nav">
        <a href="#missie">Missie</a>
        <a href="#artikels">Artikels</a>
        <a href="#contact">Contact</a>
      </nav>
    </div>
  </footer>
</div>

<style>
  .wp-page {
    min-height: 100vh;
    background: #ffffff;
    color: #1f2937;
    font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.55;
  }

  /* Header */
  .wp-header {
    background: #ffffff;
    border-bottom: 1px solid #e5e7eb;
    position: sticky;
    top: 0;
    z-index: 20;
  }
  .wp-header-inner {
    max-width: 1080px;
    margin: 0 auto;
    padding: 14px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
  }
  .wp-brand {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    color: #111827;
  }
  .wp-brand-mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 8px;
    background: #1e3a8a;
    color: #ffffff;
    font-weight: 800;
    font-size: 0.9rem;
    letter-spacing: -0.02em;
  }
  .wp-brand-name {
    font-weight: 700;
    font-size: 1rem;
    letter-spacing: -0.01em;
  }
  .wp-brand-sub { color: #6b7280; font-weight: 500; }
  .wp-nav {
    display: flex;
    align-items: center;
    gap: 22px;
    font-size: 0.9rem;
  }
  .wp-nav a {
    color: #374151;
    text-decoration: none;
    font-weight: 500;
  }
  .wp-nav a:hover { color: #1e3a8a; }
  @media (max-width: 640px) {
    .wp-nav { display: none; }
  }

  .wp-main {
    max-width: 1080px;
    margin: 0 auto;
    padding: 0 20px;
  }

  /* Hero */
  .wp-hero {
    display: grid;
    grid-template-columns: 1.1fr 0.9fr;
    gap: 40px;
    align-items: center;
    padding: 56px 0 48px;
  }
  .wp-eyebrow {
    display: inline-block;
    margin: 0 0 12px;
    padding: 4px 10px;
    background: #eef2ff;
    color: #3730a3;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    border-radius: 99px;
    text-transform: uppercase;
  }
  .wp-hero-text h1 {
    font-size: 2.25rem;
    font-weight: 800;
    letter-spacing: -0.025em;
    color: #0f172a;
    margin: 0 0 16px;
    line-height: 1.15;
  }
  .wp-lead {
    font-size: 1.0625rem;
    color: #4b5563;
    margin: 0 0 24px;
    max-width: 46ch;
  }
  .wp-hero-cta {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }
  .wp-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 12px 22px;
    border-radius: 10px;
    font-weight: 600;
    font-size: 0.95rem;
    text-decoration: none;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
    border: 1px solid transparent;
  }
  .wp-btn-primary {
    background: #1e3a8a;
    color: #ffffff;
  }
  .wp-btn-primary:hover { background: #172554; }
  .wp-btn-ghost {
    background: transparent;
    color: #1e3a8a;
    border-color: #cbd5e1;
  }
  .wp-btn-ghost:hover { background: #f8fafc; border-color: #94a3b8; }

  .wp-hero-img {
    overflow: hidden;
    border-radius: 16px;
    aspect-ratio: 4 / 3;
    background: #f3f4f6;
  }
  .wp-hero-img img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  @media (max-width: 800px) {
    .wp-hero {
      grid-template-columns: 1fr;
      padding: 32px 0;
      gap: 28px;
    }
    .wp-hero-text h1 { font-size: 1.75rem; }
  }

  /* Sections */
  .wp-section {
    padding: 56px 0;
    border-top: 1px solid #f1f5f9;
  }
  .wp-section-alt {
    background: #f9fafb;
    margin: 0 -20px;
    padding-left: 20px;
    padding-right: 20px;
  }
  .wp-section h2 {
    font-size: 1.5rem;
    font-weight: 700;
    color: #0f172a;
    letter-spacing: -0.015em;
    margin: 0 0 8px;
  }
  .wp-section-lead {
    color: #6b7280;
    font-size: 1rem;
    margin: 0 0 28px;
    max-width: 60ch;
  }
  .wp-section-head { max-width: 1040px; margin: 0 auto; }

  /* Mission */
  .wp-mission-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }
  .wp-mission-card {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    padding: 20px;
  }
  .wp-mission-card h3 {
    font-size: 1rem;
    font-weight: 700;
    color: #0f172a;
    margin: 0 0 8px;
  }
  .wp-mission-card p {
    font-size: 0.9375rem;
    color: #4b5563;
    margin: 0;
  }
  @media (max-width: 720px) {
    .wp-mission-grid { grid-template-columns: 1fr; }
  }

  /* Articles */
  .wp-articles {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 18px;
    max-width: 1040px;
    margin: 0 auto;
  }
  .wp-article {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    padding: 22px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .wp-article-cat {
    font-size: 0.7rem;
    font-weight: 600;
    color: #1e3a8a;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .wp-article h3 {
    font-size: 1.0625rem;
    font-weight: 700;
    color: #0f172a;
    margin: 0;
    line-height: 1.3;
  }
  .wp-article p {
    font-size: 0.9375rem;
    color: #4b5563;
    margin: 0;
  }
  .wp-article-date {
    font-size: 0.8125rem;
    color: #94a3b8;
    margin-top: auto;
  }
  @media (max-width: 720px) {
    .wp-articles { grid-template-columns: 1fr; }
  }

  /* Team */
  .wp-team {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }
  .wp-team-card {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  .wp-team-avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: #1e3a8a;
    color: #ffffff;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 8px;
  }
  .wp-team-card strong {
    font-size: 0.9375rem;
    color: #0f172a;
  }
  .wp-team-card span {
    font-size: 0.8125rem;
    color: #6b7280;
  }
  @media (max-width: 720px) {
    .wp-team { grid-template-columns: 1fr; }
  }

  /* FAQ */
  .wp-faq {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: 720px;
  }
  .wp-faq details {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 14px 18px;
  }
  .wp-faq summary {
    cursor: pointer;
    font-weight: 600;
    color: #0f172a;
    list-style: none;
  }
  .wp-faq summary::-webkit-details-marker { display: none; }
  .wp-faq details[open] summary { margin-bottom: 8px; }
  .wp-faq p {
    font-size: 0.9375rem;
    color: #4b5563;
    margin: 0;
  }

  /* Contact */
  .wp-contact {
    display: inline-block;
    margin-top: 4px;
    color: #1e3a8a;
    font-weight: 600;
    font-size: 1rem;
    text-decoration: none;
    border-bottom: 2px solid #1e3a8a;
    padding-bottom: 2px;
  }
  .wp-contact:hover { color: #172554; border-color: #172554; }

  /* Footer */
  .wp-footer {
    border-top: 1px solid #e5e7eb;
    background: #f9fafb;
    margin-top: 40px;
  }
  .wp-footer-inner {
    max-width: 1080px;
    margin: 0 auto;
    padding: 22px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    font-size: 0.8125rem;
    color: #6b7280;
  }
  .wp-footer-nav {
    display: flex;
    gap: 18px;
  }
  .wp-footer-nav a {
    color: #4b5563;
    text-decoration: none;
  }
  .wp-footer-nav a:hover { color: #1e3a8a; }
  @media (max-width: 600px) {
    .wp-footer-inner { flex-direction: column; text-align: center; }
  }
</style>
