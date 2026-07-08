/**
 * Backfill de câmbio pras vendas do analytics store.
 *
 * Uso comum: quando o funil UK começou a rodar antes do fix de FX, as vendas
 * caíram com purchaseAmount = valor GBP salvo como se fosse EUR. Esse endpoint
 * pega sessions com purchase num intervalo, aplica taxa GBP→EUR e regrava.
 *
 * Segurança: protegido por MAIL_TEST_TOKEN.
 *
 * Params query:
 *   token        = MAIL_TEST_TOKEN
 *   since        = epoch ms (default: 00:00 UTC de hoje)
 *   until        = epoch ms (default: now)
 *   fromCurrency = moeda assumida das vendas (default 'GBP')
 *   dryRun       = 'true' pra simular sem gravar (default false)
 *   force        = 'true' pra sobrescrever mesmo se purchaseCurrency já estiver setado
 *                  (default false — pula sessions que já foram normalizadas)
 */
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getFxRates, toEurSync } from '$lib/server/fx';
import { getAllSessions, patchSession } from '$lib/server/analytics';

export const POST: RequestHandler = async ({ url, request }) => {
  // Aceita token via query OU body
  let token = url.searchParams.get('token');
  let body: any = {};
  try {
    body = await request.json();
  } catch {}
  token = token || body.token;

  const expected = process.env.MAIL_TEST_TOKEN;
  if (!expected || token !== expected) {
    return json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const now = Date.now();
  const startOfDayUtc = new Date();
  startOfDayUtc.setUTCHours(0, 0, 0, 0);
  const defaultSince = startOfDayUtc.getTime();

  const since = Number(url.searchParams.get('since') || body.since || defaultSince);
  const until = Number(url.searchParams.get('until') || body.until || now);
  const fromCurrency = String(url.searchParams.get('fromCurrency') || body.fromCurrency || 'GBP').toUpperCase();
  const dryRun = (url.searchParams.get('dryRun') || body.dryRun) === 'true';
  const force = (url.searchParams.get('force') || body.force) === 'true';

  const rates = await getFxRates();

  const all = getAllSessions();
  const touched: Array<{
    sid: string;
    before: number;
    after: number;
    currency?: string;
    at?: number;
  }> = [];

  let scanned = 0;
  for (const s of all) {
    if (!s.purchaseAt || !s.purchaseAmount) continue;
    if (s.purchaseAt < since || s.purchaseAt > until) continue;
    scanned += 1;

    // Skip se já foi normalizada (a menos que force=true)
    if (!force && s.purchaseCurrency) continue;

    const before = s.purchaseAmount;
    const after = toEurSync(before, fromCurrency);
    if (Math.abs(after - before) < 0.005) continue; // nada a fazer

    touched.push({
      sid: s.sid,
      before,
      after,
      currency: fromCurrency,
      at: s.purchaseAt
    });

    if (!dryRun) {
      patchSession(s.sid, {
        purchaseAmountRaw: before,
        purchaseAmount: after,
        purchaseCurrency: fromCurrency
      });
    }
  }

  return json({
    ok: true,
    dryRun,
    force,
    fromCurrency,
    since: new Date(since).toISOString(),
    until: new Date(until).toISOString(),
    fxRates: rates,
    scanned,
    matchedCount: touched.length,
    matched: touched
  });
};
