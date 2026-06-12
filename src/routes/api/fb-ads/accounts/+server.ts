import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

const CACHE_TTL = 10 * 60 * 1000;
let _cache: { data: any; ts: number } | null = null;

const FB_TOKEN = env.FB_ADS_TOKEN ||
  'EAASpkEKZBxb8BRkZAvHccwFXjbEUJcgkb7qzwZBfx6t6qkNJMMPrIitCI3YQATc9iiqZCo6OrrYkGhFdrULwg0z1aBBWoFMhHJx0TzC8T9T01nRKmAtZA0PJyn3fgNZBhuQ1Mg8J1KA1XeDPMJIZC41J8CMREjCiAWnyOqHyQI1qQ9vqeIdftvZBsHY9jcRn7wZDZD';
const DEFAULT_ACCT = env.FB_ADS_ACCOUNT_ID || 'act_1451507589956064';

const STATUS_LABEL: Record<number, string> = {
  1: 'active',
  2: 'disabled',
  3: 'unsettled',
  7: 'pending_review',
  8: 'pending_settlement',
  9: 'in_grace_period',
  100: 'pending_closure',
  101: 'closed',
  201: 'any_active',
  202: 'any_closed',
};

async function fbFetch(path: string) {
  const r = await fetch(`https://graph.facebook.com/v21.0/${path}`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err?.error?.message || `FB API ${r.status}`);
  }
  return r.json();
}

export const GET: RequestHandler = async ({ url }) => {
  const force = url.searchParams.get('force') === '1';
  if (!force && _cache && Date.now() - _cache.ts < CACHE_TTL) {
    return json(_cache.data);
  }

  try {
    const fields = 'id,account_id,name,account_status,currency,business,timezone_name,amount_spent,disable_reason';
    const body = await fbFetch(
      `me/adaccounts?fields=${fields}&limit=200&access_token=${FB_TOKEN}`
    );

    const accounts = (body.data || []).map((a: any) => ({
      id: a.id, // formato "act_XXXXX"
      accountId: a.account_id,
      name: a.name || a.id,
      status: STATUS_LABEL[a.account_status] || `code_${a.account_status}`,
      statusCode: a.account_status,
      currency: a.currency || 'USD',
      business: a.business?.name || null,
      timezone: a.timezone_name || null,
      amountSpent: parseFloat(a.amount_spent || '0') / 100, // lifetime spend (centavos → unidade)
    }));

    // Ordena: ativas primeiro, depois por gasto lifetime desc
    accounts.sort((a: any, b: any) => {
      if (a.statusCode === 1 && b.statusCode !== 1) return -1;
      if (a.statusCode !== 1 && b.statusCode === 1) return 1;
      return b.amountSpent - a.amountSpent;
    });

    const result = {
      defaultAccount: DEFAULT_ACCT,
      accounts,
      total: accounts.length,
      fetchedAt: Date.now(),
    };

    _cache = { data: result, ts: Date.now() };
    return json(result);
  } catch (e: any) {
    console.error('[fb-ads/accounts]', e);
    if (_cache) {
      return json({ ...(_cache.data as any), _stale: true, _error: e.message });
    }
    return json({ error: e.message, accounts: [] }, { status: 500 });
  }
};
