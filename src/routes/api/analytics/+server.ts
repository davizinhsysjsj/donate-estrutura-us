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

// Retorna meia-noite de um dia em timestamp UTC
// offset: 0 = hoje, -1 = ontem, +1 = amanhã
// Usa fuso Europe/Brussels (UTC+1 inverno / UTC+2 verão)
function midnightBrussels(offsetDays = 0): number {
  const now = new Date();
  // Formata data em Brussels para obter a data local
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Brussels',
    year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const parts = fmt.formatToParts(now);
  const year  = parseInt(parts.find(p => p.type === 'year')!.value);
  const month = parseInt(parts.find(p => p.type === 'month')!.value) - 1;
  const day   = parseInt(parts.find(p => p.type === 'day')!.value);

  // Cria Date de meia-noite em Brussels usando o offset de dias
  const localMidnight = new Date(Date.UTC(year, month, day + offsetDays));
  // Ajusta para meia-noite real em Brussels (subtrai o offset do fuso)
  // Encontra o offset do fuso nessa data específica
  const brusselsMidnight = new Date(
    localMidnight.toLocaleString('en-US', { timeZone: 'Europe/Brussels' })
  );
  // Calcula quantos ms de diferença entre UTC e Brussels nessa meia-noite
  const tmpUTC = new Date(year, month, day + offsetDays);
  const brusselsFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Brussels',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
  // Usa Date construído a partir da string localizada
  const target = new Date(`${year}-${String(month + 1).padStart(2,'0')}-${String(day + offsetDays).padStart(2,'0')}T00:00:00`);
  // Determina o offset real do fuso neste momento
  const utcMs  = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  // Detecta offset via Intl
  const checkDate = new Date(utcMs);
  const brusselsStr = checkDate.toLocaleString('en-US', { timeZone: 'Europe/Brussels', hour12: false });
  // Abordagem mais simples e robusta:
  return utcMs - getTzOffsetMs('Europe/Brussels', utcMs);
}

// Retorna o offset UTC→localTZ em ms para uma data UTC específica
function getTzOffsetMs(tz: string, utcMs: number): number {
  const d = new Date(utcMs);
  // Formata a data nas duas zonas
  const localStr = d.toLocaleString('en-US', { timeZone: tz });
  const utcStr   = d.toLocaleString('en-US', { timeZone: 'UTC' });
  const diff = new Date(localStr).getTime() - new Date(utcStr).getTime();
  return diff; // positivo quando local está à frente de UTC
}

// Versão simples e correta: meia-noite local em Brussels
function todayMidnightBrussels(offsetDays = 0): number {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Brussels',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now);
  const y = parseInt(parts.find(p => p.type === 'year')!.value);
  const mo = parseInt(parts.find(p => p.type === 'month')!.value) - 1;
  const d = parseInt(parts.find(p => p.type === 'day')!.value);

  // Cria a string ISO de meia-noite nesse fuso e converte para UTC
  const dateStr = `${y}-${String(mo+1).padStart(2,'0')}-${String(d + offsetDays).padStart(2,'0')}`;
  // Hack: usa o fuso para descobrir o offset nessa data
  const probe = new Date(`${dateStr}T12:00:00Z`); // meio-dia UTC como probe
  const localMidStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Brussels',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(probe);

  // Constrói meia-noite Brussels em UTC
  const tzOffset = (() => {
    const utcD = new Date(`${dateStr}T00:00:00Z`);
    const asLocal = new Date(utcD.toLocaleString('en-US', { timeZone: 'Europe/Brussels' }));
    return utcD.getTime() - asLocal.getTime();
  })();

  return new Date(`${dateStr}T00:00:00Z`).getTime() + tzOffset;
}

export const GET: RequestHandler = async ({ url, cookies }) => {
  const token = url.searchParams.get('token') || cookies.get('dash_token');
  if (!checkAuth(token)) throw error(401, 'unauthorized');

  const mode = url.searchParams.get('mode'); // 'today' | 'yesterday' | null

  let sinceTs: number | undefined;
  let untilTs: number | undefined;
  let windowMs: number | undefined;

  if (mode === 'today') {
    sinceTs = todayMidnightBrussels(0);
    untilTs = Date.now();
  } else if (mode === 'yesterday') {
    sinceTs = todayMidnightBrussels(-1);
    untilTs = todayMidnightBrussels(0);
  } else if (mode === 'hoje_ontem') {
    sinceTs = todayMidnightBrussels(-1);
    untilTs = Date.now();
  } else if (mode === 'month') {
    // Primeiro dia do mês
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Brussels',
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(now);
    const y = parseInt(parts.find(p => p.type === 'year')!.value);
    const mo = parseInt(parts.find(p => p.type === 'month')!.value) - 1;
    sinceTs = todayMidnightBrussels(-(new Date(y, mo, parseInt(parts.find(p => p.type === 'day')!.value)).getDate() - 1));
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
