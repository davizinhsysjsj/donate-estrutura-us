import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Cache em memória — renova a cada hora
let _cache: { data: any; ts: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hora

export const GET: RequestHandler = async () => {
  if (_cache && Date.now() - _cache.ts < CACHE_TTL) return json(_cache.data);

  try {
    // AwesomeAPI usa cotações do Banco Central do Brasil (BCB) — atualiza em tempo real
    const r = await fetch(
      'https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL,EUR-USD',
      { signal: AbortSignal.timeout(6_000) }
    );
    if (!r.ok) throw new Error(`AwesomeAPI ${r.status}`);
    const d = await r.json();

    const data = {
      usdToBrl: parseFloat(d.USDBRL?.bid  || '5.70'),
      eurToBrl: parseFloat(d.EURBRL?.bid  || '6.15'),
      eurToUsd: parseFloat(d.EURUSD?.bid  || '1.08'),
      source:   'Banco Central do Brasil (AwesomeAPI)',
      updatedAt: Date.now(),
    };

    _cache = { data, ts: Date.now() };
    return json(data);
  } catch (e: any) {
    console.error('[exchange-rate]', e.message);
    // Retorna fallback com flag indicando que não é ao vivo
    return json({
      usdToBrl: 5.70,
      eurToBrl: 6.15,
      eurToUsd: 1.08,
      source:   'fallback',
      updatedAt: 0,
    });
  }
};
