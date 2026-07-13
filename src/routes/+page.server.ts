import type { PageServerLoad } from './$types';
import { redirect, json } from '@sveltejs/kit';

// Whitelist de IPs que pulam o popup "We zijn zo terug" e vao direto pro /vsl.
// Uso: staff/dev/testes internos — trafego de ad continua indo direto em /vsl,
// visitor direto normal continua vendo o popup.
const IP_WHITELIST = new Set<string>([
  '177.38.27.54', // luscas
]);

// Tokens de bypass — acessar '/' com ?preview=<TOKEN> seta cookie 90d e
// redireciona pra /vsl. Depois disso qualquer acesso a '/' desse browser
// pula o popup, independente de IP.
const PREVIEW_TOKENS = new Set<string>([
  'luscas2026',
]);

function extractIps(request: Request, fallback: string): string[] {
  const out: string[] = [];
  const cf = request.headers.get('cf-connecting-ip');
  if (cf) out.push(cf.trim());
  const xff = request.headers.get('x-forwarded-for');
  if (xff) xff.split(',').forEach((p) => out.push(p.trim()));
  const xr = request.headers.get('x-real-ip');
  if (xr) out.push(xr.trim());
  if (fallback) out.push(fallback.trim());
  return out.filter(Boolean);
}

export const load: PageServerLoad = async ({ request, url, getClientAddress, cookies }) => {
  let clientAddr = '';
  try { clientAddr = getClientAddress(); } catch {}

  const ips = extractIps(request, clientAddr);

  // Debug: '/?debug-ip=1' devolve JSON com todos os IPs vistos + headers relevantes.
  // Usado pra descobrir qual IP colocar na whitelist quando ha proxy no meio.
  if (url.searchParams.get('debug-ip') === '1') {
    const payload = {
      ips,
      headers: {
        'cf-connecting-ip': request.headers.get('cf-connecting-ip'),
        'x-forwarded-for':  request.headers.get('x-forwarded-for'),
        'x-real-ip':        request.headers.get('x-real-ip'),
      },
      socketAddr: clientAddr,
      whitelisted: ips.some((ip) => IP_WHITELIST.has(ip)),
    };
    // Retorna como texto pré-formatado usando redirect trick — na verdade
    // e mais simples throw uma Response.
    throw new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }

  // Preview token: '/?preview=<TOKEN>' seta cookie 90d + redireciona pra /vsl
  const previewParam = url.searchParams.get('preview');
  if (previewParam && PREVIEW_TOKENS.has(previewParam)) {
    cookies.set('bp_preview', '1', {
      path: '/',
      maxAge: 60 * 60 * 24 * 90, // 90 dias
      httpOnly: false,
      sameSite: 'lax',
    });
    throw redirect(302, '/vsl');
  }

  // Cookie ja setado (visitou com preview antes) — bypass permanente
  if (cookies.get('bp_preview') === '1') {
    throw redirect(302, '/vsl');
  }

  // IP whitelist
  const isWhitelisted = ips.some((ip) => IP_WHITELIST.has(ip));
  if (isWhitelisted) {
    throw redirect(302, '/vsl');
  }

  return {};
};
