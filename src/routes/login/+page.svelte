<script lang="ts">
  import { enhance } from '$app/forms';
  let { form } = $props<{ form?: { error?: string } }>();
  let submitting = $state(false);
</script>

<svelte:head>
  <title>Login · Vitrack</title>
  <meta name="robots" content="noindex,nofollow" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link
    rel="stylesheet"
    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
  />
</svelte:head>

<div class="login-wrap">
  <form
    method="POST"
    class="login-card"
    use:enhance={() => {
      submitting = true;
      return async ({ update }) => {
        await update();
        submitting = false;
      };
    }}
  >
    <div class="login-brand">
      <img src="/dashboard/vitrack-logo.png?v=2" alt="Vitrack" class="brand-logo" />
    </div>
    <p>Acesso restrito. Insira a senha de acesso.</p>
    <input
      type="password"
      name="password"
      placeholder="Senha"
      autocomplete="current-password"
      required
    />
    {#if form?.error}
      <div class="login-error">{form.error}</div>
    {/if}
    <button type="submit" disabled={submitting}>
      {submitting ? 'Entrando…' : 'Entrar'}
    </button>
  </form>
</div>

<style>
  :global(body) {
    margin: 0;
    font-family: Inter, system-ui, -apple-system, 'Segoe UI', sans-serif;
    background: #050608;
    color: #e6e9ef;
  }
  .login-wrap {
    min-height: 100vh;
    display: grid;
    place-items: center;
    background: radial-gradient(ellipse at center, #11161d 0%, #050608 70%);
    padding: 24px;
  }
  .login-card {
    background: #11161d;
    border: 1px solid #1f2630;
    padding: 36px;
    border-radius: 16px;
    min-width: 360px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }
  .login-brand {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }
  .brand-logo {
    height: 135px;
    width: auto;
    display: block;
  }
  .login-card p {
    margin: 0;
    color: #8b94a4;
    font-size: 0.875rem;
    text-align: center;
  }
  .login-card input {
    background: #0a0d12;
    border: 1px solid #2a3340;
    color: #e6e9ef;
    padding: 12px 14px;
    border-radius: 10px;
    font-size: 0.9375rem;
    font-family: inherit;
    transition: border-color 0.15s;
  }
  .login-card input:focus {
    outline: none;
    border-color: #02a95c;
  }
  .login-error {
    background: rgba(220, 38, 38, 0.12);
    border: 1px solid rgba(220, 38, 38, 0.32);
    color: #fca5a5;
    padding: 10px 12px;
    border-radius: 8px;
    font-size: 0.8125rem;
    text-align: center;
  }
  .login-card button {
    background: linear-gradient(180deg, #02b864 0%, #02a95c 100%);
    color: #fff;
    border: none;
    padding: 12px;
    border-radius: 10px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.9375rem;
    box-shadow: 0 4px 12px rgba(2, 169, 92, 0.3);
    transition: opacity 0.15s;
  }
  .login-card button:hover:not(:disabled) {
    opacity: 0.92;
  }
  .login-card button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  @media (max-width: 420px) {
    .login-card {
      min-width: 0;
      width: calc(100vw - 32px);
      padding: 24px;
    }
    .brand-logo {
      height: 110px;
    }
  }
</style>
