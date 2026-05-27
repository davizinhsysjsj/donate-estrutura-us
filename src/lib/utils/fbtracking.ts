/**
 * Meta Pixel — helpers de tracking client-side + persistencia de atribuicao.
 *
 * O fluxo:
 *  1. Cliente clica anuncio Meta -> chega na LP com `?fbclid=...`
 *  2. Capturamos `fbclid` e geramos `_fbc` (formato fb.1.<ts>.<fbclid>) -> salvamos em cookie + localStorage
 *  3. `_fbp` (pixel browser id) e setado pelo proprio Pixel JS no fbq init
 *  4. No click do Donate, montamos URL Shopify com `attributes[fbclid|fbp|event_id]` + UTMs aleatorias
 *  5. Shopify persiste os attributes na ordem -> Omega Pixel le e injeta no CAPI Purchase
 */

/** Pixel ID publico (aparece no source de qualquer site com Meta Pixel). */
export const META_PIXEL_ID = '2237078953695974';

/** URL pra forcar redirect pos-pagamento do Shopify (override da thank-you nativa). */
const RETURN_TO = 'https://api.belgianpaws.help/bedankt';

/** Sources falsas pra Shopify analytics ver origem "natural" (pesos somam 100). */
const FAKE_SOURCES = [
  { weight: 30, source: 'facebook', medium: 'cpc', campaign: 'belgium_summer' },
  { weight: 25, source: 'google', medium: 'organic' },
  { weight: 15, source: 'instagram', medium: 'social' },
  { weight: 10, source: 'google', medium: 'cpc', campaign: 'shopping_be' },
  { weight: 8, source: 'youtube', medium: 'video' },
  { weight: 7, source: 'direct', medium: 'none' },
  { weight: 5, source: 'newsletter', medium: 'email' }
];

export type FakeSource = { source: string; medium: string; campaign?: string };

/** Sorteia source ponderada. */
export function pickRandomSource(): FakeSource {
  const total = FAKE_SOURCES.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (const s of FAKE_SOURCES) {
    r -= s.weight;
    if (r <= 0) return { source: s.source, medium: s.medium, campaign: s.campaign };
  }
  return { source: FAKE_SOURCES[0].source, medium: FAKE_SOURCES[0].medium };
}

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
 * Captura fbclid da URL atual ou recupera de localStorage/cookie.
 * Persiste em cookie `_fbc` no formato Meta esperado: `fb.1.<timestamp>.<fbclid>`.
 */
export function captureAndPersistFbclid(): { fbclid: string | null; fbc: string | null } {
  if (typeof window === 'undefined') return { fbclid: null, fbc: null };

  const params = new URLSearchParams(window.location.search);
  const urlFbclid = params.get('fbclid');

  if (urlFbclid) {
    const fbc = `fb.1.${Date.now()}.${urlFbclid}`;
    setCookie('_fbc', fbc);
    localStorage.setItem('fbclid', urlFbclid);
    localStorage.setItem('_fbc', fbc);
    return { fbclid: urlFbclid, fbc };
  }

  // Recupera de storage existente
  const stored = localStorage.getItem('fbclid') || getCookie('_fbc')?.split('.').pop() || null;
  const storedFbc = getCookie('_fbc') || localStorage.getItem('_fbc');
  return { fbclid: stored, fbc: storedFbc };
}

/** Le _fbp (Meta browser pixel id) — setado automaticamente pelo Pixel JS. */
export function getFbp(): string | null {
  return getCookie('_fbp');
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
 *  - utm_source/medium/campaign (pra Shopify analytics ver origem "natural")
 */
export function buildShopifyCartUrl(opts: {
  shopDomain: string; // ex: 'themporalljerseys.com'
  variantId: string;
  fbclid?: string | null;
  fbp?: string | null;
  eventId: string;
}): string {
  const fake = pickRandomSource();
  const params = new URLSearchParams();

  // UTMs visiveis (Shopify analytics)
  params.set('utm_source', fake.source);
  params.set('utm_medium', fake.medium);
  if (fake.campaign) params.set('utm_campaign', fake.campaign);

  // Atributos persistidos na ordem
  if (opts.fbclid) params.set('attributes[fbclid]', opts.fbclid);
  if (opts.fbp) params.set('attributes[fbp]', opts.fbp);
  params.set('attributes[event_id]', opts.eventId);
  params.set('attributes[utm_source]', fake.source);
  params.set('attributes[utm_medium]', fake.medium);
  if (fake.campaign) params.set('attributes[utm_campaign]', fake.campaign);

  // Forca redirect pos-pagamento pro endpoint bedankt (ignorado em checkout extensibility novo)
  params.set('return_to', RETURN_TO);

  return `https://${opts.shopDomain}/cart/${opts.variantId}:1?${params.toString()}`;
}
