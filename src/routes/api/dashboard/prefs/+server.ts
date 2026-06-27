import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { getPrefs, setSelectedAccountIds } from '$lib/server/dashboard-prefs';

const COOKIE = 'dash_token';

function requireAuth(event: Parameters<RequestHandler>[0]) {
  const expected = env.DASHBOARD_TOKEN;
  if (!expected) return; // dev / preview sem token
  const cookie = event.cookies.get(COOKIE);
  if (cookie !== expected) throw error(401, 'unauthorized');
}

export const GET: RequestHandler = async (event) => {
  requireAuth(event);
  return json(getPrefs());
};

export const POST: RequestHandler = async (event) => {
  requireAuth(event);
  let body: any;
  try {
    body = await event.request.json();
  } catch {
    throw error(400, 'invalid_json');
  }
  if (!Array.isArray(body.selectedAccountIds)) throw error(400, 'selectedAccountIds_required');
  const next = setSelectedAccountIds(body.selectedAccountIds);
  return json(next);
};
