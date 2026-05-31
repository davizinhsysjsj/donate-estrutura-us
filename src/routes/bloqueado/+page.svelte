<svelte:head>
  <title>Página não disponível</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="wrap">
  <div class="box">
    <div class="code">404</div>
    <h1>Página não encontrada</h1>
    <p>O conteúdo que você está tentando acessar não está disponível na sua região.</p>
    <a href="https://www.google.com.br" class="btn">Voltar ao início</a>
  </div>
</div>

<style>
  :global(body) { margin: 0; background: #0a0d12; font-family: -apple-system, system-ui, sans-serif; }
  .wrap {
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    padding: 20px;
  }
  .box {
    text-align: center; max-width: 400px;
    color: #e6e9ef;
  }
  .code {
    font-size: 5rem; font-weight: 800; color: #1a2332;
    line-height: 1; margin-bottom: 8px; letter-spacing: -4px;
  }
  h1 {
    font-size: 1.25rem; font-weight: 700; color: #6b7787;
    margin: 0 0 12px;
  }
  p {
    font-size: 0.9375rem; color: #4a5568; line-height: 1.6;
    margin: 0 0 28px;
  }
  .btn {
    display: inline-block; background: #1a2332; color: #8b94a4;
    border: 1px solid #2a3340; padding: 10px 24px; border-radius: 8px;
    text-decoration: none; font-size: 0.875rem; font-weight: 500;
    transition: all 0.15s;
  }
  .btn:hover { background: #243040; color: #c8cdd5; }
</style>
