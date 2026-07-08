/**
 * Meta Pixel — helpers de tracking client-side + persistencia de atribuicao.
 *
 * O fluxo:
 *  1. Cliente clica anuncio Meta -> chega na LP com `?fbclid=...&utm_source=...`
 *  2. Capturamos `fbclid`, UTMs reais e geramos `_fbc` -> salvamos em cookie + localStorage
 *  3. `_fbp` (pixel browser id) e setado pelo proprio Pixel JS no fbq init
 *  4. No click do Donate, montamos URL Shopify com `attributes[fbclid|fbp|event_id]` + UTMs reais
 *  5. Shopify persiste os attributes na ordem -> Omega Pixel le e injeta no CAPI Purchase
 */

/** Pixel ID publico (aparece no source de qualquer site com Meta Pixel). */
export const META_PIXEL_ID = '1602024645266669';


export type UtmData = {
  source: string;
  medium: string;
  campaign?: string;
  content?: string;
  term?: string;
};

/** UUID v4 simples (sem dependencia). */
export function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  // Fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Set cookie (1ano default). */
function setCookie(name: string, value: string, days = 365) {
  if (typeof document === 'undefined') return;
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${d.toUTCString()};path=/;SameSite=Lax`;
}

/** Get cookie. */
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

/**
 * Captura fbclid e UTMs reais da URL atual ou recupera de localStorage/cookie.
 * Persiste em cookie `_fbc` no formato Meta esperado: `fb.1.<timestamp>.<fbclid>`.
 */
export function captureAndPersistFbclid(): { fbclid: string | null; fbc: string | null; utm: UtmData | null } {
  if (typeof window === 'undefined') return { fbclid: null, fbc: null, utm: null };

  const params = new URLSearchParams(window.location.search);
  const urlFbclid = params.get('fbclid');

  // Captura UTMs reais da URL do anuncio
  const utmSource = params.get('utm_source');
  const utmMedium = params.get('utm_medium');
  const utmCampaign = params.get('utm_campaign');
  const utmContent = params.get('utm_content');
  const utmTerm = params.get('utm_term');

  // Persiste UTMs reais no localStorage + cookie (30d) + sessionStorage se vieram da URL.
  // Triple-write defensivo: localStorage cobre o caso normal, cookie sobrevive a
  // troca de aba/dia, sessionStorage e o ultimo fallback pra in-app browsers
  // (FBIOS, Instagram, TikTok) onde localStorage as vezes nao persiste.
  if (utmSource) {
    const utmData: UtmData = {
      source: utmSource,
      medium: utmMedium || 'cpc',
      campaign: utmCampaign || undefined,
      content: utmContent || undefined,
      term: utmTerm || undefined
    };
    const serialized = JSON.stringify(utmData);
    try { localStorage.setItem('utm_data', serialized); } catch {}
    try { sessionStorage.setItem('utm_data', serialized); } catch {}
    setCookie('_bp_utm', serialized, 30); // 30 dias — atualiza a cada novo clique de anuncio
  }

  if (urlFbclid) {
    const fbc = `fb.1.${Date.now()}.${urlFbclid}`;
    setCookie('_fbc', fbc);
    try { localStorage.setItem('fbclid', urlFbclid); } catch {}
    try { localStorage.setItem('_fbc', fbc); } catch {}
    try { sessionStorage.setItem('fbclid', urlFbclid); } catch {}
    try { sessionStorage.setItem('_fbc', fbc); } catch {}
    const utm = utmSource
      ? {
          source: utmSource,
          medium: utmMedium || 'cpc',
          campaign: utmCampaign || undefined,
          content: utmContent || undefined,
          term: utmTerm || undefined
        }
      : getStoredUtm();
    return { fbclid: urlFbclid, fbc, utm };
  }

  // Recupera de storage existente — tenta cada camada em ordem de frescor
  let stored: string | null = null;
  try { stored = localStorage.getItem('fbclid'); } catch {}
  if (!stored) { try { stored = sessionStorage.getItem('fbclid'); } catch {} }
  if (!stored) stored = getCookie('_fbc')?.split('.').pop() || null;
  let storedFbc: string | null = getCookie('_fbc');
  if (!storedFbc) { try { storedFbc = localStorage.getItem('_fbc'); } catch {} }
  if (!storedFbc) { try { storedFbc = sessionStorage.getItem('_fbc'); } catch {} }
  return { fbclid: stored, fbc: storedFbc, utm: getStoredUtm() };
}

/** Recupera UTMs persistidas: localStorage > sessionStorage > cookie _bp_utm > bp_utm_* (analytics). */
export function getStoredUtm(): UtmData | null {
  if (typeof window === 'undefined') return null;
  try {
    // 1) localStorage (fonte principal)
    let raw: string | null = null;
    try { raw = localStorage.getItem('utm_data'); } catch {}
    // 2) sessionStorage (fallback pra in-app browsers que bloqueiam localStorage)
    if (!raw) { try { raw = sessionStorage.getItem('utm_data'); } catch {} }
    // 3) cookie _bp_utm (sobrevive a abas/dias diferentes)
    if (!raw) raw = getCookie('_bp_utm');
    if (raw) return JSON.parse(raw) as UtmData;

    // 4) ultimo recurso: reconstroi a partir dos sessionStorage `bp_utm_*`
    //    que o analytics.ts grava em paralelo (cobre o caso onde o /katten
    //    rodou analytics.ts mas o localStorage do fbtracking falhou).
    try {
      const src = sessionStorage.getItem('bp_utm_source');
      if (src) {
        return {
          source: src,
          medium: sessionStorage.getItem('bp_utm_medium') || 'cpc',
          campaign: sessionStorage.getItem('bp_utm_campaign') || undefined,
          content: sessionStorage.getItem('bp_utm_content') || undefined,
          term: sessionStorage.getItem('bp_utm_term') || undefined
        };
      }
    } catch {}
    return null;
  } catch {
    return null;
  }
}

/** Le _fbp (Meta browser pixel id) — setado pelo servidor (1st-party) ou Pixel JS. */
export function getFbp(): string | null {
  return getCookie('_fbp');
}

/** Le bp_eid (external_id estavel 1st-party, setado pelo hook server). */
export function getEid(): string | null {
  return getCookie('bp_eid');
}

/** Dispara evento via fbq global, se disponivel. Com eventID pra dedup com server-side. */
export function trackEvent(
  name: string,
  data: Record<string, unknown> = {},
  eventId?: string
): string {
  const eid = eventId || uuid();
  if (typeof window !== 'undefined' && typeof (window as any).fbq === 'function') {
    (window as any).fbq('track', name, data, { eventID: eid });
  }
  return eid;
}

/**
 * Constroi URL pro Shopify cart com:
 *  - variant_id:1 (1 unidade do tier escolhido)
 *  - attributes[fbclid|fbp|event_id] (persiste na ordem pra Omega CAPI ler)
 *  - utm_source/medium/campaign reais do anuncio (para atribuicao correta no Shopify analytics)
 */
export function buildShopifyCartUrl(opts: {
  shopDomain: string; // ex: 'inigualavelshop.myshopify.com'
  variantId: string;
  fbclid?: string | null;
  fbp?: string | null;
  eventId: string;
  utm?: UtmData | null;
  sid?: string | null; // analytics session id (atrelado pro webhook achar a sessao)
  eid?: string | null;    // external_id 1st-party (cookie bp_eid)
  funnel?: 'ellie' | 'lina' | string | null; // funil de origem — usado pra escolher locale do email
}): string {
  const params = new URLSearchParams();

  // UTMs reais do anuncio — sem fallback, só envia se existirem
  const utmSource   = opts.utm?.source   || null;
  const utmMedium   = opts.utm?.medium   || null;
  const utmCampaign = opts.utm?.campaign || null;
  const utmContent  = opts.utm?.content  || null;
  const utmTerm     = opts.utm?.term     || null;

  // UTMs visíveis (Shopify analytics) — só se vieram da URL real do anúncio
  if (utmSource)   params.set('utm_source',   utmSource);
  if (utmMedium)   params.set('utm_medium',   utmMedium);
  if (utmCampaign) params.set('utm_campaign', utmCampaign);
  if (utmContent)  params.set('utm_content',  utmContent);
  if (utmTerm)     params.set('utm_term',     utmTerm);

  // Atributos persistidos na ordem — Omega CAPI + UTMify webhook lêem esses valores
  if (opts.fbclid) params.set('attributes[fbclid]', opts.fbclid);
  if (opts.fbp)    params.set('attributes[fbp]',    opts.fbp);
  params.set('attributes[event_id]', opts.eventId);
  if (utmSource)   params.set('attributes[utm_source]',   utmSource);
  if (utmMedium)   params.set('attributes[utm_medium]',   utmMedium);
  if (utmCampaign) params.set('attributes[utm_campaign]', utmCampaign);
  if (utmContent)  params.set('attributes[utm_content]',  utmContent);
  if (utmTerm)     params.set('attributes[utm_term]',     utmTerm);
  if (opts.sid)    params.set('attributes[bp_sid]',       opts.sid);
  if (opts.eid)    params.set('attributes[bp_eid]',       opts.eid);
  if (opts.funnel) params.set('attributes[funnel]',       opts.funnel);

  return `https://${opts.shopDomain}/cart/${opts.variantId}:1?${params.toString()}`;
}
