import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { snapshot } from '$lib/server/analytics';
import { env } from '$env/dynamic/private';

function checkAuth(token: string | null): boolean {
  const expected = env.DASHBOARD_TOKEN;
  if (!expected) return true; // se nao configurado, libera (dev)
  return token === expected;
}

export const GET: RequestHandler = async ({ url, cookies }) => {
  const token = url.searchParams.get('token') || cookies.get('dash_token');
  if (!checkAuth(token)) throw error(401, 'unauthorized');

  const windowParam = url.searchParams.get('window') || '24h';
  let windowMs = 24 * 60 * 60 * 1000;
  if (windowParam === '2m') windowMs = 2 * 60 * 1000;
  else if (windowParam === '15m') windowMs = 15 * 60 * 1000;
  else if (windowParam === '1h') windowMs = 60 * 60 * 1000;
  else if (windowParam === '6h') windowMs = 6 * 60 * 60 * 1000;
  else if (windowParam === '24h') windowMs = 24 * 60 * 60 * 1000;
  else if (windowParam === '7d') windowMs = 7 * 24 * 60 * 60 * 1000;

  const pathFilter = url.searchParams.get('path') || undefined;
  const deviceRaw = url.searchParams.get('device');
  const device =
    deviceRaw === 'mobile' || deviceRaw === 'desktop' || deviceRaw === 'tablet'
      ? deviceRaw
      : undefined;

  const data = snapshot({ windowMs, pathFilter, device });
  return json(data, {
    headers: { 'cache-control': 'no-store' }
  });
};
