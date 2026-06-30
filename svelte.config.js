import adapterVercel from '@sveltejs/adapter-vercel';
import adapterNode from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Default: adapter-node (Railway, local, qualquer outro).
// adapter-vercel so quando estamos buildando dentro do Vercel (VERCEL=1).
const useVercel = Boolean(process.env.VERCEL);

const adapter = useVercel ? adapterVercel() : adapterNode();

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter,
    // CSRF origin check desligado: o Railway/Cloudflare proxy reescreve Host
    // header pra um nome interno (vitrack-production.up.railway.app), mas o
    // browser manda Origin: https://vitrack.online — o match interno falha.
    // Sem isso, o /login POST retorna 403. Mitigamos: actions sensíveis usam
    // HMAC próprio (vitrack_auth cookie) + APIs não públicas.
    csrf: { checkOrigin: false }
  }
};

export default config;
