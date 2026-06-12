import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import fs from 'node:fs';
import path from 'node:path';
import { getFbToken, getDefaultAccountId } from '$lib/server/fb-token';

// Cache em memória por chave
const _cache: Record<string, { data: any; ts: number }> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Persistência em disco — sobrevive a restarts do Railway
const DISK_CACHE_PATH = '/data/fb-ads-cache.json';

function loadDiskCache(): void {
  try {
    if (fs.existsSync(DISK_CACHE_PATH)) {
      const raw = fs.readFileSync(DISK_CACHE_PATH, 'utf8');
      const saved = JSON.parse(raw) as Record<string, { data: any; ts: number }>;
      // Carrega tudo — mesmo entradas antigas servem como fallback se FB API falhar
      Object.assign(_cache, saved);
    }
  } catch { /* ignora */ }
}

function saveDiskCache(): void {
  try {
    fs.mkdirSync(path.dirname(DISK_CACHE_PATH), { recursive: true });
    fs.writeFileSync(DISK_CACHE_PATH, JSON.stringify(_cache), 'utf8');
  } catch { /* ignora */ }
}

// Carrega na inicialização
loadDiskCache();

// Mapeia janela do dashboard para date_preset da FB API
const PRESET_MAP: Record<string, string> = {
  '2m':  'today', '15m': 'today', '1h': 'today',
  '6h':  'today', '24h': 'today', '7d': 'last_7_d',
  'today':        'today',
  'yesterday':    'yesterday',
  'hoje_ontem':   '__hoje_ontem__', // especial — soma hoje + ontem
  'last_7_d':     'last_7_d',
  'last_14_d':    'last_14_d',
  'last_30_d':    'last_30_d',
  'this_month':   'this_month',
};

// Aceita "act_123" ou "123" e normaliza para "act_123". Bloqueia chars inválidos.
function normalizeAcct(raw: string | null): string {
  if (!raw) return getDefaultAccountId();
  const trimmed = raw.trim();
  // Apenas dígitos (com ou sem prefixo act_) — evita injection na URL
  const m = trimmed.match(/^(?:act_)?(\d{6,20})$/);
  if (!m) return getDefaultAccountId();
  return `act_${m[1]}`;
}

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

function parseInsight(d: any) {
  return {
    spend:         parseFloat(d.spend        || '0'),
    impressions:   parseInt  (d.impressions  || '0'),
    clicks:        parseInt  (d.inline_link_clicks || '0'),
    reach:         parseInt  (d.reach        || '0'),
    cpm:           parseFloat(d.cpm          || '0'),
    cpc:           parseFloat(d.cpc          || '0'),
    ctr:           parseFloat(d.ctr          || '0'),
    purchases:     parseInt  (findAction(d.actions,       'purchase')),
    purchaseValue: parseFloat(findAction(d.action_values, 'purchase')),
  };
}

function sumInsights(a: ReturnType<typeof parseInsight>, b: ReturnType<typeof parseInsight>) {
  const totalSpend = a.spend + b.spend;
  const totalImpr  = a.impressions + b.impressions;
  const totalClicks = a.clicks + b.clicks;
  const totalReach  = a.reach + b.reach;
  return {
    spend:         totalSpend,
    impressions:   totalImpr,
    clicks:        totalClicks,
    reach:         totalReach,
    // CPM/CPC/CTR recalculados ponderados
    cpm:   totalImpr  > 0 ? (totalSpend / totalImpr)  * 1000 : 0,
    cpc:   totalClicks > 0 ? totalSpend / totalClicks : 0,
    ctr:   totalImpr  > 0 ? (totalClicks / totalImpr) * 100  : 0,
    purchases:     a.purchases + b.purchases,
    purchaseValue: a.purchaseValue + b.purchaseValue,
  };
}

