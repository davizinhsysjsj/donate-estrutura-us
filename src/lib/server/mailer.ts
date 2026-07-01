/**
 * Envio de emails via Resend (API HTTPS).
 *
 * Migrado de SMTP Zoho (commit cb47461) pra Resend (e2690ae+) porque Railway
 * bloqueia outbound SMTP. Resend usa HTTPS porta 443, passa qualquer firewall.
 *
 * Config via env vars (Railway):
 *  - RESEND_API_KEY        (formato: re_...)
 *  - RESEND_MAIL_FROM      (ex: "Belgian Paws Helper <contact@belgiancarestore.com>")
 *
 * Limites Resend Free: 3000 emails/mes, 100/dia.
 * Domain belgiancarestore.com verificado na regiao eu-west-1.
 */

const RESEND_API = 'https://api.resend.com/emails';

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export interface SendMailResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.RESEND_MAIL_FROM ||
    'Belgian Paws Helper <contact@belgiancarestore.com>';
  if (!apiKey) {
    return { ok: false, error: 'RESEND_API_KEY nao configurado' };
  }

  try {
    const body: Record<string, unknown> = {
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text ?? input.html.replace(/<[^>]+>/g, '')
    };
    if (input.replyTo) body.reply_to = input.replyTo;

    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = (await res.json().catch(() => ({}))) as any;

    if (!res.ok) {
      return {
        ok: false,
        error: data?.message || data?.name || `HTTP ${res.status}`
      };
    }

    return { ok: true, messageId: data?.id };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

/**
 * Health check da API Resend. Bate em /domains com o token configurado.
 */
export async function verifySmtp(): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY nao configurado' };

  try {
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}
