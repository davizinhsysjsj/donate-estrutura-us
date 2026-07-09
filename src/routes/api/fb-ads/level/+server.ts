import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getFbToken, getDefaultAccountId, maybeRefreshInBackground } from '$lib/server/fb-token';
import { getPurchasesByDimension } from '$lib/server/analytics';

/**
 * Retorna string YYYY-MM-DD do dia atual no fuso America/Sao_Paulo com offset opcional.
 */
function brtDate(offsetDays = 0): string {
  const TZ = 'America/Sao_Paulo';
  const now = new Date();
  const dateStr = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ }).format(now);
  if (offsetDays === 0) return dateStr;
  const [y, m, d] = dateStr.split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + offsetDays));
  return shifted.toISOString().slice(0, 10);
}

/**
 * Substitui date_preset por time_range com fuso BRT explícito pra que
 * Meta use a mesma janela do dashboard (00:00 → 23:59 BRT).
 */
function dateFilterFor(preset: string): string {
  if (preset === 'today' || preset === 'yesterday') {
    const date = preset === 'today' ? brtDate(0) : brtDate(-1);
    const range = { since: date, until: date, time_zone: 'America/Sao_Paulo' };
    return `time_range=${encodeURIComponent(JSON.stringify(range))}`;
  }
  return `date_preset=${preset}`;
}

// Cache em memoria curto — drill-down e refrescado com mais frequencia que campanhas
const _cache: Record<string, { data: any; ts: number }> = {};
const CACHE_TTL = 90 * 1000; // 90s

const PRESET_MAP: Record<string, string> = {
  '2m':  'today', '15m': 'today', '1h': 'today',
  '6h':  'today', '24h': 'today', '7d': 'last_7d',
  'today':        'today',
  'yesterday':    'yesterday',
  'last_7_d':     'last_7d',
  'last_14_d':    'last_14d',
  'last_30_d':    'last_30d',
  'this_month':   'this_month',
};

function normalizeAcct(raw: string | null): string {
  if (!raw) return getDefaultAccountId();
  const m = raw.trim().match(/^(?:act_)?(\d{6,20})$/);
  if (!m) return getDefaultAccountId();
  return `act_${m[1]}`;
}

function normalizeId(raw: string | null): string {
  const m = (raw || '').trim().match(/^\d{6,25}$/);
  if (!m) throw new Error('parent invalido');
  return m[0];
}

async function fbFetch(path: string) {
  const r = await fetch(`https://graph.facebook.com/v21.0/${path}`, { signal: AbortSignal.timeout(12_000) });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err?.error?.message || `FB API ${r.status}`);
  }
  return r.json();
}

function findActionFirst(arr: any[] | undefined, types: string[]): number {
  if (!arr) return 0;
  for (const t of types) {
    const m = arr.find((a: any) => a.action_type === t);
    if (m) return parseFloat(m.value || '0');
  }
  return 0;
}

function parseInsight(d: any) {
  const spend = parseFloat(d.spend || '0');
  const impressions = parseInt(d.impressions || '0');
  const clicks = parseInt(d.inline_link_clicks || '0');
  const totalClicks = parseInt(d.clicks || '0');
  const landingPageViews = findActionFirst(d.actions, ['omni_landing_page_view','landing_page_view']);
  const viewContent      = findActionFirst(d.actions, ['omni_view_content','offsite_conversion.fb_pixel_view_content','view_content']);
  const addToCart        = findActionFirst(d.actions, ['omni_add_to_cart','offsite_conversion.fb_pixel_add_to_cart','add_to_cart']);
  const initiateCheckout = findActionFirst(d.actions, ['omni_initiated_checkout','offsite_conversion.fb_pixel_initiate_checkout','initiate_checkout']);
  const purchases        = findActionFirst(d.actions, ['omni_purchase','offsite_conversion.fb_pixel_purchase','purchase']);
  const purchaseValue    = findActionFirst(d.action_values, ['omni_purchase','offsite_conversion.fb_pixel_purchase','purchase']);
  return {
    spend, impressions, clicks, totalClicks,
    reach: parseInt(d.reach || '0'),
    frequency: parseFloat(d.frequency || '0'),
    cpm: parseFloat(d.cpm || '0'),
    cpc: parseFloat(d.cpc || '0'),
    ctr: parseFloat(d.ctr || '0'),
    landingPageViews, viewContent, addToCart, initiateCheckout, purchases, purchaseValue,
    roas: spend > 0 ? purchaseValue / spend : 0,
    cpa:  purchases > 0 ? spend / purchases : 0,
    costPerLPV: landingPageViews > 0 ? spend / landingPageViews : 0,
  };
}

