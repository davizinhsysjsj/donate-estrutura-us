/**
 * FX rates dinâmicas com cache de 6h.
 *
 * Fonte: exchangerate.host (público, sem key). Fallback pra taxas hardcoded
 * quando a API falha ou está fora do ar.
 *
 * Uso principal: converter valores de compras Shopify (GBP/USD/EUR) pra EUR
 * antes de gravar no analytics store. Assim o dashboard não precisa saber
 * de moeda — tudo já vem normalizado.
 */

interface Rates {
	GBP_TO_EUR: number;
	USD_TO_EUR: number;
	BRL_TO_EUR: number;
	fetchedAt: number;
	source: 'live' | 'fallback';
}

// Taxa hardcoded como fallback (aproximada julho/2026). Se a API cair, aplica.
const FALLBACK: Omit<Rates, 'fetchedAt' | 'source'> = {
	GBP_TO_EUR: 1.17,
	USD_TO_EUR: 0.92,
	BRL_TO_EUR: 0.16
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h
let cache: Rates | null = null;
let inflight: Promise<Rates> | null = null;

async function fetchLive(): Promise<Rates> {
	try {
		// exchangerate.host devolve base EUR por default. Consulta 3 moedas de uma vez.
		const r = await fetch('https://api.exchangerate.host/latest?base=EUR&symbols=GBP,USD,BRL', {
			signal: AbortSignal.timeout(5000)
		});
		if (!r.ok) throw new Error(`HTTP ${r.status}`);
		const j = await r.json();
		const rates = j?.rates ?? {};
		// Base EUR: rates.GBP = quanto de GBP vale 1 EUR. Inverte pra GBP→EUR.
		const gbpFromEur = Number(rates.GBP);
		const usdFromEur = Number(rates.USD);
		const brlFromEur = Number(rates.BRL);
		if (!gbpFromEur || !usdFromEur) throw new Error('missing rates in response');
		const result: Rates = {
			GBP_TO_EUR: Number((1 / gbpFromEur).toFixed(4)),
			USD_TO_EUR: Number((1 / usdFromEur).toFixed(4)),
			BRL_TO_EUR: brlFromEur ? Number((1 / brlFromEur).toFixed(4)) : FALLBACK.BRL_TO_EUR,
			fetchedAt: Date.now(),
			source: 'live'
		};
		console.log('[fx] rates fetched live', {
			gbp: result.GBP_TO_EUR,
			usd: result.USD_TO_EUR,
			brl: result.BRL_TO_EUR
		});
		return result;
	} catch (e: any) {
		console.warn('[fx] live fetch failed, using fallback', e?.message || String(e));
		return { ...FALLBACK, fetchedAt: Date.now(), source: 'fallback' };
	}
}

/**
 * Retorna rates atuais. Cache 6h. Se cache expirou, refresca em background
 * mas ainda devolve o valor antigo pra não bloquear o webhook.
 */
export async function getFxRates(): Promise<Rates> {
	const now = Date.now();
	if (cache && now - cache.fetchedAt < CACHE_TTL_MS) return cache;
	if (inflight) return inflight;
	inflight = fetchLive().then((r) => {
		cache = r;
		inflight = null;
		return r;
	});
	// Se ainda não temos cache nenhum, aguarda. Senão devolve o velho e refresca em bg.
	if (!cache) return inflight;
	inflight.catch(() => {});
	return cache;
}

/**
 * Converte um valor de qualquer moeda suportada pra EUR. Sync — usa cache
 * atual (ou fallback se cache vazio). Ideal pra hot paths como o ingest
 * de purchases que não pode ficar esperando fetch de rede.
 *
 * Ao rodar em background, refresca cache se estiver stale.
 */
export function toEurSync(amount: number, currency?: string): number {
	const cur = (currency || 'EUR').toUpperCase();
	if (cur === 'EUR') return amount;

	// Refresh em background sem bloquear
	if (!cache || Date.now() - cache.fetchedAt > CACHE_TTL_MS) {
		getFxRates().catch(() => {});
	}
	const rates = cache ?? { ...FALLBACK, fetchedAt: 0, source: 'fallback' as const };
	if (cur === 'GBP') return amount * rates.GBP_TO_EUR;
	if (cur === 'USD') return amount * rates.USD_TO_EUR;
	if (cur === 'BRL') return amount * rates.BRL_TO_EUR;
	return amount; // desconhecido — devolve raw
}

/** Force refresh — útil pra admin/debug endpoint */
export async function refreshFxRates(): Promise<Rates> {
	cache = null;
	inflight = null;
	return getFxRates();
}

/** Devolve o cache atual (ou fallback) sem trigger de fetch — pra debug */
export function currentFxRates(): Rates {
	return cache ?? { ...FALLBACK, fetchedAt: 0, source: 'fallback' };
}
