import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { snapshot, initStore } from '$lib/server/analytics';
import { env } from '$env/dynamic/private';

initStore();

function checkAuth(token: string | null): boolean {
  const expected = env.DASHBOARD_TOKEN;
  if (!expected) return true;
  return token === expected;
}

// Retorna timestamp UTC de meia-noite em Europe/Brussels
// offsetDays: 0 = hoje, -1 = ontem, 1 = amanhã
function midnightBrussels(offsetDays = 0): number {
  // Pega a data atual em Brussels
  const now = new Date();
  const dateStr = new Intl.DateTimeFormat('sv-SE', { // sv-SE = formato YYYY-MM-DD
    timeZone: 'Europe/Brussels'
  }).format(now);

  // Aplica offset de dias
  const [y, m, d] = dateStr.split('-').map(Number);
  const targetDate = new Date(Date.UTC(y, m - 1, d + offsetDays));
  const targetStr  = targetDate.toISOString().slice(0, 10); // YYYY-MM-DD

  const utcBase = new Date(`${targetStr}T00:00:00Z`).getTime();
  // Busca binária: encontra o UTC que corresponde a 00:00:00 em Brussels
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Brussels',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
    hour12: false
  });
  // Encontra o UTC que corresponde a 00:00:00 em Brussels via iteração binária
  // Estimativa inicial: UTC - 2h (máximo offset Brussels CEST)
  let lo = utcBase - 3 * 3600_000;
  let hi = utcBase + 3 * 3600_000;
  for (let i = 0; i < 50; i++) {
    const mid = Math.floor((lo + hi) / 2);
    const dt = new Date(mid);
    const parts = formatter.formatToParts(dt);
    const h = parseInt(parts.find(p => p.type === 'hour')!.value);
    const mn = parseInt(parts.find(p => p.type === 'minute')!.value);
    const s = parseInt(parts.find(p => p.type === 'second')!.value);
    const totalSec = h * 3600 + mn * 60 + s;
    if (totalSec === 0 && hi - lo <= 1000) return mid;
    if (totalSec > 0 && totalSec < 43200) hi = mid;
    else lo = mid;
  }
  // Fallback: UTC+2 (CEST)
  return utcBase - 2 * 3600_000;
}

export const GET: RequestHandler = async ({ url, cookies }) => {
  const token = url.searchParams.get('token') || cookies.get('dash_token');
  if (!checkAuth(token)) throw error(401, 'unauthorized');

  const mode = url.searchParams.get('mode'); // 'today' | 'yesterday' | null

  let sinceTs: number | undefined;
  let untilTs: number | undefined;
  let windowMs: number | undefined;

  if (mode === 'today') {
    sinceTs = midnightBrussels(0);
    untilTs = Date.now();
  } else if (mode === 'yesterday') {
    sinceTs = midnightBrussels(-1);
    untilTs = midnightBrussels(0);
  } else if (mode === 'hoje_ontem') {
    sinceTs = midnightBrussels(-1);
    untilTs = Date.now();
  } else if (mode === 'month') {
    // Primeiro dia do mês corrente em Brussels
    const dayOfMonth = parseInt(
      new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels', day: '2-digit' }).format(new Date())
    );
    sinceTs = midnightBrussels(-(dayOfMonth - 1));
    untilTs = Date.now();
  } else {
    const windowParam = url.searchParams.get('window') || '24h';
    const windowMap: Record<string, number> = {
      '2m':  2  * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h':  60 * 60 * 1000,
      '6h':  6  * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d':  7  * 24 * 60 * 60 * 1000
    };
    windowMs = windowMap[windowParam] ?? windowMap['24h'];
  }

  const pathFilter = url.searchParams.get('path') || undefined;
  const deviceRaw = url.searchParams.get('device');
  const device =
    deviceRaw === 'mobile' || deviceRaw === 'desktop' || deviceRaw === 'tablet'
      ? deviceRaw
      : undefined;
  const countryCode = url.searchParams.get('country') || undefined;
  const includeBots = url.searchParams.get('bots') === '1';

  const data = snapshot({ windowMs, sinceTs, untilTs, pathFilter, device, countryCode, includeBots });
  return json(data, { headers: { 'cache-control': 'no-store' } });
};
