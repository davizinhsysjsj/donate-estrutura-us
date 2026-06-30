<script lang="ts">
  import { enhance } from '$app/forms';
  let { form, data } = $props<{ form?: { error?: string }; data: { next: string } }>();
  let submitting = $state(false);
  let password = $state('');
</script>

<svelte:head>
  <title>Login · Vitrack</title>
  <meta name="robots" content="noindex,nofollow" />
</svelte:head>

<div class="wrap">
  <div class="card">
    <div class="brand">
      <div class="logo">⚡</div>
      <div class="name">Vitrack</div>
    </div>
    <p class="sub">Autenticação necessária.</p>

    <form
      method="POST"
      use:enhance={() => {
        submitting = true;
        return async ({ update }) => {
          await update();
          submitting = false;
        };
      }}
    >
      <label class="field">
        <span>Senha</span>
        <input
          type="password"
          name="password"
          bind:value={password}
          autocomplete="current-password"
          autofocus
          required
        />
      </label>

      {#if form?.error}
        <div class="error">{form.error}</div>
      {/if}

      <button type="submit" disabled={submitting || !password}>
        {submitting ? 'Entrando…' : 'Entrar'}
      </button>

      <p class="hint">Sessão válida por 48 horas.</p>
    </form>
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    background: #0b0d10;
    color: #e7ecf3;
    font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  }
  .wrap {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 24px;
  }
  .card {
    width: 100%;
    max-width: 360px;
    background: #14181d;
    border: 1px solid #232a33;
    border-radius: 16px;
    padding: 28px 24px;
    box-shadow: 0 12px 50px rgba(0, 0, 0, 0.45);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 4px;
  }
  .logo {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: linear-gradient(135deg, #6e7bff 0%, #a64bff 100%);
    display: grid;
    place-items: center;
    font-size: 20px;
  }
  .name {
    font-size: 1.125rem;
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  .sub {
    margin: 8px 0 22px;
    color: #95a1b1;
    font-size: 0.875rem;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 16px;
  }
  .field span {
    font-size: 0.8125rem;
    color: #a3afbf;
    font-weight: 500;
  }
  .field input {
    background: #0e1216;
    border: 1px solid #2a323d;
    border-radius: 10px;
    padding: 12px 14px;
    color: #fff;
    font-size: 1rem;
    font-family: inherit;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .field input:focus {
    outline: none;
    border-color: #6e7bff;
    box-shadow: 0 0 0 3px rgba(110, 123, 255, 0.18);
  }
  .error {
    background: rgba(220, 38, 38, 0.12);
    border: 1px solid rgba(220, 38, 38, 0.32);
    color: #fca5a5;
    padding: 10px 12px;
    border-radius: 8px;
    font-size: 0.875rem;
    margin-bottom: 12px;
  }
  button {
    width: 100%;
    background: linear-gradient(135deg, #6e7bff 0%, #a64bff 100%);
    color: #fff;
    border: none;
    border-radius: 10px;
    padding: 12px 16px;
    font-size: 0.9375rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.1s;
  }
  button:hover:not(:disabled) { opacity: 0.92; }
  button:active:not(:disabled) { transform: scale(0.99); }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  .hint {
    margin: 16px 0 0;
    text-align: center;
    color: #6e7886;
    font-size: 0.75rem;
  }
</style>
