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
    adapter
  }
};

export default config;
