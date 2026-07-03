import type { PageServerLoad } from './$types';
import { lookupGeo } from '$lib/server/geo';

// Bandeira mostrada no header da LP muda conforme país do visitante.
// BE → 🇧🇪 · NL → 🇳🇱 · resto cai no NL (default do funil holandês).
function flagFor(cc: string | undefined): { code: 'BE' | 'NL'; emoji: string } {
  if (cc === 'BE') return { code: 'BE', emoji: '🇧🇪' };
  return { code: 'NL', emoji: '🇳🇱' };
}

function getClientIP(request: Request, getAddr: () => string): string {
  try {
    const fwd = request.headers.get('x-forwarded-for');
    if (fwd) return fwd.split(',')[0].trim();
    return getAddr() ?? '';
  } catch {
    return '';
  }
}

export const load: PageServerLoad = async ({ request, getClientAddress, setHeaders }) => {
  const ip = getClientIP(request, getClientAddress);
  let cc: string | undefined;

  const isLocal = !ip || ip === '127.0.0.1' || ip === '::1' ||
    ip.startsWith('192.168.') || ip.startsWith('10.');

  if (!isLocal) {
    const geo = await lookupGeo(ip);
    cc = geo.countryCode;
  }

  const flag = flagFor(cc);

  // Cache curto por país — reduz o custo de repetir o lookup, mas mantém a
  // resposta dinâmica se o visitante entrar de um IP com outra geolocalização.
  setHeaders({ 'cache-control': 'private, max-age=300' });

  return { visitorCountry: flag.code, visitorFlag: flag.emoji };
};
