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

  // Origem: "meta - nome-da-campanha" (sem device, sem ponto medio)
  let src: string;
  if (p.utmSource && p.utmCampaign) {
    src = `📊 ${p.utmSource} - ${p.utmCampaign}`;
  } else if (p.utmSource) {
    src = `📊 ${p.utmSource}`;
  } else {
    src = '📊 direto';
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
