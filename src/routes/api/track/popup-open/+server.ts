/**
 * POST /api/track/popup-open
 *
 * Cliente avisa quando o popup de doacao abriu (usuario escolheu valor mas
 * ainda nao foi pro Bancontact). Guardamos pra eventualmente disparar email
 * de recovery 1h depois se nao houver purchase (e se conseguirmos mapear o
 * sid pra um email conhecido — via past purchase).
 *
 * Aceita body { bp_sid, amount, fbp?, fbclid? }.
 */

import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { trackPopupOpen } from '$lib/server/abandoned-popups';

export const POST: RequestHandler = async ({ request }) => {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  const sid = typeof body.bp_sid === 'string' ? body.bp_sid : null;
  const amount = Number(body.amount);
  if (!sid || !Number.isFinite(amount) || amount <= 0) {
    return json({ ok: false, error: 'missing sid or amount' }, { status: 400 });
  }

  trackPopupOpen({
    sid,
    amount,
    fbp: typeof body.fbp === 'string' ? body.fbp : null,
    fbclid: typeof body.fbclid === 'string' ? body.fbclid : null
  });

  return json({ ok: true });
};
