import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import fs from 'node:fs';
import path from 'node:path';
import { getFbToken, getDefaultAccountId, maybeRefreshInBackground } from '$lib/server/fb-token';
import { getPurchasesByCampaign } from '$lib/server/analytics';

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

// A conta Meta já está configurada em America/Sao_Paulo (timezone_name),
// então date_preset=today/yesterday do Meta bate exatamente com "hoje/ontem BRT".
// Não precisa mais forçar time_range com fuso — passar `time_zone` no time_range
// causa erro 100 do Meta ("Invalid keys 'time_zone'") e quebra toda a request.

// Mapeia janela do dashboard para date_preset da FB API.
// IMPORTANTE: Graph API v18+ usa "last_Xd" (sem underscore antes do d).
const PRESET_MAP: Record<string, string> = {
  '2m':  'today', '15m': 'today', '1h': 'today',
  '6h':  'today', '24h': 'today', '7d': 'last_7d',
  'today':        'today',
  'yesterday':    'yesterday',
  'hoje_ontem':   '__hoje_ontem__', // especial — soma hoje + ontem
  'last_7_d':     'last_7d',
  'last_14_d':    'last_14d',
  'last_30_d':    'last_30d',
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

// Pagina via cursor `paging.next` ate esgotar (max 10 paginas = 5000 itens com limit=500)
async function fbFetchAll(initialPath: string): Promise<any[]> {
  const out: any[] = [];
  let next: string | null = `https://graph.facebook.com/v21.0/${initialPath}`;
  let pages = 0;
  while (next && pages < 10) {
    pages++;
    const r = await fetch(next, { signal: AbortSignal.timeout(15_000) });
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


// Procura o PRIMEIRO action_type que existir na lista de prioridade.
// Importante: NAO soma — somar duplica porque o mesmo evento aparece como
// 'purchase' + 'offsite_conversion.fb_pixel_purchase' + 'omni_purchase'
// (Pixel + CAPI + omnichannel). O Meta UI usa 'omni_*' que ja e deduplicado.
function findActionFirst(arr: any[] | undefined, types: string[]): number {
  if (!arr) return 0;
  for (const t of types) {
    const v = arr.find((a: any) => a.action_type === t)?.value;
    if (v) return parseFloat(v);
  }
  return 0;
}

function parseInsight(d: any) {
  const spend = parseFloat(d.spend || '0');
  const impressions = parseInt(d.impressions || '0');
  const clicks = parseInt(d.inline_link_clicks || '0');
  const totalClicks = parseInt(d.clicks || '0');

  // Funil — prioridade: omni (deduplicado) -> offsite_conversion -> bare.
  // Pega o PRIMEIRO disponivel, nunca soma.
  const landingPageViews = findActionFirst(d.actions, ['landing_page_view']);
  const viewContent      = findActionFirst(d.actions, ['omni_view_content', 'offsite_conversion.fb_pixel_view_content', 'view_content']);
  const addToCart        = findActionFirst(d.actions, ['omni_add_to_cart', 'offsite_conversion.fb_pixel_add_to_cart', 'add_to_cart']);
  const initiateCheckout = findActionFirst(d.actions, ['omni_initiated_checkout', 'offsite_conversion.fb_pixel_initiate_checkout', 'initiate_checkout']);
  const purchases        = findActionFirst(d.actions, ['omni_purchase', 'offsite_conversion.fb_pixel_purchase', 'purchase']);
  const purchaseValue    = findActionFirst(d.action_values, ['omni_purchase', 'offsite_conversion.fb_pixel_purchase', 'purchase']);
  const leads            = findActionFirst(d.actions, ['lead', 'offsite_conversion.fb_pixel_lead']);

  return {
    spend, impressions, clicks, totalClicks,
    reach:         parseInt  (d.reach        || '0'),
    frequency:     parseFloat(d.frequency    || '0'),
    cpm:           parseFloat(d.cpm          || '0'),
    cpc:           parseFloat(d.cpc          || '0'),
    ctr:           parseFloat(d.ctr          || '0'),
    landingPageViews, viewContent, addToCart, initiateCheckout, purchases, purchaseValue, leads,
    // Threshold spend >= 1 evita ROAS/CPA absurdos no começo do dia
    // (ex: gasto €0.03 + venda €50 = ROAS 1666x)
    roas:          spend >= 1 ? purchaseValue / spend : 0,
    cpa:           purchases > 0 && spend >= 1 ? spend / purchases : 0,
    costPerLPV:    landingPageViews > 0 && spend >= 1 ? spend / landingPageViews : 0,
  };
}

function sumInsights(a: ReturnType<typeof parseInsight>, b: ReturnType<typeof parseInsight>) {
  const spend = a.spend + b.spend;
  const impressions = a.impressions + b.impressions;
  const clicks = a.clicks + b.clicks;
  const reach = a.reach + b.reach;
  const purchases = a.purchases + b.purchases;
  const purchaseValue = a.purchaseValue + b.purchaseValue;
  const landingPageViews = a.landingPageViews + b.landingPageViews;
  return {
    spend, impressions, clicks, reach,
    totalClicks: a.totalClicks + b.totalClicks,
    frequency: a.frequency,  // mantem o do primeiro periodo (frequency nao soma)
    cpm:   impressions > 0 ? (spend / impressions) * 1000 : 0,
    cpc:   clicks > 0 ? spend / clicks : 0,
    ctr:   impressions > 0 ? (clicks / impressions) * 100  : 0,
    landingPageViews,
    viewContent:       a.viewContent + b.viewContent,
    addToCart:         a.addToCart + b.addToCart,
    initiateCheckout:  a.initiateCheckout + b.initiateCheckout,
    purchases, purchaseValue,
    leads: a.leads + b.leads,
    roas:       spend >= 1 ? purchaseValue / spend : 0,
    cpa:        purchases > 0 && spend >= 1 ? spend / purchases : 0,
    costPerLPV: landingPageViews > 0 && spend >= 1 ? spend / landingPageViews : 0,
  };
}

// ── Live attribution (vendas server-side ainda nao processadas pelo Meta) ──
// O Meta tem delay tipico de 30min-6h pra refletir CAPI no Ads Manager. Como
// nosso webhook Shopify ja grava UTMs+purchase no Vitrack na hora, podemos
// sobrepor o numero de purchases/purchaseValue quando o nosso > Meta.
const MS_DAY = 24 * 60 * 60 * 1000;
function windowMsForPreset(preset: string): number {
  switch (preset) {
    case 'today':       return MS_DAY;
    case 'yesterday':   return 2 * MS_DAY;
    case '__hoje_ontem__': return 2 * MS_DAY;
    case 'last_7d':     return 7 * MS_DAY;
    case 'last_14d':    return 14 * MS_DAY;
    case 'last_30d':    return 30 * MS_DAY;
    case 'this_month':  return 31 * MS_DAY;
    default:            return MS_DAY;
  }
}
// Match: nosso utm_campaign (lowercase) precisa estar contido no name da
// campanha Meta (ou vice-versa). Cobre nomes como "PT-shadow-v2-broad" vs
// utm_campaign=shadow. Quando 2+ matchings, soma todos no maior gasto.
function applyLiveAttribution(data: any, preset: string): any {
  if (!data || !Array.isArray(data.campaigns) || data.campaigns.length === 0) return data;
  const live = getPurchasesByCampaign(windowMsForPreset(preset));
  if (live.size === 0) return data;
  // Clone shallow das campanhas pra nao mutar o cache em memoria/disco
  const campaigns = data.campaigns.map((c: any) => ({ ...c }));
  for (const [utm, agg] of live.entries()) {
    if (!utm) continue;
    // Match por substring bidirecional: utm contido em campaign.name ou vice-versa
    const matches = campaigns.filter((c: any) => {
      const n = String(c.name || '').toLowerCase();
      return n && (n.includes(utm) || utm.includes(n));
    });
    if (matches.length === 0) continue;
    // >1 matching: ataca a de maior spend (mais provavel ativa)
    matches.sort((a: any, b: any) => (b.spend || 0) - (a.spend || 0));
    const target = matches[0];
    // So sobrepoe se nosso > Meta (live attribution adianta, nao retrocede)
    if (agg.purchases > (target.purchases || 0)) {
      target.purchases = agg.purchases;
      target.purchaseValue = agg.purchaseValue;
      target.roas = target.spend >= 1 ? target.purchaseValue / target.spend : 0;
      target.cpa = target.purchases > 0 && target.spend >= 1 ? target.spend / target.purchases : 0;
      target.liveAttribution = true;
    }
  }
  return { ...data, campaigns };
}

export const GET: RequestHandler = async ({ url }) => {
  const win          = url.searchParams.get('window') || '24h';
  const withCampaigns = url.searchParams.get('campaigns') === '1';
  const preset       = PRESET_MAP[win] || 'today';
  const FB_ACCT      = normalizeAcct(url.searchParams.get('account_id'));
  const FB_TOKEN     = getFbToken();
  maybeRefreshInBackground();

  const cacheKey = `${FB_ACCT}-${win}-${withCampaigns}`;
  const skipCache = url.searchParams.get('nocache') === '1';
  if (!skipCache) {
    const cached = _cache[cacheKey];
    if (cached && Date.now() - cached.ts < CACHE_TTL) return json(applyLiveAttribution(cached.data, preset));
  }

  try {
    const fields = [
      'spend','impressions','inline_link_clicks','clicks','reach','frequency',
      'cpm','cpc','ctr','actions','action_values','account_currency',
    ].join(',');
    const camFields = [
      'campaign_id','campaign_name',
      'spend','impressions','inline_link_clicks','clicks','reach','frequency',
      'ctr','cpm','cpc','actions','action_values',
    ].join(',');

    // Carrega metadados das campanhas (status, budget, objective) em paralelo
    // com os insights — independe do periodo.
    async function loadCampaignMeta(): Promise<Map<string, any>> {
      const list = await fbFetchAll(
        `${FB_ACCT}/campaigns?fields=id,name,status,effective_status,daily_budget,lifetime_budget,objective,created_time&limit=500&access_token=${FB_TOKEN}`
      );
      const map = new Map<string, any>();
      for (const c of list) {
        map.set(c.id, {
          name: c.name,
          status: c.status,
          effectiveStatus: c.effective_status,
          dailyBudget: c.daily_budget ? parseInt(c.daily_budget) / 100 : null,
          lifetimeBudget: c.lifetime_budget ? parseInt(c.lifetime_budget) / 100 : null,
          objective: c.objective,
          createdTime: c.created_time,
        });
      }
      return map;
    }

    function shapeCampaign(c: any, meta?: any) {
      const p = parseInsight(c);
      return {
        id:          c.campaign_id,
        name:        c.campaign_name,
        status:      meta?.status || null,
        effectiveStatus: meta?.effectiveStatus || null,
        dailyBudget: meta?.dailyBudget ?? null,
        lifetimeBudget: meta?.lifetimeBudget ?? null,
        objective:   meta?.objective || null,
        spend:       p.spend,
        impressions: p.impressions,
        clicks:      p.clicks,
        totalClicks: p.totalClicks,
        reach:       p.reach,
        frequency:   p.frequency,
        ctr:         p.ctr,
        cpm:         p.cpm,
        cpc:         p.cpc,
        landingPageViews: p.landingPageViews,
        viewContent:      p.viewContent,
        addToCart:        p.addToCart,
        initiateCheckout: p.initiateCheckout,
        purchases:        p.purchases,
        purchaseValue:    p.purchaseValue,
        leads:            p.leads,
        roas:             p.roas,
        cpa:              p.cpa,
        costPerLPV:       p.costPerLPV,
      };
    }

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
        const camQS = `fields=${camFields}&level=campaign&limit=500&access_token=${FB_TOKEN}`;
        const [todayList, yestList, metaMap] = await Promise.all([
          fbFetchAll(`${FB_ACCT}/insights?${camQS}&date_preset=today`),
          fbFetchAll(`${FB_ACCT}/insights?${camQS}&date_preset=yesterday`),
          loadCampaignMeta(),
        ]);
        // Merge por campaign_id — soma metricas dos 2 periodos
        const map = new Map<string, any>();
        for (const c of [...todayList, ...yestList]) {
          const key = c.campaign_id;
          if (!key) continue;
          if (map.has(key)) {
            const ex = map.get(key);
            const shaped = shapeCampaign(c, metaMap.get(key));
            // Soma metricas
            const merged: any = { ...ex };
            (['spend','impressions','clicks','totalClicks','reach','landingPageViews','viewContent','addToCart','initiateCheckout','purchases','purchaseValue','leads'] as const).forEach((k) => {
              merged[k] = (ex[k] || 0) + (shaped[k] || 0);
            });
            // Recalcula taxas
            merged.cpm = merged.impressions > 0 ? (merged.spend / merged.impressions) * 1000 : 0;
            merged.cpc = merged.clicks > 0 ? merged.spend / merged.clicks : 0;
            merged.ctr = merged.impressions > 0 ? (merged.clicks / merged.impressions) * 100 : 0;
            merged.roas = merged.spend >= 1 ? merged.purchaseValue / merged.spend : 0;
            merged.cpa = merged.purchases > 0 && merged.spend >= 1 ? merged.spend / merged.purchases : 0;
            merged.costPerLPV = merged.landingPageViews > 0 && merged.spend >= 1 ? merged.spend / merged.landingPageViews : 0;
            map.set(key, merged);
          } else {
            map.set(key, shapeCampaign(c, metaMap.get(key)));
          }
        }
        // Adiciona campanhas que existem no metaMap mas não tiveram insights
        // (publicadas, sem gasto ainda) — pra aparecerem na lista
        for (const [id, meta] of metaMap.entries()) {
          if (map.has(id)) continue;
          map.set(id, {
            id,
            name: meta.name || '',
            status: meta.status,
            effectiveStatus: meta.effectiveStatus,
            dailyBudget: meta.dailyBudget,
            lifetimeBudget: meta.lifetimeBudget,
            objective: meta.objective,
            spend: 0, impressions: 0, clicks: 0, totalClicks: 0,
            reach: 0, frequency: 0, ctr: 0, cpm: 0, cpc: 0,
            landingPageViews: 0, viewContent: 0, addToCart: 0, initiateCheckout: 0,
            purchases: 0, purchaseValue: 0, leads: 0,
            roas: 0, cpa: 0, costPerLPV: 0,
          });
        }
        campaigns = [...map.values()];
      }

      const accCurrency = (td?.account_currency || yd?.account_currency || 'USD') as string;
      const result = { ...combined, currency: accCurrency, accountId: FB_ACCT, datePreset: 'hoje_ontem', campaigns };
      _cache[cacheKey] = { data: result, ts: Date.now() };
      saveDiskCache();
      return json(applyLiveAttribution(result, preset));
    }

    // ── Caso normal ───────────────────────────────────────────────────
    const dateFilter = `date_preset=${preset}`;
    const body = await fbFetch(
      `${FB_ACCT}/insights?fields=${fields}&${dateFilter}&access_token=${FB_TOKEN}`
    );
    const d = body.data?.[0];

    let campaigns: any[] = [];
    if (withCampaigns) {
      const [list, metaMap] = await Promise.all([
        fbFetchAll(`${FB_ACCT}/insights?fields=${camFields}&${dateFilter}&level=campaign&limit=500&access_token=${FB_TOKEN}`),
        loadCampaignMeta(),
      ]);
      campaigns = list.map((c: any) => shapeCampaign(c, metaMap.get(c.campaign_id)));
      // Adiciona campanhas publicadas sem insights (sem gasto ainda)
      const seen = new Set(campaigns.map((c) => c.id));
      for (const [id, meta] of metaMap.entries()) {
        if (seen.has(id)) continue;
        campaigns.push({
          id,
          name: meta.name || '',
          status: meta.status,
          effectiveStatus: meta.effectiveStatus,
          dailyBudget: meta.dailyBudget,
          lifetimeBudget: meta.lifetimeBudget,
          objective: meta.objective,
          spend: 0, impressions: 0, clicks: 0, totalClicks: 0,
          reach: 0, frequency: 0, ctr: 0, cpm: 0, cpc: 0,
          landingPageViews: 0, viewContent: 0, addToCart: 0, initiateCheckout: 0,
          purchases: 0, purchaseValue: 0, leads: 0,
          roas: 0, cpa: 0, costPerLPV: 0,
        });
      }
    }

    if (!d) {
      const empty = {
        spend: 0, impressions: 0, clicks: 0, reach: 0,
        cpm: 0, cpc: 0, ctr: 0, purchases: 0, purchaseValue: 0,
        currency: 'USD', accountId: FB_ACCT, datePreset: preset, campaigns,
      };
      _cache[cacheKey] = { data: empty, ts: Date.now() };
      saveDiskCache();
      return json(applyLiveAttribution(empty, preset));
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
    return json(applyLiveAttribution(result, preset));

  } catch (e: any) {
    console.error('[fb-ads]', e);
    // Fallback: retorna último dado salvo em disco (evita zerar o spend no dashboard)
    const stale = _cache[cacheKey];
    if (stale) {
      console.warn('[fb-ads] retornando dado stale do cache (FB API falhou)');
      return json(applyLiveAttribution({ ...stale.data, _stale: true, _error: e.message }, preset));
    }
    return json({ error: e.message, spend: 0 }, { status: 500 });
  }
};
