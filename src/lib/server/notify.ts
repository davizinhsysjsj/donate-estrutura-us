/**
 * Notificações push via Pushcut (iOS).
 * Fire-and-forget — não bloqueia o endpoint principal.
 *
 * Env vars:
 *   PUSHCUT_API_KEY        — API Key (header API-Key)
 *   PUSHCUT_NOTIFICATION   — nome exato da notificação configurada no app (ex: "IC INICIADO")
 */

import { env } from '$env/dynamic/private';

// Dedup em memoria: 1 notificação por sid a cada TTL (evita spam de cliques múltiplos)
const recentNotified = new Map<string, number>();
const NOTIFY_DEDUP_TTL_MS = 30 * 60 * 1000; // 30 min

function gcDedup() {
  const now = Date.now();
  for (const [sid, ts] of recentNotified) {
    if (now - ts > NOTIFY_DEDUP_TTL_MS) recentNotified.delete(sid);
  }
}

export interface IcNotifyPayload {
  sid?: string;          // dedup key (opcional)
  amount?: number;       // €30, €100, etc
  tierName?: string;     // Bronze, Guardian, etc
  country?: string;
  countryCode?: string;
  city?: string;
  device?: string;
  browser?: string;
  utmSource?: string;
  utmCampaign?: string;
  eventId?: string;
}

const TIER_BY_AMOUNT: Record<number, string> = {
  10: 'Bronze', 15: 'Helper', 20: 'Silver', 25: 'Gold', 30: 'Guardian',
  35: 'Platinum', 50: 'Hero', 80: 'Champion', 100: 'Protector',
  200: 'Benefactor', 300: 'Patron', 500: 'Saviour'
};

function flag(code?: string): string {
  if (!code || code.length !== 2) return '🌐';
  try {
    return code.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
  } catch { return '🌐'; }
}

export function notifyIcStarted(p: IcNotifyPayload): void {
  const API_KEY = env.PUSHCUT_API_KEY;
  const NAME = env.PUSHCUT_NOTIFICATION || 'IC INICIADO';
  if (!API_KEY) return; // silently noop se nao configurado

  // Dedup por sid (1 notificação por sessão a cada 30min)
  if (p.sid) {
    const last = recentNotified.get(p.sid);
    if (last && Date.now() - last < NOTIFY_DEDUP_TTL_MS) return;
    recentNotified.set(p.sid, Date.now());
    gcDedup();
  }

  // Titulo: "Checkout iniciado no valor de €30"
  const amountTxt = p.amount ? `€${p.amount}` : '—';
  const title = `Checkout iniciado no valor de ${amountTxt}`;

  // Localizacao
  const locParts: string[] = [];
  if (p.city) locParts.push(p.city);
  if (p.country) locParts.push(p.country);
  const loc = locParts.length ? `${flag(p.countryCode)} ${locParts.join(', ')}` : '🌐 Localização desconhecida';

  // Origem: "Source: meta - nome-da-campanha"
  let src: string;
  if (p.utmSource && p.utmCampaign) {
    src = `Source: ${p.utmSource} - ${p.utmCampaign}`;
  } else if (p.utmSource) {
    src = `Source: ${p.utmSource}`;
  } else {
    src = 'Source: direto';
  }

  // Pushcut: title sobrescreve o titulo da notificação configurada
  const text = `${loc}\n${src}`;

  const url = `https://api.pushcut.io/v1/notifications/${encodeURIComponent(NAME)}`;

  // Fire-and-forget — não dá await
  fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'API-Key': API_KEY
    },
    body: JSON.stringify({
      title,
      text,
      input: p.eventId ? `event_id ${p.eventId.slice(0, 8)}` : undefined
    })
  })
    .then(async (r) => {
      if (!r.ok) {
        const t = await r.text().catch(() => '');
        console.warn('[notify] pushcut not ok', r.status, t.slice(0, 200));
      } else {
        console.log('[notify] pushcut sent', { title, sid: p.sid?.slice(0, 8) });
      }
    })
    .catch((e) => console.warn('[notify] pushcut failed', e));
}

/**
 * Notificação genérica Pushcut — usa notification "DOMAIN STATUS" no app.
 * title/text são sobrescritos pela API. Fire-and-forget.
 */
function pushcutRaw(notificationName: string, title: string, text: string): void {
  const API_KEY = env.PUSHCUT_API_KEY;
  if (!API_KEY) return;
  const url = `https://api.pushcut.io/v1/notifications/${encodeURIComponent(notificationName)}`;
  fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'API-Key': API_KEY },
    body: JSON.stringify({ title, text })
  })
    .then(async (r) => {
      if (!r.ok) {
        const t = await r.text().catch(() => '');
        console.warn('[notify] pushcut not ok', r.status, t.slice(0, 200));
      } else {
        console.log('[notify] pushcut sent', { title });
      }
    })
    .catch((e) => console.warn('[notify] pushcut failed', e));
}

export function notifyDomainDown(p: {
  domain: string;
  status?: number;
  error?: string;
  latencyMs?: number;
}): void {
  const NAME = env.PUSHCUT_DOMAIN_NOTIFICATION || 'DOMAIN STATUS';
  const title = `🔴 ${p.domain} caiu`;
  const detail = p.status
    ? `HTTP ${p.status}`
    : p.error
      ? p.error.slice(0, 80)
      : 'timeout';
  const text = `${detail}\n${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;
  pushcutRaw(NAME, title, text);
}

export function notifyDomainUp(p: {
  domain: string;
  downtimeMs?: number;
}): void {
  const NAME = env.PUSHCUT_DOMAIN_NOTIFICATION || 'DOMAIN STATUS';
  const title = `✅ ${p.domain} voltou`;
  const downtimeTxt = p.downtimeMs
    ? `Ficou fora ${formatDuration(p.downtimeMs)}`
    : 'Voltou ao ar';
  const text = `${downtimeTxt}\n${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;
  pushcutRaw(NAME, title, text);
}

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return remM ? `${h}h ${remM}min` : `${h}h`;
}