export const GET: RequestHandler = async ({ url }) => {
  const win          = url.searchParams.get('window') || '24h';
  const withCampaigns = url.searchParams.get('campaigns') === '1';
  const preset       = PRESET_MAP[win] || 'today';
  const FB_ACCT      = normalizeAcct(url.searchParams.get('account_id'));
  const FB_TOKEN     = getFbToken();

  const cacheKey = `${FB_ACCT}-${win}-${withCampaigns}`;
  const cached = _cache[cacheKey];
  if (cached && Date.now() - cached.ts < CACHE_TTL) return json(cached.data);

  try {
    const fields = [
      'spend','impressions','inline_link_clicks','reach',
      'cpm','cpc','ctr','actions','action_values','account_currency',
    ].join(',');

    // ── Caso especial: Hoje + Ontem ───────────────────────────────────
    if (preset === '__hoje_ontem__') {
      const [todayBody, yesterdayBody] = await Promise.all([
        fbFetch(`${FB_ACCT}/insights?fields=${fields}&date_preset=today&access_token=${FB_TOKEN}`),
        fbFetch(`${FB_ACCT}/insights?fields=${fields}&date_preset=yesterday&access_token=${FB_TOKEN}`),
      ]);

      const td = todayBody.data?.[0];
      const yd = yesterdayBody.data?.[0];

      const empty = { spend: 0, impressions: 0, clicks: 0, reach: 0, cpm: 0, cpc: 0, ctr: 0, purchases: 0, purchaseValue: 0 };
      const combined = sumInsights(
        td ? parseInsight(td) : empty,
        yd ? parseInsight(yd) : empty
      );

      let campaigns: any[] = [];
      if (withCampaigns) {
        const camFields = 'campaign_name,spend,impressions,inline_link_clicks,ctr,cpm,cpc';
        const [tcb, ycb] = await Promise.all([
          fbFetch(`${FB_ACCT}/insights?fields=${camFields}&date_preset=today&level=campaign&access_token=${FB_TOKEN}`),
          fbFetch(`${FB_ACCT}/insights?fields=${camFields}&date_preset=yesterday&level=campaign&access_token=${FB_TOKEN}`),
        ]);
        // Merge campaigns por nome
        const map = new Map<string, any>();
        for (const c of [...(tcb.data || []), ...(ycb.data || [])]) {
          const key = c.campaign_name;
          if (map.has(key)) {
            const ex = map.get(key);
            const newSpend = ex.spend + parseFloat(c.spend || '0');
            const newImpr  = ex.impressions + parseInt(c.impressions || '0');
            const newClicks = ex.clicks + parseInt(c.inline_link_clicks || '0');
            map.set(key, {
              ...ex,
              spend: newSpend,
              impressions: newImpr,
              clicks: newClicks,
              ctr: newImpr > 0 ? (newClicks / newImpr) * 100 : 0,
              cpm: newImpr > 0 ? (newSpend / newImpr) * 1000 : 0,
              cpc: newClicks > 0 ? newSpend / newClicks : 0,
            });
          } else {
            map.set(key, {
              name: c.campaign_name,
              spend: parseFloat(c.spend || '0'),
              impressions: parseInt(c.impressions || '0'),
              clicks: parseInt(c.inline_link_clicks || '0'),
              ctr: parseFloat(c.ctr || '0'),
              cpm: parseFloat(c.cpm || '0'),
              cpc: parseFloat(c.cpc || '0'),
            });
          }
        }
        campaigns = [...map.values()];
      }

      const accCurrency = (td?.account_currency || yd?.account_currency || 'USD') as string;
      const result = { ...combined, currency: accCurrency, accountId: FB_ACCT, datePreset: 'hoje_ontem', campaigns };
      _cache[cacheKey] = { data: result, ts: Date.now() };
      saveDiskCache();
      return json(result);
    }

    // ── Caso normal ───────────────────────────────────────────────────
    const body = await fbFetch(
      `${FB_ACCT}/insights?fields=${fields}&date_preset=${preset}&access_token=${FB_TOKEN}`
    );
    const d = body.data?.[0];

    let campaigns: any[] = [];
    if (withCampaigns) {
      const camFields = 'campaign_name,spend,impressions,clicks,ctr,cpm,cpc';
      const cb = await fbFetch(
        `${FB_ACCT}/insights?fields=${camFields}&date_preset=${preset}&level=campaign&access_token=${FB_TOKEN}`
      );
      campaigns = (cb.data || []).map((c: any) => ({
        name:        c.campaign_name,
        spend:       parseFloat(c.spend               || '0'),
        impressions: parseInt  (c.impressions          || '0'),
        clicks:      parseInt  (c.inline_link_clicks   || '0'),
        ctr:         parseFloat(c.ctr          || '0'),
        cpm:         parseFloat(c.cpm          || '0'),
        cpc:         parseFloat(c.cpc          || '0'),
      }));
    }

    if (!d) {
      const empty = {
        spend: 0, impressions: 0, clicks: 0, reach: 0,
        cpm: 0, cpc: 0, ctr: 0, purchases: 0, purchaseValue: 0,
        currency: 'USD', accountId: FB_ACCT, datePreset: preset, campaigns,
      };
      _cache[cacheKey] = { data: empty, ts: Date.now() };
      saveDiskCache();
      return json(empty);
    }

    const result = {
      ...parseInsight(d),
      currency:   (d.account_currency || 'USD') as string,
      accountId:   FB_ACCT,
      datePreset:  preset,
      campaigns,
    };

    _cache[cacheKey] = { data: result, ts: Date.now() };
    saveDiskCache();
    return json(result);

  } catch (e: any) {
    console.error('[fb-ads]', e);
    // Fallback: retorna último dado salvo em disco (evita zerar o spend no dashboard)
    const stale = _cache[cacheKey];
    if (stale) {
      console.warn('[fb-ads] retornando dado stale do cache (FB API falhou)');
      return json({ ...stale.data, _stale: true, _error: e.message });
    }
    return json({ error: e.message, spend: 0 }, { status: 500 });
  }
};
