/**
 * Agendamento de emails com persistencia simples.
 *
 * Por que: Railway pode reiniciar (deploys, OOM). setTimeout simples perde tudo.
 * Por isso, salvamos cada agendamento num arquivo JSON e checamos a cada 30s
 * se algum vence. Sobrevive a restart do server.
 *
 * Limitacao: se o container for destruido (filesystem reset), perde. Pra
 * robustez total, migrar pra Railway Volume mount + dir /data (ja deixei
 * SCHEDULER_DATA_DIR configuravel).
 */

import fs from 'node:fs';
import path from 'node:path';
import { sendMail } from './mailer';
import {
  thankYouSubject, thankYouHtml,
  upsellSubject, upsellHtml,
  upsellV2Subject, upsellV2Html,
  recoverySubject, recoveryHtml,
  abandonedSubject, abandonedHtml,
  abandonedCheckoutSubject, abandonedCheckoutHtml,
  type ThankYouVars, type UpsellVars, type UpsellV2Vars, type RecoveryVars, type AbandonedPopupVars, type AbandonedCheckoutVars, type Locale
} from './email-templates';
import { getDonorsCountLastDays } from './donors-feed';
import { getStalePopups, markRecoverySent, getEmailForSid } from './abandoned-popups';

type TemplateName = 'thank-you' | 'upsell' | 'upsell-v2' | 'recovery' | 'abandoned-popup' | 'abandoned-checkout';

interface ScheduledItem {
  id: string;
  toEmail: string;
  templateName: TemplateName;
  templateData: any;
  sendAt: number; // epoch ms
  attempts: number;
  lastError?: string;
}

const DATA_DIR = process.env.SCHEDULER_DATA_DIR || path.join(process.cwd(), '.data');
const QUEUE_FILE = path.join(DATA_DIR, 'scheduled-emails.json');
// Emails que já receberam o fluxo completo — evita reenvio em recompras
const FLOW_LOG_FILE = path.join(DATA_DIR, 'email-flow-log.json');
const MAX_ATTEMPTS = 3;

let queue: ScheduledItem[] = [];
let flowLog: Set<string> = new Set(); // emails normalizados (lowercase)
let workerStarted = false;

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.error('[email-scheduler] cant create data dir', e);
  }
}

function load() {
  try {
    if (fs.existsSync(QUEUE_FILE)) {
      const raw = fs.readFileSync(QUEUE_FILE, 'utf-8');
      queue = JSON.parse(raw);
      console.log(`[email-scheduler] loaded ${queue.length} pending`);
    }
  } catch (e) {
    console.error('[email-scheduler] failed to load queue', e);
    queue = [];
  }
  try {
    if (fs.existsSync(FLOW_LOG_FILE)) {
      const raw = fs.readFileSync(FLOW_LOG_FILE, 'utf-8');
      flowLog = new Set(JSON.parse(raw));
      console.log(`[email-scheduler] flow log loaded (${flowLog.size} emails)`);
    }
  } catch (e) {
    console.error('[email-scheduler] failed to load flow log', e);
    flowLog = new Set();
  }
}

function save() {
  try {
    ensureDataDir();
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2), 'utf-8');
  } catch (e) {
    console.error('[email-scheduler] failed to save queue', e);
  }
}

function saveFlowLog() {
  try {
    ensureDataDir();
    fs.writeFileSync(FLOW_LOG_FILE, JSON.stringify([...flowLog], null, 2), 'utf-8');
  } catch (e) {
    console.error('[email-scheduler] failed to save flow log', e);
  }
}

