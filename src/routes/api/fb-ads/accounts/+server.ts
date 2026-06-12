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

interface NormalizedAccount {
  id: string;
  accountId: string;
  name: string;
  status: string;
  statusCode: number;
  currency: string;
  business: string | null;
  businessId: string | null;
  source: string; // de onde veio: 'user', 'business_owned', 'business_client'
  timezone: string | null;
  amountSpent: number;
}

async function fbFetch(path: string) {
  const r = await fetch(`https://graph.facebook.com/v21.0/${path}`, {
    signal: AbortSignal.timeout(12_000),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err?.error?.message || `FB API ${r.status}`);
  }
  return r.json();
}

// Pagina automaticamente via cursor `paging.next` da Graph API.
// Limite de seguranca: 10 paginas (~10*200 = 2000 itens) pra nao loopar infinito.
async function fbFetchAll(initialPath: string): Promise<any[]> {
  const out: any[] = [];
  let next: string | null = `https://graph.facebook.com/v21.0/${initialPath}`;
  let pages = 0;
  while (next && pages < 10) {
    pages++;
    const r = await fetch(next, { signal: AbortSignal.timeout(12_000) });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err?.error?.message || `FB API ${r.status}`);
    }
    const body = await r.json();
    if (Array.isArray(body.data)) out.push(...body.data);
    next = body.paging?.next || null;
  }
  return out;
}

function normalizeAccount(a: any, source: string, businessFromCtx?: { id: string; name: string } | null): NormalizedAccount {
  const businessName = a.business?.name || businessFromCtx?.name || null;
  const businessId = a.business?.id || businessFromCtx?.id || null;
  return {
    id: a.id,
    accountId: a.account_id || (a.id || '').replace(/^act_/, ''),
    name: a.name || a.id,
    status: STATUS_LABEL[a.account_status] || `code_${a.account_status}`,
    statusCode: a.account_status,
    currency: a.currency || 'USD',
    business: businessName,
    businessId,
    source,
    timezone: a.timezone_name || null,
    amountSpent: parseFloat(a.amount_spent || '0') / 100,
  };
}

export const GET: RequestHandler = async ({ url }) => {
  const force = url.searchParams.get('force') === '1';
  if (!force && _cache && Date.now() - _cache.ts < CACHE_TTL) {
    return json(_cache.data);
  }

  const errors: string[] = [];
  const accountsMap = new Map<string, NormalizedAccount>();
  const accountFields = 'id,account_id,name,account_status,currency,business,timezone_name,amount_spent,disable_reason';

  // 1) Contas atribuidas diretamente ao usuario / system user
  try {
    const userAccounts = await fbFetchAll(
      `me/adaccounts?fields=${accountFields}&limit=200&access_token=${FB_TOKEN}`
    );
    for (const a of userAccounts) {
      const norm = normalizeAccount(a, 'user');
      accountsMap.set(norm.id, norm);
    }
  } catch (e: any) {
    errors.push(`me/adaccounts: ${e.message}`);
  }

  // 2) Lista todos os BMs que o token tem acesso
  let businesses: { id: string; name: string }[] = [];
  try {
    const bms = await fbFetchAll(
      `me/businesses?fields=id,name&limit=100&access_token=${FB_TOKEN}`
    );
    businesses = bms.map((b: any) => ({ id: b.id, name: b.name || b.id }));
  } catch (e: any) {
    errors.push(`me/businesses: ${e.message}`);
  }

  // 3) Para cada BM, pega owned + client ad accounts em paralelo
  if (businesses.length) {
    const bmPromises = businesses.flatMap((biz) => [
      fbFetchAll(`${biz.id}/owned_ad_accounts?fields=${accountFields}&limit=200&access_token=${FB_TOKEN}`)
        .then((accs) => ({ source: 'business_owned', biz, accs }))
        .catch((e) => { errors.push(`${biz.id}/owned: ${e.message}`); return null; }),
      fbFetchAll(`${biz.id}/client_ad_accounts?fields=${accountFields}&limit=200&access_token=${FB_TOKEN}`)
        .then((accs) => ({ source: 'business_client', biz, accs }))
        .catch((e) => { errors.push(`${biz.id}/client: ${e.message}`); return null; }),
    ]);

    const results = await Promise.all(bmPromises);
    for (const r of results) {
      if (!r) continue;
      for (const a of r.accs) {
        const norm = normalizeAccount(a, r.source, r.biz);
        // Se ja existe (vinda de me/adaccounts), enriquece o business name
        const existing = accountsMap.get(norm.id);
        if (existing) {
          if (!existing.business && norm.business) existing.business = norm.business;
          if (!existing.businessId && norm.businessId) existing.businessId = norm.businessId;
        } else {
          accountsMap.set(norm.id, norm);
        }
      }
    }
  }

  const accounts = [...accountsMap.values()];

  // Ordena: ativas primeiro, depois por gasto lifetime desc, depois por nome
  accounts.sort((a, b) => {
    if (a.statusCode === 1 && b.statusCode !== 1) return -1;
    if (a.statusCode !== 1 && b.statusCode === 1) return 1;
    if (b.amountSpent !== a.amountSpent) return b.amountSpent - a.amountSpent;
    return (a.name || '').localeCompare(b.name || '');
  });

  const result = {
    defaultAccount: DEFAULT_ACCT,
    accounts,
    total: accounts.length,
    businessCount: businesses.length,
    businesses: businesses.map((b) => ({ id: b.id, name: b.name })),
    errors: errors.length ? errors : undefined,
    fetchedAt: Date.now(),
  };

  // Cacheia apenas se conseguiu pelo menos algumas contas
  if (accounts.length > 0) {
    _cache = { data: result, ts: Date.now() };
  } else if (errors.length && _cache) {
    // Falha total mas tem cache antigo: serve stale
    return json({ ...(_cache.data as any), _stale: true, _errors: errors });
  }

  return json(result);
};
