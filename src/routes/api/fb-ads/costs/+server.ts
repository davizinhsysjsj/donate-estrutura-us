import { json } from '@sveltejs/kit';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import type { RequestHandler } from './$types';

const DATA_DIR = '.data';
const FILE = `${DATA_DIR}/fb-costs.json`;

const DEFAULTS = {
  shopifyPct: 2,      // Taxa Shopify (% sobre receita)
  gatewayPct: 1.5,    // Taxa gateway de pagamento (% sobre receita)
  fixedEur: 0,        // Custos fixos mensais (€)
  usdEurRate: 0.92,   // Taxa de câmbio USD → EUR (atualizar manualmente)
};

function load() {
  try {
    if (existsSync(FILE)) return JSON.parse(readFileSync(FILE, 'utf-8'));
  } catch {}
  return { ...DEFAULTS };
}

export const GET: RequestHandler = async () => json(load());

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const costs = {
      shopifyPct:  Math.max(0, parseFloat(body.shopifyPct)  || 0),
      gatewayPct:  Math.max(0, parseFloat(body.gatewayPct)  || 0),
      fixedEur:    Math.max(0, parseFloat(body.fixedEur)    || 0),
      usdEurRate:  Math.max(0.01, parseFloat(body.usdEurRate) || 0.92),
    };
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(FILE, JSON.stringify(costs, null, 2));
    return json({ ok: true, costs });
  } catch (e: any) {
    return json({ error: e.message }, { status: 500 });
  }
};
