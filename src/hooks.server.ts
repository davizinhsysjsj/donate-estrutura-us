import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';
import { lookupGeo } from '$lib/server/geo';
import { env } from '$env/dynamic/private';

export const API_ONLY_HOSTS = new Set<string>(['api.belgianpaws.help']);

// ── Proteção Brasil ────────────────────────────────────────────────────────
// Rotas do funil protegidas contra visitas do Brasil
// Nota: /bedankt é prerendered (sem request real), não pode ser bloqueado aqui
const PROTECTED_PATHS = new Set(['/', '/vsl', '/donate', '/over', '/wacht', '/supporter', '/updates']);

// IPs sempre permitidos — configurar via Railway env: BRAZIL_BYPASS_IPS=IP1,IP2
// O IP do dono está hardcoded abaixo como fallback seguro
const OWNER_BYPASS_IPS = new Set(['177.38.28.44', '177.38.27.53']);

function getBypassIPs(): Set<string> {
  const raw = env.BRAZIL_BYPASS_IPS || '';
  const fromEnv = raw.split(',').map(s => s.trim()).filter(Boolean);
  return new Set([...OWNER_BYPASS_IPS, ...fromEnv]);
}

function getClientIP(event: Parameters<Handle>[0]['event']): string {
  try {
    // x-forwarded-for: "IP1, IP2, ..." — primeiro é o cliente real
    const fwd = event.request.headers.get('x-forwarded-for');
    if (fwd) return fwd.split(',')[0].trim();
    return event.getClientAddress() ?? '';
  } catch {
    // getClientAddress() lança durante prerender — retorna vazio (vai cair no isLocal)
    return '';
  }
}

function isProtected(pathname: string): boolean {
  const clean = pathname.replace(/\/$/, '') || '/';
  return PROTECTED_PATHS.has(clean);
}
// ──────────────────────────────────────────────────────────────────────────

export const handle: Handle = async ({ event, resolve }) => {
  const host = (event.request.headers.get('host') ?? event.url.hostname).toLowerCase();
  const path = event.url.pathname;

  // Restrição de host (lógica original)
  if (API_ONLY_HOSTS.has(host) && !path.startsWith('/api/') && path !== '/bedankt') {
    return new Response('Not Found', { status: 404 });
  }

  // ── Bloqueio Brasil ──
  // Nunca interfere em: APIs, dashboard, página de bloqueio, assets
  const skipBlock =
    path.startsWith('/api/') ||
    path.startsWith('/dashboard') ||
    path.startsWith('/bloqueado') ||
    path.startsWith('/_app/') ||
    path.includes('.');

  if (!skipBlock && isProtected(path)) {
    const ip = getClientIP(event);

    // Desenvolvimento local → passa sempre
    const isLocal = !ip || ip === '127.0.0.1' || ip === '::1' ||
      ip.startsWith('192.168.') || ip.startsWith('10.');

    if (!isLocal) {
      // Whitelist → passa sem lookup
      if (!getBypassIPs().has(ip)) {
        // Lookup com cache 24h (mesma função do analytics — zero custo para IPs já conhecidos)
        const geo = await lookupGeo(ip);
        if (geo.countryCode === 'BR') {
          throw redirect(302, '/bloqueado');
        }
      }
    }
  }

  return resolve(event);
};
