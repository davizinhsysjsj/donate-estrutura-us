// IP geolocation via ip-api.com (free, sem chave, 45 req/min)
// Cache em memoria por IP — evita rate limit e reduz latencia

interface GeoInfo {
  country?: string;
  countryCode?: string;
  city?: string;
  isp?: string;
  proxy?: boolean;
}

const cache = new Map<string, { data: GeoInfo; ts: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1 dia
const MAX_CACHE = 5000;
const inflight = new Map<string, Promise<GeoInfo>>();

function gc() {
  const now = Date.now();
  for (const [k, v] of cache) {
    if (now - v.ts > CACHE_TTL_MS) cache.delete(k);
  }
  if (cache.size > MAX_CACHE) {
    const keep = Math.floor(MAX_CACHE * 0.7);
    const drop = cache.size - keep;
    let i = 0;
    for (const k of cache.keys()) {
      if (i++ >= drop) break;
      cache.delete(k);
    }
  }
}

export async function lookupGeo(ip: string): Promise<GeoInfo> {
  if (!ip || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return {};
  }
  const cached = cache.get(ip);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data;

  const pending = inflight.get(ip);
  if (pending) return pending;

  const p = (async () => {
    try {
      const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,city,isp,proxy,hosting`;
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2500);
      const r = await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      if (!r.ok) return {};
      const j: any = await r.json();
      if (j.status !== 'success') return {};
      const data: GeoInfo = {
        country: j.country,
        countryCode: j.countryCode,
        city: j.city,
        isp: j.isp,
        proxy: Boolean(j.proxy || j.hosting)
      };
      cache.set(ip, { data, ts: Date.now() });
      gc();
      return data;
    } catch {
      return {};
    } finally {
      inflight.delete(ip);
    }
  })();

  inflight.set(ip, p);
  return p;
}
