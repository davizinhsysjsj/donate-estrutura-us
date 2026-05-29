/**
 * Envio de emails via SMTP Zoho.
 *
 * Config via env vars (Railway):
 *  - ZOHO_SMTP_HOST       (default: smtp.zoho.com)
 *  - ZOHO_SMTP_PORT       (default: 465)
 *  - ZOHO_SMTP_USER       (ex: contact@belgianpaws.help)
 *  - ZOHO_SMTP_PASS       (App Password gerada no painel Zoho)
 *  - ZOHO_MAIL_FROM       (ex: "Belgian Paws Helper <contact@belgianpaws.help>")
 *
 * Limites Zoho Mail Free: 100 emails/dia, 25/hora.
 * Pra escalar, migra pra ZeptoMail (mesmo Zoho, focado em transacional).
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

let cached: Transporter | null = null;

function getTransporter(): Transporter {
  if (cached) return cached;

  const host = process.env.ZOHO_SMTP_HOST || 'smtp.zoho.com';
  const port = Number(process.env.ZOHO_SMTP_PORT || 465);
  const user = process.env.ZOHO_SMTP_USER;
  const pass = process.env.ZOHO_SMTP_PASS;

  if (!user || !pass) {
    throw new Error('SMTP nao configurado: ZOHO_SMTP_USER e ZOHO_SMTP_PASS sao obrigatorios');
  }

  cached = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 = SSL implicit, 587 = STARTTLS
    auth: { user, pass },
    // Timeouts curtos pra nao travar a request 60s+ quando porta esta bloqueada
    connectionTimeout: 10_000, // 10s pra abrir socket
    greetingTimeout: 10_000,   // 10s pro server mandar HELO
    socketTimeout: 15_000      // 15s pra operacao individual
  });

  return cached;
}

/**
 * Reseta o transporter cacheado. Util pra trocar config (porta, host) sem restart.
 */
export function resetTransporter() {
  cached = null;
}

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
  try {
    const from =
      process.env.ZOHO_MAIL_FROM ||
      `Belgian Paws Helper <${process.env.ZOHO_SMTP_USER || 'contact@belgianpaws.help'}>`;

    const t = getTransporter();
    const info = await t.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text ?? input.html.replace(/<[^>]+>/g, ''),
      replyTo: input.replyTo
    });

    return { ok: true, messageId: info.messageId };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

/**
 * Verifica autenticacao SMTP sem mandar email.
 * Util pra healthcheck/debug.
 */
export async function verifySmtp(): Promise<{ ok: boolean; error?: string }> {
  try {
    const t = getTransporter();
    await t.verify();
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}
