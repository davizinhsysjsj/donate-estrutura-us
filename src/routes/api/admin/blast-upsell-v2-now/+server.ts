/**
 * Disparo manual do upsell-v2 pra todos os emails que estao na queue
 * aguardando o upsell de 48h. Usado uma vez quando trocamos o template
 * (de 'upsell' antigo pra 'upsell-v2') — assim quem ja comprou hoje
 * recebe o novo formato imediatamente em vez de esperar 48h.
 *
 * Protegido por MAIL_TEST_TOKEN.
 *
 * POST { token, action: 'preview' }   -> conta + lista (nao envia)
 * POST { token, action: 'send' }      -> envia v2 a cada um, remove da queue
 */

import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { listPendingUpsells, cancelQueuedItems, sendNow } from '$lib/server/email-scheduler';

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const token = body.token as string | undefined;
  const action = (body.action as string | undefined) ?? 'preview';

  const expected = process.env.MAIL_TEST_TOKEN;
  if (!expected || token !== expected) {
    return json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const pending = listPendingUpsells();

  if (action === 'preview') {
    return json({
      ok: true,
      count: pending.length,
      items: pending.map((p) => ({
        id: p.id,
        to: p.toEmail,
        template: p.templateName,
        sendAt: new Date(p.sendAt).toISOString(),
        previousAmount: p.templateData?.previousAmount,
        currency: p.templateData?.currency,
        locale: p.templateData?.locale
      }))
    });
  }

  if (action === 'send') {
    const results: Array<{ to: string; ok: boolean; messageId?: string; error?: string }> = [];
    const sentIds: string[] = [];

    for (const item of pending) {
      const r = await sendNow({
        toEmail: item.toEmail,
        templateName: 'upsell-v2',
        templateData: { ...item.templateData, recipientEmail: item.toEmail }
      });
      results.push({
        to: item.toEmail,
        ok: r.ok,
        messageId: r.messageId,
        error: r.error
      });
      if (r.ok) sentIds.push(item.id);
    }

    const removed = cancelQueuedItems(sentIds);

    return json({
      ok: true,
      sentCount: sentIds.length,
      failedCount: results.length - sentIds.length,
      removedFromQueue: removed,
      results
    });
  }

  return json({ ok: false, error: 'unknown action' }, { status: 400 });
};
