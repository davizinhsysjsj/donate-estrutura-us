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

export const GET: RequestHandler = async ({ url, cookies }) => {
  const token = url.searchParams.get('token') || cookies.get('dash_token');
  if (!checkAuth(token)) throw error(401, 'unauthorized');

  const windowParam = url.searchParams.get('window') || '24h';
  const windowMap: Record<string, number> = {
    '2m': 2 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000
  };
  const windowMs = windowMap[windowParam] ?? windowMap['24h'];

  const pathFilter = url.searchParams.get('path') || undefined;
  const deviceRaw = url.searchParams.get('device');
  const device =
    deviceRaw === 'mobile' || deviceRaw === 'desktop' || deviceRaw === 'tablet'
      ? deviceRaw
      : undefined;
  const countryCode = url.searchParams.get('country') || undefined;
  const includeBots = url.searchParams.get('bots') === '1';

  const data = snapshot({ windowMs, pathFilter, device, countryCode, includeBots });
  return json(data, { headers: { 'cache-control': 'no-store' } });
};
