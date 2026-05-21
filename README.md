# donate-estrutura

PawsCo Rescue — donation funnel + supporter area built with SvelteKit + Tailwind.

## Routes

- `/` — Emotional donation funnel (7 sections)
- `/supporter?tier=10|25|50|100|250` — Post-donation supporter area (mocked, no backend yet)

## Stack

- SvelteKit (Svelte 5) + TypeScript
- `@sveltejs/adapter-vercel`
- TailwindCSS 3
- lucide-svelte (icons)
- @fontsource/inter, fraunces, inter-tight

## Dev

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm build
pnpm preview
```

The dev server respects `PORT` env var and accepts any host (`allowedHosts: true`).

## Deploy

Pushed to GitHub `main` → auto-deploy on Vercel (production).
