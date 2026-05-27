<svelte:head>
  <title>Bedankt — Belgian Paws Club</title>
  <meta name="robots" content="noindex, nofollow" />
  <meta name="description" content="Bedankt voor je deelname aan de Belgian Paws Club." />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600;700&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<main class="bedankt-page">
  <section class="bedankt-card">
    <div class="paw-icon" aria-hidden="true">
      <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
        <ellipse cx="14" cy="22" rx="6" ry="8" />
        <ellipse cx="32" cy="14" rx="6" ry="8" />
        <ellipse cx="50" cy="22" rx="6" ry="8" />
        <ellipse cx="22" cy="36" rx="5" ry="7" />
        <ellipse cx="42" cy="36" rx="5" ry="7" />
        <path
          d="M32 32c-9 0-16 7-16 14 0 5 4 8 9 8 3 0 5-1 7-1s4 1 7 1c5 0 9-3 9-8 0-7-7-14-16-14z"
        />
      </svg>
    </div>

    <h1 class="bedankt-title">Heel erg bedankt!</h1>

    <p class="bedankt-text">
      Bedankt dat je tot hier bent gekomen en deelneemt aan ons project. Alle informatie en
      instructies worden binnenkort naar je e-mail gestuurd. Houd je inbox in de gaten.
    </p>

    <div class="bedankt-divider" aria-hidden="true"></div>

    <h2 class="bedankt-welcome">Welkom bij de Belgian Paws Club</h2>

    <p class="bedankt-signature">Met liefde, belgianpaw</p>
  </section>
</main>

<style>
  .bedankt-page {
    min-height: 100vh;
    background: #fafaf7;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4rem 1.25rem;
    font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
    color: #2c2c2c;
  }

  .bedankt-card {
    width: 100%;
    max-width: 600px;
    text-align: center;
    background: #ffffff;
    border-radius: 24px;
    padding: 3rem 1.75rem;
    box-shadow:
      0 1px 2px rgba(15, 23, 42, 0.04),
      0 12px 40px rgba(15, 23, 42, 0.06);
  }

  .paw-icon {
    width: 56px;
    height: 56px;
    margin: 0 auto 1.75rem;
    color: #02a95c;
    opacity: 0.9;
  }
  .paw-icon svg {
    width: 100%;
    height: 100%;
    display: block;
  }

  .bedankt-title {
    font-size: clamp(2rem, 6vw, 2.75rem);
    font-weight: 800;
    color: #1f1f1f;
    letter-spacing: -0.02em;
    line-height: 1.15;
    margin: 0 0 1.25rem;
  }

  .bedankt-text {
    font-size: 1.0625rem;
    line-height: 1.65;
    color: #4b5563;
    margin: 0 auto;
    max-width: 480px;
  }

  .bedankt-divider {
    width: 48px;
    height: 2px;
    background: #e5e7eb;
    border-radius: 2px;
    margin: 2.5rem auto;
  }

  .bedankt-welcome {
    font-family: 'Dancing Script', 'Georgia', cursive;
    font-size: clamp(1.6rem, 5vw, 2.1rem);
    font-weight: 700;
    color: #02a95c;
    margin: 0 0 1.5rem;
    line-height: 1.3;
    letter-spacing: 0;
  }

  .bedankt-signature {
    font-family: 'Dancing Script', 'Georgia', cursive;
    font-size: 1.5rem;
    font-weight: 600;
    color: #6b7280;
    margin: 0;
    font-style: italic;
  }

  @media (max-width: 480px) {
    .bedankt-page {
      padding: 2.5rem 1rem;
    }
    .bedankt-card {
      padding: 2.25rem 1.25rem;
      border-radius: 20px;
    }
    .bedankt-divider {
      margin: 2rem auto;
    }
  }
</style>
