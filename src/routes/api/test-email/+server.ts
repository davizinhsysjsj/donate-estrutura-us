/**
 * Endpoint de teste do mailer (Resend).
 *
 * Acoes (POST):
 *   - action="verify"          → testa API Resend, nao envia
 *   - action="send"            → envia email basico de debug
 *   - action="send-thank-you"  → envia template "thank-you" REAL (sem prefixo de teste)
 *   - action="send-upsell"     → envia template "upsell" REAL
 *
 * Exemplo:
 *   curl -X POST "https://belgianpawshelter.help/api/test-email" \
 *     -H "content-type: application/json" \
 *     -d '{"token":"<MAIL_TEST_TOKEN>","action":"send-thank-you","to":"voce@gmail.com","amount":25,"firstName":"Davi"}'
 *
 * Protegido por MAIL_TEST_TOKEN. Sem token valido, 401.
 */

import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { sendMail, verifySmtp } from '$lib/server/mailer';
import { sendNow } from '$lib/server/email-scheduler';

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const token = body.token as string | undefined;
  const action = (body.action as string | undefined) ?? 'send';
  const to = body.to as string | undefined;

  const expected = process.env.MAIL_TEST_TOKEN;
  if (!expected || token !== expected) {
    return json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  if (action === 'verify') {
    const r = await verifySmtp();
    return json(r, { status: r.ok ? 200 : 502 });
  }

  if (!to) {
    return json({ ok: false, error: 'campo "to" obrigatorio' }, { status: 400 });
  }

  if (action === 'send-thank-you') {
    const amount = Number(body.amount ?? 25);
    const firstName = body.firstName as string | undefined;
    const currency = (body.currency as string | undefined) ?? 'EUR';
    const r = await sendNow({
      toEmail: to,
      templateName: 'thank-you',
      templateData: { firstName, amount, currency }
    });
    return json(r, { status: r.ok ? 200 : 502 });
  }

  if (action === 'send-upsell') {
    const amount = Number(body.amount ?? 25);
    const firstName = body.firstName as string | undefined;
    const currency = (body.currency as string | undefined) ?? 'EUR';
    const r = await sendNow({
      toEmail: to,
      templateName: 'upsell',
      templateData: { firstName, previousAmount: amount, currency }
    });
    return json(r, { status: r.ok ? 200 : 502 });
  }

  // Default: send (debug basico)
  const r = await sendMail({
    to,
    subject: `Teste mailer — ${new Date().toISOString()}`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#f8fafc;border-radius:12px;">
        <h2 style="color:#16a34a;margin:0 0 12px;">Mailer Resend operacional</h2>
        <p style="color:#475569;line-height:1.6;margin:0 0 8px;">
          Se voce esta lendo isso, o backend conseguiu mandar email via Resend.
        </p>
        <p style="color:#94a3b8;font-size:12px;margin-top:24px;">
          Enviado em ${new Date().toLocaleString('nl-BE', { timeZone: 'Europe/Brussels' })} (Bruxelas)
        </p>
      </div>
    `
  });

  return json(r, { status: r.ok ? 200 : 502 });
};
