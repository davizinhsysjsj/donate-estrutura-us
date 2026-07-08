import type { PageServerLoad } from './$types';
import { lookupGeo } from '$lib/server/geo';
import { getRecentRealDonors } from '$lib/server/donors-feed';

// Bandeira mostrada no header da LP muda conforme país do visitante.
// GB → 🇬🇧 · IE → 🇮🇪 · resto cai no GB (funil UK-first)
function flagFor(cc: string | undefined): { code: 'GB' | 'IE'; emoji: string } {
  if (cc === 'IE') return { code: 'IE', emoji: '🇮🇪' };
  return { code: 'GB', emoji: '🇬🇧' };
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

export const load: PageServerLoad = async ({ request, getClientAddress }) => {
  const ip = getClientIP(request, getClientAddress);
  let cc: string | undefined;

  const isLocal = !ip || ip === '127.0.0.1' || ip === '::1' ||
    ip.startsWith('192.168.') || ip.startsWith('10.');

  if (!isLocal) {
    const geo = await lookupGeo(ip);
    cc = geo.countryCode;
  }

  const flag = flagFor(cc);

  // Doadores reais das últimas 24h — só do funil Ellie, formatação EN.
  // Cache-control não é setado aqui — o +layout.server.ts global já cacheia 60s.
  const realDonors = getRecentRealDonors({ funnel: 'ellie', locale: 'en' });

  return {
    visitorCountry: flag.code,
    visitorFlag: flag.emoji,
    realDonors,
    realDonorsCount: realDonors.length
  };
};
