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
  type ThankYouVars, type UpsellVars, type Locale
} from './email-templates';

type TemplateName = 'thank-you' | 'upsell';

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
const MAX_ATTEMPTS = 3;

let queue: ScheduledItem[] = [];
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
}

function save() {
  try {
    ensureDataDir();
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2), 'utf-8');
  } catch (e) {
    console.error('[email-scheduler] failed to save queue', e);
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

function startWorker() {
  if (workerStarted) return;
  workerStarted = true;
  ensureDataDir();
  load();
  setInterval(() => {
    tick().catch((e) => console.error('[email-scheduler] tick error', e));
  }, 30_000);
  // Tick imediato pra processar pendentes ao subir
  setTimeout(() => tick().catch(() => {}), 5_000);
  console.log('[email-scheduler] worker started');
}

export function initEmailScheduler() {
  startWorker();
}

/**
 * Agenda um email pra ser enviado depois de `delayMs` milisegundos.
 * Persiste no disco — sobrevive a restart.
 */
export function scheduleEmail(input: {
  toEmail: string;
  templateName: TemplateName;
  templateData: ThankYouVars | UpsellVars;
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
 * Dispara IMEDIATAMENTE (sem agendamento), util pra testes.
 * Bypassa a fila.
 */
export async function sendNow(input: {
  toEmail: string;
  templateName: TemplateName;
  templateData: ThankYouVars | UpsellVars;
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
