/**
 * Debug rapido: retorna o IP que o server ve do cliente + headers relevantes.
 * Util pra diagnosticar whitelist de bypass (BRAZIL_BYPASS_IPS).
 */

import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async ({ request, getClientAddress }) => {
  const fwd = request.headers.get('x-forwarded-for') || '';
  const firstFwd = fwd.split(',')[0].trim();
  let clientAddr = '';
  try { clientAddr = getClientAddress(); } catch {}

  const bypassIps = (env.BRAZIL_BYPASS_IPS || '').split(',').map((s) => s.trim()).filter(Boolean);

  const allHeaders: Record<string, string> = {};
  request.headers.forEach((v, k) => (allHeaders[k] = v));

  return json({
    detectedIp: firstFwd || clientAddr,
    rawXForwardedFor: fwd,
    clientAddress: clientAddr,
    realIp: request.headers.get('x-real-ip') || null,
    cfConnectingIp: request.headers.get('cf-connecting-ip') || null,
    bypassIpsConfigured: bypassIps,
    isWhitelisted: bypassIps.includes(firstFwd || clientAddr) || ['177.38.28.44'].includes(firstFwd || clientAddr),
    _debug: {
      host: request.headers.get('host'),
      xForwardedHost: request.headers.get('x-forwarded-host'),
      urlHostname: new URL(request.url).hostname,
      allHeaders
    }
  });
};
