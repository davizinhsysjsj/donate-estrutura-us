import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getFbToken } from '$lib/server/fb-token';

// IDs do FB sao numericos (15-20 digits). Bloqueia injection.
function normalizeId(raw: string): string {
  const m = raw.trim().match(/^\d{6,25}$/);
  if (!m) throw error(400, 'campaign_id invalido');
  return m[0];
}

async function fbPost(path: string, body: Record<string, string>) {
  const params = new URLSearchParams(body);
  const r = await fetch(`https://graph.facebook.com/v21.0/${path}`, {
    method: 'POST',
    body: params,
    signal: AbortSignal.timeout(15_000),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(data?.error?.message || `FB POST ${path} HTTP ${r.status}`);
  }
  return data;
}

// PATCH /api/fb-ads/campaign/:id
// Body: { status?: 'ACTIVE'|'PAUSED', dailyBudget?: number (em moeda da conta) }
export const PATCH: RequestHandler = async ({ params, request }) => {
  const id = normalizeId(params.id!);
  const token = getFbToken();
  const body = await request.json().catch(() => ({}));

  const updates: Record<string, string> = { access_token: token };

  if (body.status === 'ACTIVE' || body.status === 'PAUSED') {
    updates.status = body.status;
  }
  if (typeof body.dailyBudget === 'number' && body.dailyBudget > 0) {
    // Graph API espera centavos da moeda da conta
    updates.daily_budget = String(Math.round(body.dailyBudget * 100));
  }

  if (Object.keys(updates).length === 1) {
    return json({ ok: false, error: 'Nenhum campo a atualizar' }, { status: 400 });
  }

  try {
    const res = await fbPost(id, updates);
    return json({ ok: true, result: res });
  } catch (e: any) {
    console.error('[campaign/PATCH]', e);
    return json({ ok: false, error: e.message }, { status: 500 });
  }
};

// POST /api/fb-ads/campaign/:id
// Body: { action: 'duplicate', namePrefix?: string }
export const POST: RequestHandler = async ({ params, request }) => {
  const id = normalizeId(params.id!);
  const token = getFbToken();
  const body = await request.json().catch(() => ({}));

  if (body.action !== 'duplicate') {
    return json({ ok: false, error: 'action invalido (use "duplicate")' }, { status: 400 });
  }

  const namePrefix = (body.namePrefix || 'Copia').slice(0, 50);

  try {
    const res = await fbPost(`${id}/copies`, {
      access_token: token,
      deep_copy: 'true',     // copia ad sets + ads tambem
      status_option: 'PAUSED', // sobe pausada por seguranca
      rename_options: JSON.stringify({ rename_prefix: `[${namePrefix}] ` }),
    });
    return json({ ok: true, result: res });
  } catch (e: any) {
    console.error('[campaign/duplicate]', e);
    return json({ ok: false, error: e.message }, { status: 500 });
  }
};

// DELETE /api/fb-ads/campaign/:id — pausa permanentemente (nao deleta)
// FB nao permite delete via API sem permissoes especiais; PAUSED basta.
export const DELETE: RequestHandler = async ({ params }) => {
  const id = normalizeId(params.id!);
  const token = getFbToken();
  try {
    const res = await fbPost(id, { access_token: token, status: 'PAUSED' });
    return json({ ok: true, result: res });
  } catch (e: any) {
    return json({ ok: false, error: e.message }, { status: 500 });
  }
};
