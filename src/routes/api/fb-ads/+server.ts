import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

// Cache em memória por chave
const _cache: Record<string, { data: any; ts: number }> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Mapeia janela do dashboard para date_preset da FB API
const PRESET_MAP: Record<string, string> = {
  '2m':  'today', '15m': 'today', '1h': 'today',
  '6h':  'today', '24h': 'today', '7d': 'last_7_d',
  'today':      'today',
  'yesterday':  'yesterday',
  'last_7_d':   'last_7_d',
  'last_14_d':  'last_14_d',
  'last_30_d':  'last_30_d',
  'this_month': 'this_month',
};

// Token permanente (System User — sem expiração, somente leitura de ads)
const FB_TOKEN = env.FB_ADS_TOKEN ||
  'EAASpkEKZBxb8BRkZAvHccwFXjbEUJcgkb7qzwZBfx6t6qkNJMMPrIitCI3YQATc9iiqZCo6OrrYkGhFdrULwg0z1aBBWoFMhHJx0TzC8T9T01nRKmAtZA0PJyn3fgNZBhuQ1Mg8J1KA1XeDPMJIZC41J8CMREjCiAWnyOqHyQI1qQ9vqeIdftvZBsHY9jcRn7wZDZD';
const FB_ACCT = env.FB_ADS_ACCOUNT_ID || 'act_1451507589956064';

function findAction(arr: any[] | undefined, type: string): string {
  return arr?.find((a: any) => a.action_type === type)?.value || '0';
}

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
  const win          = url.searchParams.get('window') || '24h';
  const preset       = PRESET_MAP[win] || 'today';
  const withCampaigns = url.searchParams.get('campaigns') === '1';

  const cacheKey = `${preset}-${withCampaigns}`;
  const cached = _cache[cacheKey];
  if (cached && Date.now() - cached.ts < CACHE_TTL) return json(cached.data);

  try {
    // ── Totais da conta ──────────────────────────────────────────────
    const fields = [
      'spend','impressions','clicks','reach',
      'cpm','cpc','ctr','actions','action_values',
    ].join(',');

    const body = await fbFetch(
      `${FB_ACCT}/insights?fields=${fields}&date_preset=${preset}&access_token=${FB_TOKEN}`
    );
    const d = body.data?.[0];

    // ── Breakdown por campanha ────────────────────────────────────────
    let campaigns: any[] = [];
    if (withCampaigns) {
      const camFields = 'campaign_name,spend,impressions,clicks,ctr,cpm,cpc';
      const cb = await fbFetch(
        `${FB_ACCT}/insights?fields=${camFields}&date_preset=${preset}&level=campaign&access_token=${FB_TOKEN}`
      );
      campaigns = (cb.data || []).map((c: any) => ({
        name:        c.campaign_name,
        spend:       parseFloat(c.spend        || '0'),
        impressions: parseInt  (c.impressions  || '0'),
        clicks:      parseInt  (c.clicks       || '0'),
        ctr:         parseFloat(c.ctr          || '0'),
        cpm:         parseFloat(c.cpm          || '0'),
        cpc:         parseFloat(c.cpc          || '0'),
      }));
    }

    if (!d) {
      const empty = {
        spend: 0, impressions: 0, clicks: 0, reach: 0,
        cpm: 0, cpc: 0, ctr: 0, purchases: 0, purchaseValue: 0,
        currency: 'USD', datePreset: preset, campaigns,
      };
      _cache[cacheKey] = { data: empty, ts: Date.now() };
      return json(empty);
    }

    const result = {
      spend:         parseFloat(d.spend        || '0'),
      impressions:   parseInt  (d.impressions  || '0'),
      clicks:        parseInt  (d.clicks       || '0'),
      reach:         parseInt  (d.reach        || '0'),
      cpm:           parseFloat(d.cpm          || '0'),
      cpc:           parseFloat(d.cpc          || '0'),
      ctr:           parseFloat(d.ctr          || '0'),
      purchases:     parseInt  (findAction(d.actions,       'purchase')),
      purchaseValue: parseFloat(findAction(d.action_values, 'purchase')),
      currency:      'USD',
      datePreset:    preset,
      campaigns,
    };

    _cache[cacheKey] = { data: result, ts: Date.now() };
    return json(result);

  } catch (e: any) {
    console.error('[fb-ads]', e);
    return json({ error: e.message, spend: 0 }, { status: 500 });
  }
};
