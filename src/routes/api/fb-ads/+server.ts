import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

// Cache em memória por preset
const _cache: Record<string, { data: any; ts: number }> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Mapeia a janela do dashboard para o date_preset da FB API
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

function findAction(arr: any[] | undefined, type: string): string {
  return arr?.find((a: any) => a.action_type === type)?.value || '0';
}

export const GET: RequestHandler = async ({ url }) => {
  const win    = url.searchParams.get('window') || '24h';
  const preset = PRESET_MAP[win] || 'today';
  const token  = env.FB_ADS_TOKEN;
  const acct   = env.FB_ADS_ACCOUNT_ID || 'act_1451507589956064';

  if (!token) {
    return json({ error: 'FB_ADS_TOKEN não configurado', spend: 0 });
  }

  // Retorna cache se ainda válido
  const cached = _cache[preset];
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return json(cached.data);
  }

  try {
    const fields = [
      'spend', 'impressions', 'clicks', 'reach',
      'cpm', 'cpc', 'ctr',
      'actions', 'action_values',
    ].join(',');

    const fbUrl = `https://graph.facebook.com/v21.0/${acct}/insights` +
      `?fields=${fields}&date_preset=${preset}&access_token=${token}`;

    const r = await fetch(fbUrl, { signal: AbortSignal.timeout(10_000) });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return json({ error: err?.error?.message || 'Erro na FB API', spend: 0 }, { status: 502 });
    }

    const body = await r.json();
    const d = body.data?.[0];

    if (!d) {
      return json({
        spend: 0, impressions: 0, clicks: 0, reach: 0,
        cpm: 0, cpc: 0, ctr: 0, purchases: 0, purchaseValue: 0,
        currency: 'USD', datePreset: preset,
      });
    }

    const result = {
      spend:         parseFloat(d.spend        || '0'),
      impressions:   parseInt(d.impressions    || '0'),
      clicks:        parseInt(d.clicks         || '0'),
      reach:         parseInt(d.reach          || '0'),
      cpm:           parseFloat(d.cpm          || '0'),
      cpc:           parseFloat(d.cpc          || '0'),
      ctr:           parseFloat(d.ctr          || '0'),
      purchases:     parseInt(findAction(d.actions,       'purchase')),
      purchaseValue: parseFloat(findAction(d.action_values, 'purchase')),
      currency:      'USD',
      datePreset:    preset,
    };

    _cache[preset] = { data: result, ts: Date.now() };
    return json(result);

  } catch (e: any) {
    console.error('[fb-ads]', e);
    return json({ error: e.message, spend: 0 }, { status: 500 });
  }
};