/**
 * GET /api/fb-ads/level
 * Params:
 *   - level: 'adset' | 'ad'                    (obrigatorio)
 *   - parents: CSV de campaign_ids ou adset_ids (opcional — se vazio, retorna TUDO da conta)
 *   - parent: alias legacy de 1 id (compat)
 *   - account_id: 'act_...' (opcional, usa default)
 *   - window: '7d' | 'today' | ... (default 'today')
 *   - nocache=1 ignora cache
 */
export const GET: RequestHandler = async ({ url }) => {
  const level = url.searchParams.get('level');
  if (level !== 'adset' && level !== 'ad') return json({ error: 'level invalido (use adset|ad)' }, { status: 400 });

  // Aceita parents=CSV ou parent=ID (legacy). Vazio = todos da conta.
  const rawParents = url.searchParams.get('parents') || url.searchParams.get('parent') || '';
  const parents = rawParents
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => /^\d{6,25}$/.test(s));

  const FB_ACCT  = normalizeAcct(url.searchParams.get('account_id'));
  const FB_TOKEN = getFbToken();
  const win      = url.searchParams.get('window') || 'today';
  const preset   = PRESET_MAP[win] || 'today';
  const skipCache = url.searchParams.get('nocache') === '1';
  maybeRefreshInBackground();

  // Live attribution helper — sobrepoe purchases server-side quando > Meta.
  // Aplicado em TODOS os retornos (cache hit ou miss) pra nao "congelar"
  // a contagem durante o TTL do cache. Clone o array de items antes de mutar.
  const MS_DAY = 24 * 60 * 60 * 1000;
  function windowMsForPreset(p: string): number {
    switch (p) {
      case 'today':       return MS_DAY;
      case 'yesterday':   return 2 * MS_DAY;
      case 'last_7d':     return 7 * MS_DAY;
      case 'last_14d':    return 14 * MS_DAY;
      case 'last_30d':    return 30 * MS_DAY;
      case 'this_month':  return 31 * MS_DAY;
      default:            return MS_DAY;
    }
  }
  function applyLiveAttribution(payload: any) {
    if (!payload || !Array.isArray(payload.items) || payload.items.length === 0) return payload;
    const dim: 'utm_term' | 'utm_content' = level === 'adset' ? 'utm_term' : 'utm_content';
    const live = getPurchasesByDimension(dim, windowMsForPreset(preset));
    if (live.size === 0) return payload;
    const items = payload.items.map((it: any) => ({ ...it }));
    for (const [key, agg] of live.entries()) {
      if (!key) continue;
      const matches = items.filter((it: any) => {
        const n = String(it.name || '').toLowerCase();
        return n && (n.includes(key) || key.includes(n));
      });
      if (matches.length === 0) continue;
      matches.sort((a: any, b: any) => (b.spend || 0) - (a.spend || 0));
      const target = matches[0];
      if (agg.purchases > (target.purchases || 0)) {
        target.purchases = agg.purchases;
        target.purchaseValue = agg.purchaseValue;
        target.roas = target.spend > 0 ? target.purchaseValue / target.spend : 0;
        target.cpa = target.purchases > 0 ? target.spend / target.purchases : 0;
        target.liveAttribution = true;
      }
    }
    return { ...payload, items };
  }

  const parentsKey = parents.length ? parents.slice().sort().join(',') : '__all__';
  const cacheKey = `${FB_ACCT}-${level}-${parentsKey}-${win}`;
  if (!skipCache) {
    const cached = _cache[cacheKey];
    if (cached && Date.now() - cached.ts < CACHE_TTL) return json(applyLiveAttribution(cached.data));
  }

  const idField = level === 'adset' ? 'adset_id,adset_name' : 'ad_id,ad_name';
  const filterField = level === 'adset' ? 'campaign.id' : 'adset.id';
  const insightFields = [
    idField,
    'spend','impressions','inline_link_clicks','clicks','reach','frequency',
    'ctr','cpm','cpc','actions','action_values',
  ].join(',');

  // Se tem parents -> filtering. Senao -> sem filtering (tudo da conta).
  const filteringQuery = parents.length
    ? `&filtering=${encodeURIComponent(JSON.stringify([{ field: filterField, operator: 'IN', value: parents }]))}`
    : '';

  try {
    // Insights (1 chamada agregada)
    const insightsBody = await fbFetch(
      `${FB_ACCT}/insights?level=${level}${filteringQuery}&${dateFilterFor(preset)}&fields=${insightFields}&limit=500&access_token=${FB_TOKEN}`
    );

    // Metadata: se nao tem parents, busca tudo da conta. Se tem, busca por parent em paralelo.
    let metaMap = new Map<string, any>();
    const metaSources: string[] = parents.length
      ? parents.map((p) => p)
      : [FB_ACCT]; // pra "tudo", uma so chamada no account-level

    if (level === 'adset') {
      const metaBodies = await Promise.all(metaSources.map((src) =>
        fbFetch(`${src}/adsets?fields=id,name,status,effective_status,daily_budget,lifetime_budget,bid_amount,optimization_goal,created_time,campaign_id&limit=500&access_token=${FB_TOKEN}`)
          .catch(() => ({ data: [] }))
      ));
      for (const body of metaBodies) {
        for (const a of body.data || []) {
          metaMap.set(a.id, {
            name: a.name,
            status: a.status,
            effectiveStatus: a.effective_status,
            dailyBudget: a.daily_budget ? parseInt(a.daily_budget) / 100 : null,
            lifetimeBudget: a.lifetime_budget ? parseInt(a.lifetime_budget) / 100 : null,
            optimizationGoal: a.optimization_goal || null,
            createdTime: a.created_time,
            parentId: a.campaign_id || null,
          });
        }
      }
    } else {
      const adFields = 'id,name,status,effective_status,created_time,adset_id,campaign_id,creative{id,thumbnail_url,image_url,video_id,body,title,object_story_id,instagram_permalink_url,effective_object_story_id,object_story_spec,asset_feed_spec}';
      const metaBodies = await Promise.all(metaSources.map((src) =>
        fbFetch(`${src}/ads?fields=${adFields}&limit=500&access_token=${FB_TOKEN}`)
          .catch(() => ({ data: [] }))
      ));
      const allAds = metaBodies.flatMap((b) => b.data || []);
      // Coleta video_ids unicos pra batch fetch de URL do MP4
      const videoIds = new Set<string>();
      for (const a of allAds) {
        const vid = a.creative?.video_id || a.creative?.asset_feed_spec?.videos?.[0]?.video_id;
        if (vid) videoIds.add(String(vid));
      }
      // Fetch video sources em paralelo
      const videoSources = new Map<string, { source?: string; permalink?: string; picture?: string }>();
      await Promise.all([...videoIds].map(async (vid) => {
        try {
          const v = await fbFetch(`${vid}?fields=source,permalink_url,picture&access_token=${FB_TOKEN}`);
          videoSources.set(vid, { source: v.source, permalink: v.permalink_url, picture: v.picture });
        } catch {
          videoSources.set(vid, {});
        }
      }));

      for (const a of allAds) {
        const cr = a.creative || {};
        const vid = cr.video_id || cr.asset_feed_spec?.videos?.[0]?.video_id || null;
        const videoMeta = vid ? videoSources.get(String(vid)) : undefined;
        const fallbackThumb = cr.thumbnail_url || cr.image_url || videoMeta?.picture || null;
        metaMap.set(a.id, {
          name: a.name,
          status: a.status,
          effectiveStatus: a.effective_status,
          createdTime: a.created_time,
          parentId: a.adset_id || null,
          campaignId: a.campaign_id || null,
          creative: {
            id: cr.id || null,
            thumbnailUrl: fallbackThumb,
            imageUrl: cr.image_url || null,
            videoId: vid,
            videoSourceUrl: videoMeta?.source || null,
            permalinkUrl: videoMeta?.permalink || cr.instagram_permalink_url || null,
            body: cr.body || cr.asset_feed_spec?.bodies?.[0]?.text || null,
            title: cr.title || cr.asset_feed_spec?.titles?.[0]?.text || null,
          },
        });
      }
    }

    const items = (insightsBody.data || []).map((c: any) => {
      const id   = level === 'adset' ? c.adset_id : c.ad_id;
      const name = level === 'adset' ? c.adset_name : c.ad_name;
      const meta = metaMap.get(id) || {};
      const p = parseInsight(c);
      return {
        id, name,
        status: meta.status || null,
        effectiveStatus: meta.effectiveStatus || null,
        dailyBudget: meta.dailyBudget ?? null,
        lifetimeBudget: meta.lifetimeBudget ?? null,
        optimizationGoal: meta.optimizationGoal ?? null,
        createdTime: meta.createdTime ?? null,
        parentId: meta.parentId ?? null,         // campaign_id (adset) ou adset_id (ad)
        campaignId: meta.campaignId ?? null,     // so para ads
        spend: p.spend, impressions: p.impressions, clicks: p.clicks, totalClicks: p.totalClicks,
        reach: p.reach, frequency: p.frequency,
        ctr: p.ctr, cpm: p.cpm, cpc: p.cpc,
        landingPageViews: p.landingPageViews,
        viewContent: p.viewContent, addToCart: p.addToCart, initiateCheckout: p.initiateCheckout,
        purchases: p.purchases, purchaseValue: p.purchaseValue,
        roas: p.roas, cpa: p.cpa, costPerLPV: p.costPerLPV,
        creative: meta.creative ?? null,
      };
    });

    // ── Inclui adsets/ads existentes mas SEM insights (sem gasto/impressoes ainda) ──
    // Mesmo padrao que o endpoint de campanhas: usuario quer ver tudo que existe,
    // mesmo zerado. Filtra por parents se informado.
    const seen = new Set(items.map((i: any) => i.id));
    const parentSet = parents.length ? new Set(parents) : null;
    for (const [id, meta] of metaMap.entries()) {
      if (seen.has(id)) continue;
      // Se ha filtro por parents, so inclui se o parentId/campaignId bater
      if (parentSet) {
        const matchesParent =
          (meta.parentId && parentSet.has(String(meta.parentId))) ||
          (meta.campaignId && parentSet.has(String(meta.campaignId)));
        if (!matchesParent) continue;
      }
      items.push({
        id,
        name: (meta as any).name || meta.creative?.title || '(sem nome)',
        status: meta.status || null,
        effectiveStatus: meta.effectiveStatus || null,
        dailyBudget: meta.dailyBudget ?? null,
        lifetimeBudget: meta.lifetimeBudget ?? null,
        optimizationGoal: meta.optimizationGoal ?? null,
        createdTime: meta.createdTime ?? null,
        parentId: meta.parentId ?? null,
        campaignId: meta.campaignId ?? null,
        spend: 0, impressions: 0, clicks: 0, totalClicks: 0,
        reach: 0, frequency: 0,
        ctr: 0, cpm: 0, cpc: 0,
        landingPageViews: 0,
        viewContent: 0, addToCart: 0, initiateCheckout: 0,
        purchases: 0, purchaseValue: 0,
        roas: 0, cpa: 0, costPerLPV: 0,
        creative: meta.creative ?? null,
      });
    }

    const payload = { level, parents, accountId: FB_ACCT, datePreset: preset, items };
    _cache[cacheKey] = { data: payload, ts: Date.now() };
    return json(applyLiveAttribution(payload));
  } catch (e: any) {
    console.error('[fb-ads/level]', e);
    return json({ error: e.message }, { status: 500 });
  }
};
