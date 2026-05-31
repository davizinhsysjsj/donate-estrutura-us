import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Cache em memória — renova a cada 30 min
let _cache: { data: any; ts: number } | null = null;
const CACHE_TTL = 30 * 60 * 1000;

// Tenta buscar da AwesomeAPI (BCB)
async function tryAwesomeApi(): Promise<{ usdToBrl: number; eurToBrl: number; eurToUsd: number } | null> {
  try {
    const r = await fetch(
      'https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL,EUR-USD',
      { signal: AbortSignal.timeout(8_000) }
    );
    if (!r.ok) return null;
    const d = await r.json();
    const usdToBrl = parseFloat(d.USDBRL?.bid || '0');
    const eurToBrl = parseFloat(d.EURBRL?.bid || '0');
    const eurToUsd = parseFloat(d.EURUSD?.bid || '0');
    if (usdToBrl < 3 || usdToBrl > 10) return null; // sanity check
    return { usdToBrl, eurToBrl, eurToUsd };
  } catch {
    return null;
  }
}

// Tenta frankfurter.app (ECB — confiável, sem rate limit)
async function tryFrankfurter(): Promise<{ usdToBrl: number; eurToBrl: number; eurToUsd: number } | null> {
  try {
    const r = await fetch(
      'https://api.frankfurter.app/latest?from=EUR&to=USD,BRL',
      { signal: AbortSignal.timeout(8_000) }
    );
    if (!r.ok) return null;
    const d = await r.json();
    const eurToUsd = d.rates?.USD;
    const eurToBrl = d.rates?.BRL;
    if (!eurToUsd || !eurToBrl) return null;
    const usdToBrl = eurToBrl / eurToUsd;
    if (usdToBrl < 3 || usdToBrl > 10) return null;
    return { usdToBrl, eurToBrl, eurToUsd };
  } catch {
    return null;
  }
}

// Tenta Open Exchange Rates (USD base, gratuito sem key para latest)
async function tryOpenExchangeRates(): Promise<{ usdToBrl: number; eurToBrl: number; eurToUsd: number } | null> {
  try {
    const r = await fetch(
      'https://open.er-api.com/v6/latest/USD',
      { signal: AbortSignal.timeout(8_000) }
    );
    if (!r.ok) return null;
    const d = await r.json();
    const usdToBrl = d.rates?.BRL;
    const usdToEur = d.rates?.EUR;
    if (!usdToBrl || !usdToEur) return null;
    if (usdToBrl < 3 || usdToBrl > 10) return null;
    return {
      usdToBrl,
      eurToBrl: usdToBrl / usdToEur,
      eurToUsd: 1 / usdToEur,
    };
  } catch {
    return null;
  }
}

export const GET: RequestHandler = async () => {
  if (_cache && Date.now() - _cache.ts < CACHE_TTL) return json(_cache.data);

  // Tenta as fontes em sequência: AwesomeAPI → Frankfurter → OpenExchangeRates
  const sources = [
    { fn: tryAwesomeApi,         name: 'BCB (AwesomeAPI)' },
    { fn: tryFrankfurter,        name: 'ECB (Frankfurter)' },
    { fn: tryOpenExchangeRates,  name: 'Open Exchange Rates' },
  ];

  for (const { fn, name } of sources) {
    const result = await fn();
    if (result) {
      const data = {
        usdToBrl:  result.usdToBrl,
        eurToBrl:  result.eurToBrl,
        eurToUsd:  result.eurToUsd,
        source:    name,
        updatedAt: Date.now(),
      };
      console.log(`[exchange-rate] OK from ${name}: USD/BRL=${result.usdToBrl.toFixed(4)}`);
      _cache = { data, ts: Date.now() };
      return json(data);
    }
    console.warn(`[exchange-rate] ${name} failed, trying next...`);
  }

  // Todas falharam — retorna último cache válido se existir (mesmo expirado)
  if (_cache) {
    console.warn('[exchange-rate] all sources failed, using stale cache');
    return json({ ..._cache.data, source: 'cache-stale' });
  }

  // Fallback absoluto — usa taxa próxima do mercado atual (NÃO 5.70)
  console.error('[exchange-rate] all sources failed, using hardcoded fallback');
  return json({
    usdToBrl: 5.03,
    eurToBrl: 5.86,
    eurToUsd: 1.16,
    source:   'fallback',
    updatedAt: 0,
  });
};
