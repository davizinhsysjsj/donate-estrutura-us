/**
 * Endpoint de teste do SMTP Zoho.
 *
 * Uso (POST):
 *   curl -X POST "https://belgianpawshelter.help/api/test-email" \
 *     -H "content-type: application/json" \
 *     -d '{"token":"<MAIL_TEST_TOKEN>","to":"voce@gmail.com","action":"verify|send"}'
 *
 * - action="verify": so testa autenticacao SMTP, nao manda email
 * - action="send" (default): manda email teste pro endereco em "to"
 *
 * Protegido por MAIL_TEST_TOKEN (env var). Sem token valido, retorna 401.
 * Esse endpoint e so pra debug — remove ou desabilita apos validar.
 */

import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { sendMail, verifySmtp } from '$lib/server/mailer';

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
    return json({ ok: false, error: 'campo "to" obrigatorio quando action=send' }, { status: 400 });
  }

  const r = await sendMail({
    to,
    subject: `Teste SMTP Zoho — ${new Date().toISOString()}`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#f8fafc;border-radius:12px;">
        <h2 style="color:#16a34a;margin:0 0 12px;">SMTP Zoho operacional</h2>
        <p style="color:#475569;line-height:1.6;margin:0 0 8px;">
          Se voce esta lendo isso, o backend conseguiu mandar email via Zoho.
        </p>
        <p style="color:#94a3b8;font-size:12px;margin-top:24px;">
          Enviado em ${new Date().toLocaleString('nl-BE', { timeZone: 'Europe/Brussels' })} (Bruxelas)
        </p>
      </div>
    `
  });

  return json(r, { status: r.ok ? 200 : 502 });
};
