import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    host: '0.0.0.0',
    port: Number(process.env.PORT) || 5173,
    allowedHosts: true
  },
  build: {
    cssCodeSplit: true,
    // esbuild ja vem com Vite, nao precisa de terser
    minify: 'esbuild',
    rollupOptions: {
      output: {
        // Separa lucide-svelte (icons) do bundle principal
        manualChunks(id) {
          if (id.includes('lucide-svelte')) return 'icons';
          if (id.includes('node_modules')) return 'vendor';
        }
      }
    }
  }
});
