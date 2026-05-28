// In-memory analytics store.
// Funciona porque o Railway roda 1 replica (V2 numReplicas=1).
// Se escalar > 1 replica, migrar pra Postgres/Redis.

import type { RequestEvent } from '@sveltejs/kit';

export type EventName =
  | 'pageview'
  | 'heartbeat'
  | 'scroll_depth'
  | 'cta_click'
  | 'amount_select'
  | 'bancontact_click'
  | 'vsl_play_with_sound'
  | 'vsl_complete';

export interface AnalyticsEvent {
  ts: number;            // epoch ms
  sid: string;           // session id (anon UUID do client)
  ev: EventName;
  path: string;          // pathname
  ref?: string;          // referrer
  ua?: string;           // user agent
  device: 'mobile' | 'desktop' | 'tablet';
  country?: string;      // se inferido (placeholder por enquanto)
  ipMask?: string;       // ip mascarado (primeiros 2 octetos)
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  // payload livre por evento
  data?: Record<string, unknown>;
}

export interface Session {
  sid: string;
  startedAt: number;
  lastSeenAt: number;
  currentPath: string;
  device: 'mobile' | 'desktop' | 'tablet';
  country?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  pageViews: number;
  // milestones de funil
  reachedDonate: boolean;
  selectedAmount: number | null;
  clickedBancontact: boolean;
}

// Capacidade dura — evita estourar memória se trafego explodir
const MAX_EVENTS = 50_000;
const MAX_SESSIONS = 10_000;
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 min sem heartbeat = morta
const EVENT_TTL_MS = 24 * 60 * 60 * 1000; // 24h de retencao em memoria

// Buffer circular de eventos (mais novo no fim)
const events: AnalyticsEvent[] = [];
const sessions = new Map<string, Session>();

function gcIfNeeded() {
  const now = Date.now();
  // Drop events too old
  if (events.length > MAX_EVENTS || (events.length && now - events[0].ts > EVENT_TTL_MS)) {
    const cutoff = now - EVENT_TTL_MS;
    while (events.length && events[0].ts < cutoff) events.shift();
    while (events.length > MAX_EVENTS) events.shift();
  }
  // Drop dead sessions
  if (sessions.size > MAX_SESSIONS / 2) {
    for (const [sid, s] of sessions) {
      if (now - s.lastSeenAt > SESSION_TTL_MS) sessions.delete(sid);
    }
  }
}

export function parseDevice(ua: string): 'mobile' | 'desktop' | 'tablet' {
  if (!ua) return 'desktop';
  if (/iPad|Tablet/i.test(ua)) return 'tablet';
  if (/Mobi|Android|iPhone/i.test(ua)) return 'mobile';
  return 'desktop';
}

