import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

// Whitelist de IPs que pulam o popup "We zijn zo terug" e vao direto pro /vsl.
// Uso: staff/dev/testes internos — trafego de ad continua indo direto em /vsl,
// visitor direto normal continua vendo o popup.
const IP_WHITELIST = new Set<string>([
  '177.38.27.54', // luscas
]);

function extractIps(request: Request, fallback: string): string[] {
  const out: string[] = [];
  // Cloudflare
  const cf = request.headers.get('cf-connecting-ip');
  if (cf) out.push(cf.trim());
  // X-Forwarded-For (proxy chain — primeiro e o cliente real)
  const xff = request.headers.get('x-forwarded-for');
  if (xff) xff.split(',').forEach((p) => out.push(p.trim()));
  // X-Real-IP
  const xr = request.headers.get('x-real-ip');
  if (xr) out.push(xr.trim());
  // fallback direto do socket
  if (fallback) out.push(fallback.trim());
  return out.filter(Boolean);
}

export const load: PageServerLoad = async ({ request, getClientAddress }) => {
  let clientAddr = '';
  try { clientAddr = getClientAddress(); } catch {}

  const ips = extractIps(request, clientAddr);
  const isWhitelisted = ips.some((ip) => IP_WHITELIST.has(ip));

  if (isWhitelisted) {
    // Bypass do popup — vai direto pro funil VSL
    throw redirect(302, '/vsl');
  }

  return {};
};