function genId(): string {
  return `email_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function renderTemplate(name: TemplateName, data: any): { subject: string; html: string } | null {
  const locale: Locale | undefined = data?.locale;
  if (name === 'thank-you') {
    return {
      subject: thankYouSubject(locale),
      html: thankYouHtml(data as ThankYouVars)
    };
  }
  if (name === 'upsell') {
    return {
      subject: upsellSubject(locale),
      html: upsellHtml(data as UpsellVars)
    };
  }
  if (name === 'upsell-v2') {
    return {
      subject: upsellV2Subject(locale),
      html: upsellV2Html(data as UpsellV2Vars)
    };
  }
  if (name === 'recovery') {
    // Injeta contagem real de doadores dos ultimos 7d (social proof dinamico)
    const recentDonorsCount = getDonorsCountLastDays(7);
    return {
      subject: recoverySubject(locale),
      html: recoveryHtml({ ...(data as RecoveryVars), recentDonorsCount })
    };
  }
  if (name === 'abandoned-popup') {
    return {
      subject: abandonedSubject(locale),
      html: abandonedHtml(data as AbandonedPopupVars)
    };
  }
  if (name === 'abandoned-checkout') {
    return {
      subject: abandonedCheckoutSubject(locale),
      html: abandonedCheckoutHtml(data as AbandonedCheckoutVars)
    };
  }
  return null;
}

async function processOne(item: ScheduledItem): Promise<boolean> {
  const rendered = renderTemplate(item.templateName, item.templateData);
  if (!rendered) {
    console.error('[email-scheduler] unknown template', item.templateName);
    return true; // descarta — template invalido
  }

  const r = await sendMail({
    to: item.toEmail,
    subject: rendered.subject,
    html: rendered.html,
    replyTo: process.env.RESEND_REPLY_TO || 'contact@belgianpaws.help'
  });

  if (r.ok) {
    console.log('[email-scheduler] sent', { id: item.id, template: item.templateName, to: item.toEmail });
    return true;
  }

  item.attempts += 1;
  item.lastError = r.error;
  console.warn('[email-scheduler] send failed', { id: item.id, attempts: item.attempts, error: r.error });

  if (item.attempts >= MAX_ATTEMPTS) {
    console.error('[email-scheduler] max attempts reached, dropping', { id: item.id });
    return true; // descarta
  }
  return false; // re-tenta no proximo tick
}

async function tick() {
  const now = Date.now();
  const due = queue.filter((it) => it.sendAt <= now);
  if (due.length === 0) return;

  for (const item of due) {
    const done = await processOne(item);
    if (done) {
      queue = queue.filter((it) => it.id !== item.id);
    }
  }
  save();
}

/**
 * Processa abandoned popups com >1h sem compra. Pra cada um que tem email
 * mapeado (sid → email via past purchase), agenda 'abandoned-popup' email.
 * Anonimos sao descartados na proxima rodada (TTL 48h em abandoned-popups.ts).
 */
async function tickAbandonedPopups() {
  const stale = getStalePopups(60 * 60 * 1000); // >1h sem compra
  if (stale.length === 0) return;

  for (const p of stale) {
    const email = getEmailForSid(p.sid);
    if (!email) {
      // Sem email mapeado — marca como processado pra nao reprocessar
      markRecoverySent(p.sid);
      continue;
    }
    // Anti-duplicado: nao enviar se ja recebeu fluxo (ex: ja eh doador atual)
    if (flowLog.has(email)) {
      markRecoverySent(p.sid);
      continue;
    }
    scheduleEmail({
      toEmail: email,
      templateName: 'abandoned-popup',
      templateData: {
        amount: p.amount,
        recipientEmail: email
      },
      delayMs: 0
    });
    markRecoverySent(p.sid);
    console.log('[email-scheduler] abandoned-popup recovery queued', { sid: p.sid, email, amount: p.amount });
  }
}

function startWorker() {
  if (workerStarted) return;
  workerStarted = true;
  ensureDataDir();
  load();
  setInterval(() => {
    tick().catch((e) => console.error('[email-scheduler] tick error', e));
  }, 30_000);
  // Abandoned popups: a cada 5min (menos urgente que envio normal)
  setInterval(() => {
    tickAbandonedPopups().catch((e) => console.error('[email-scheduler] abandoned tick error', e));
  }, 5 * 60_000);
  // Tick imediato pra processar pendentes ao subir
  setTimeout(() => tick().catch(() => {}), 5_000);
  setTimeout(() => tickAbandonedPopups().catch(() => {}), 10_000);
  console.log('[email-scheduler] worker started');
}

export function initEmailScheduler() {
  startWorker();
}

/**
 * Verifica se um email ja recebeu o fluxo de emails.
 * Usado para bloquear reenvio em recompras via upsell.
 */
export function hasEmailFlow(email: string): boolean {
  return flowLog.has(email.toLowerCase().trim());
}

/**
 * Agenda um email pra ser enviado depois de `delayMs` milisegundos.
 * Persiste no disco — sobrevive a restart.
 */
export function scheduleEmail(input: {
  toEmail: string;
  templateName: TemplateName;
  templateData: ThankYouVars | UpsellVars | UpsellV2Vars | RecoveryVars | AbandonedPopupVars | AbandonedCheckoutVars;
  delayMs: number;
}): string {
  startWorker(); // garante worker rodando
  const item: ScheduledItem = {
    id: genId(),
    toEmail: input.toEmail,
    templateName: input.templateName,
    templateData: input.templateData,
    sendAt: Date.now() + Math.max(0, input.delayMs),
    attempts: 0
  };
  queue.push(item);
  save();
  console.log('[email-scheduler] scheduled', {
    id: item.id,
    template: item.templateName,
    to: item.toEmail,
    sendAt: new Date(item.sendAt).toISOString()
  });
  return item.id;
}

/**
 * Agenda o fluxo completo (thank-you + upsell) para um email.
 * Se o email ja recebeu o fluxo anteriormente (inclusive por recompra via upsell),
 * ignora silenciosamente — evita spam em recompras.
 */
export function scheduleEmailFlow(input: {
  toEmail: string;
  firstName?: string;
  amount: number;
  currency: string;
}): { scheduled: boolean; reason?: string } {
  startWorker();
  const normalized = input.toEmail.toLowerCase().trim();

  if (flowLog.has(normalized)) {
    console.log('[email-scheduler] flow already sent, skipping', { to: normalized });
    return { scheduled: false, reason: 'already_sent' };
  }

  // Marca antes de agendar — evita duplo agendamento em race condition
  flowLog.add(normalized);
  saveFlowLog();

  scheduleEmail({
    toEmail: input.toEmail,
    templateName: 'thank-you',
    templateData: { firstName: input.firstName, amount: input.amount, currency: input.currency },
    delayMs: 60 * 60 * 1000 // 1 h
  });
  scheduleEmail({
    toEmail: input.toEmail,
    templateName: 'upsell-v2',
    templateData: {
      firstName: input.firstName,
      previousAmount: input.amount,
      currency: input.currency,
      recipientEmail: input.toEmail
    },
    delayMs: 48 * 60 * 60 * 1000 // 48 h
  });
  // Recovery em 7d: se ainda nao reagiu ao v2 (cancelado automaticamente
  // se houver nova compra do mesmo email — ver cancelPendingRecoveryForEmail)
  scheduleEmail({
    toEmail: input.toEmail,
    templateName: 'recovery',
    templateData: { firstName: input.firstName },
    delayMs: 7 * 24 * 60 * 60 * 1000 // 7 d
  });

  return { scheduled: true };
}

/**
 * Cancela qualquer 'recovery' pendente pra um email — chamado pelo webhook
 * shopify-purchase quando o user faz nova compra (ex: converteu pelo upsell-v2).
 * Evita mandar recovery 7d depois pra quem ja voltou.
 */
export function cancelPendingRecoveryForEmail(email: string): number {
  const target = email.toLowerCase().trim();
  const before = queue.length;
  queue = queue.filter((i) => !(i.templateName === 'recovery' && i.toEmail.toLowerCase().trim() === target));
  const removed = before - queue.length;
  if (removed > 0) {
    save();
    console.log('[email-scheduler] cancelled pending recovery', { email: target, removed });
  }
  return removed;
}

/**
 * Agenda 1 email de abandoned-checkout (10min apos webhook Shopify).
 * Anti-duplicado:
 *  - Se ja recebeu fluxo completo (compra anterior) — ignora
 *  - Se ja tem abandoned-checkout pendente OU enviado nesta sessao pro mesmo email — ignora
 *    (Shopify dispara checkouts/update varias vezes, mas so queremos 1 email)
 *  - Se chegou nova compra apos agendar, e o pendente eh cancelado por
 *    cancelPendingAbandonedCheckoutForEmail (chamado pelo shopify-purchase)
 */
export function scheduleAbandonedCheckout(input: {
  toEmail: string;
  firstName?: string;
  amount: number;
  currency: string;
  recoverUrl: string;
  itemTitle?: string;
  delayMs?: number; // default 10min
}): { scheduled: boolean; reason?: string; id?: string } {
  startWorker();
  const normalized = input.toEmail.toLowerCase().trim();

  // Ja eh doador? Nao manda recuperacao (provavelmente checkout de upsell que sera convertido por outro fluxo)
  if (flowLog.has(normalized)) {
    return { scheduled: false, reason: 'already_donor' };
  }

  // Ja tem pendente desse email? (Shopify dispara checkouts/update varias vezes)
  const existing = queue.find(
    (i) => i.templateName === 'abandoned-checkout' && i.toEmail.toLowerCase().trim() === normalized
  );
  if (existing) {
    return { scheduled: false, reason: 'already_pending', id: existing.id };
  }

  const id = scheduleEmail({
    toEmail: input.toEmail,
    templateName: 'abandoned-checkout',
    templateData: {
      firstName: input.firstName,
      amount: input.amount,
      currency: input.currency,
      recoverUrl: input.recoverUrl,
      itemTitle: input.itemTitle
    },
    delayMs: input.delayMs ?? 10 * 60 * 1000 // 10 min
  });
  return { scheduled: true, id };
}

/**
 * Cancela qualquer 'abandoned-checkout' pendente pra um email — chamado pelo
 * webhook shopify-purchase quando o user finaliza a compra (mesmo email).
 * Evita mandar "voce abandonou seu carrinho" pra quem ja comprou.
 */
export function cancelPendingAbandonedCheckoutForEmail(email: string): number {
  const target = email.toLowerCase().trim();
  const before = queue.length;
  queue = queue.filter((i) => !(i.templateName === 'abandoned-checkout' && i.toEmail.toLowerCase().trim() === target));
  const removed = before - queue.length;
  if (removed > 0) {
    save();
    console.log('[email-scheduler] cancelled pending abandoned-checkout', { email: target, removed });
  }
  return removed;
}

/**
 * Dispara IMEDIATAMENTE (sem agendamento), util pra testes.
 * Bypassa a fila.
 */
export async function sendNow(input: {
  toEmail: string;
  templateName: TemplateName;
  templateData: ThankYouVars | UpsellVars | UpsellV2Vars | RecoveryVars | AbandonedPopupVars | AbandonedCheckoutVars;
}): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const rendered = renderTemplate(input.templateName, input.templateData);
  if (!rendered) return { ok: false, error: `unknown template: ${input.templateName}` };

  return sendMail({
    to: input.toEmail,
    subject: rendered.subject,
    html: rendered.html,
    replyTo: process.env.RESEND_REPLY_TO || 'contact@belgianpaws.help'
  });
}

/**
 * Retorna todos os 'upsell' (ou 'upsell-v2') agendados — usado no endpoint admin de blast.
 */
export function listPendingUpsells(): Array<{
  id: string;
  toEmail: string;
  templateName: TemplateName;
  templateData: any;
  sendAt: number;
}> {
  startWorker();
  return queue
    .filter((i) => i.templateName === 'upsell' || i.templateName === 'upsell-v2')
    .map((i) => ({
      id: i.id,
      toEmail: i.toEmail,
      templateName: i.templateName,
      templateData: i.templateData,
      sendAt: i.sendAt
    }));
}

/**
 * Remove items da queue pelos IDs. Usado apos disparo manual do blast.
 */
export function cancelQueuedItems(ids: string[]): number {
  const before = queue.length;
  const set = new Set(ids);
  queue = queue.filter((i) => !set.has(i.id));
  save();
  return before - queue.length;
}