export function maskIp(ip: string | null | undefined): string {
  if (!ip) return '';
  // ipv4 → mantém 2 primeiros octetos
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.x.x`;
  }
  // ipv6 → mantém prefixo /32
  if (ip.includes(':')) {
    const parts = ip.split(':');
    return `${parts[0]}:${parts[1]}:x:x:x:x:x:x`;
  }
  return 'masked';
}

export function getClientIp(req: RequestEvent): string {
  const xf = req.request.headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0].trim();
  const real = req.request.headers.get('x-real-ip');
  if (real) return real;
  return req.getClientAddress?.() || '';
}

export function ingest(evt: AnalyticsEvent) {
  events.push(evt);

  // Atualiza sessao
  let s = sessions.get(evt.sid);
  if (!s) {
    s = {
      sid: evt.sid,
      startedAt: evt.ts,
      lastSeenAt: evt.ts,
      currentPath: evt.path,
      device: evt.device,
      country: evt.country,
      utm_source: evt.utm_source,
      utm_medium: evt.utm_medium,
      utm_campaign: evt.utm_campaign,
      pageViews: 0,
      reachedDonate: false,
      selectedAmount: null,
      clickedBancontact: false
    };
    sessions.set(evt.sid, s);
  }

  s.lastSeenAt = evt.ts;
  s.currentPath = evt.path;
  // Mantem UTM se chegar depois
  if (evt.utm_source && !s.utm_source) s.utm_source = evt.utm_source;
  if (evt.utm_medium && !s.utm_medium) s.utm_medium = evt.utm_medium;
  if (evt.utm_campaign && !s.utm_campaign) s.utm_campaign = evt.utm_campaign;

  switch (evt.ev) {
    case 'pageview':
      s.pageViews++;
      if (evt.path.startsWith('/donate')) s.reachedDonate = true;
      break;
    case 'amount_select': {
      const amt = Number(evt.data?.amount);
      if (Number.isFinite(amt) && amt > 0) s.selectedAmount = amt;
      break;
    }
    case 'bancontact_click':
      s.clickedBancontact = true;
      break;
  }

  gcIfNeeded();
}

export function reset(): { events: number; sessions: number } {
  const cleared = { events: events.length, sessions: sessions.size };
  events.length = 0;
  sessions.clear();
  return cleared;
}

// ─── Agregadores ───

export function snapshot(opts: {
  windowMs?: number;       // janela de tempo (default 24h)
  pathFilter?: string;     // ex: "/donate"
  device?: 'mobile' | 'desktop' | 'tablet';
}) {
  const now = Date.now();
  const winMs = opts.windowMs ?? 24 * 60 * 60 * 1000;
  const since = now - winMs;

  const filtered = events.filter((e) => {
    if (e.ts < since) return false;
    if (opts.pathFilter && !e.path.startsWith(opts.pathFilter)) return false;
    if (opts.device && e.device !== opts.device) return false;
    return true;
  });

  // Online agora = sessoes vistas nos ultimos 2 minutos
  const liveCutoff = now - 2 * 60 * 1000;
  const liveSessions: Session[] = [];
  for (const s of sessions.values()) {
    if (opts.device && s.device !== opts.device) continue;
    if (s.lastSeenAt >= liveCutoff) liveSessions.push(s);
  }

  // KPIs
  const pageviews = filtered.filter((e) => e.ev === 'pageview').length;
  const uniqueVisitors = new Set(filtered.map((e) => e.sid)).size;

  // Tempo medio de sessao (das sessoes que tem mais de 1 heartbeat)
  let totalDuration = 0;
  let durationCount = 0;
  for (const s of sessions.values()) {
    if (s.lastSeenAt < since) continue;
    const dur = s.lastSeenAt - s.startedAt;
    if (dur > 0) {
      totalDuration += dur;
      durationCount++;
    }
  }
  const avgSessionDurationSec = durationCount ? Math.round(totalDuration / durationCount / 1000) : 0;

  // Funil
  const sessionsInWindow = Array.from(sessions.values()).filter((s) => s.lastSeenAt >= since);
  const totalSessions = sessionsInWindow.length;
  const reachedDonate = sessionsInWindow.filter((s) => s.reachedDonate).length;
  const selectedAmount = sessionsInWindow.filter((s) => s.selectedAmount !== null).length;
  const clickedBancontact = sessionsInWindow.filter((s) => s.clickedBancontact).length;

  // Top valores selecionados
  const amountCounts = new Map<number, number>();
  for (const s of sessionsInWindow) {
    if (s.selectedAmount !== null) {
      amountCounts.set(s.selectedAmount, (amountCounts.get(s.selectedAmount) ?? 0) + 1);
    }
  }
  const topAmounts = [...amountCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([amount, count]) => ({ amount, count }));

  // UTM source breakdown (sessoes)
  const utmCounts = new Map<string, number>();
  for (const s of sessionsInWindow) {
    const key = s.utm_source || '(direct)';
    utmCounts.set(key, (utmCounts.get(key) ?? 0) + 1);
  }
  const utmBreakdown = [...utmCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([source, count]) => ({ source, count }));

  // Device breakdown (sessoes)
  const deviceCounts = { mobile: 0, desktop: 0, tablet: 0 };
  for (const s of sessionsInWindow) deviceCounts[s.device]++;

  // Pageviews por rota
  const pathCounts = new Map<string, number>();
  for (const e of filtered) {
    if (e.ev === 'pageview') {
      pathCounts.set(e.path, (pathCounts.get(e.path) ?? 0) + 1);
    }
  }
  const topPaths = [...pathCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([path, count]) => ({ path, count }));

  // Time series (pageviews por hora nas ultimas 24h)
  const bucketMs = winMs > 6 * 60 * 60 * 1000 ? 60 * 60 * 1000 : 10 * 60 * 1000;
  const buckets = Math.ceil(winMs / bucketMs);
  const timeSeries: { t: number; pv: number; sessions: number }[] = [];
  for (let i = 0; i < buckets; i++) {
    const t = since + i * bucketMs;
    timeSeries.push({ t, pv: 0, sessions: 0 });
  }
  const sessionStartByBucket = new Map<number, Set<string>>();
  for (const e of filtered) {
    const idx = Math.floor((e.ts - since) / bucketMs);
    if (idx < 0 || idx >= buckets) continue;
    if (e.ev === 'pageview') timeSeries[idx].pv++;
    let set = sessionStartByBucket.get(idx);
    if (!set) {
      set = new Set();
      sessionStartByBucket.set(idx, set);
    }
    set.add(e.sid);
  }
  for (const [idx, set] of sessionStartByBucket) timeSeries[idx].sessions = set.size;

  // Live sessions (preview pro feed)
  const liveSorted = liveSessions
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
    .slice(0, 50)
    .map((s) => ({
      sid: s.sid.slice(0, 8),
      path: s.currentPath,
      device: s.device,
      durationSec: Math.round((s.lastSeenAt - s.startedAt) / 1000),
      idleSec: Math.round((now - s.lastSeenAt) / 1000),
      utm_source: s.utm_source || null,
      reachedDonate: s.reachedDonate,
      selectedAmount: s.selectedAmount,
      clickedBancontact: s.clickedBancontact
    }));

  // Live feed (ultimos 50 eventos relevantes)
  const liveFeed = events
    .slice(-200)
    .filter((e) => e.ts >= now - 5 * 60 * 1000)
    .filter((e) => e.ev !== 'heartbeat')
    .slice(-50)
    .reverse()
    .map((e) => ({
      ts: e.ts,
      sid: e.sid.slice(0, 8),
      ev: e.ev,
      path: e.path,
      device: e.device,
      data: e.data ?? null
    }));

  return {
    now,
    windowMs: winMs,
    kpis: {
      online: liveSessions.length,
      pageviews,
      uniqueVisitors,
      avgSessionDurationSec,
      totalSessions,
      conversionRate: totalSessions ? clickedBancontact / totalSessions : 0
    },
    funnel: {
      totalSessions,
      reachedDonate,
      selectedAmount,
      clickedBancontact
    },
    topAmounts,
    utmBreakdown,
    deviceCounts,
    topPaths,
    timeSeries,
    liveSessions: liveSorted,
    liveFeed,
    capacity: {
      events: events.length,
      sessions: sessions.size
    }
  };
}
