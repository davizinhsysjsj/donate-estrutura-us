// Analytics store in-memory + snapshot periodico em /tmp.
// Funciona porque o Railway roda 1 replica (V2 numReplicas=1).

import type { RequestEvent } from '@sveltejs/kit';
import * as fs from 'node:fs';
import * as path from 'node:path';

export type EventName =
  | 'pageview'
  | 'heartbeat'
  | 'scroll_depth'
  | 'cta_click'
  | 'amount_select'
  | 'bancontact_click'
  | 'vsl_play_with_sound'
  | 'vsl_quartile'
  | 'vsl_rewatch'
  | 'vsl_complete'
  | 'web_vital'
  | 'js_error'
  | 'section_view'
  | 'click_heatmap'
  | 'rage_click'
  | 'dead_click'
  | 'scroll_back'
  | 'purchase';

export interface AnalyticsEvent {
  ts: number;
  sid: string;
  ev: EventName;
  path: string;
  ref?: string;
  ua?: string;
  device: 'mobile' | 'desktop' | 'tablet';
  country?: string;
  city?: string;
  ipMask?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  data?: Record<string, unknown>;
}

export interface VitalsData {
  lcp?: number;
  inp?: number;
  cls?: number;
  ttfb?: number;
  fcp?: number;
}

export interface Session {
  sid: string;
  startedAt: number;
  lastSeenAt: number;
  currentPath: string;
  landingPath: string;
  device: 'mobile' | 'desktop' | 'tablet';
  // geo
  country?: string;
  countryCode?: string;
  city?: string;
  isp?: string;
  isProxy?: boolean;
  // ua/browser
  browser?: string;
  os?: string;
  // origem
  ref?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  fbclid?: string;
  // funil
  pageViews: number;
  reachedDonate: boolean;
  reachedDonateAt?: number;
  selectedAmount: number | null;
  selectedAmountAt?: number;
  clickedBancontact: boolean;
  clickedBancontactAt?: number;
  purchaseAmount?: number;
  purchaseAt?: number;
  // engajamento
  vitals: VitalsData;
  sectionTimes: Record<string, number>; // section -> ms acumulado
  scrollMax: number;
  scrollBacks: number;
  clicks: number;
  rageClicks: number;
  deadClicks: number;
  hasMouseMove: boolean;
  // vsl
  vslPlayedWithSound: boolean;
  vslMaxQuartile: number; // 0 (none), 25, 50, 75, 100
  vslRewatches: number;
  // bot
  isBot: boolean;
  botReasons: string[];
}

const MAX_EVENTS = 80_000;
const MAX_SESSIONS = 15_000;
const SESSION_TTL_MS = 60 * 60 * 1000; // 1h
const EVENT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

const events: AnalyticsEvent[] = [];
const sessions = new Map<string, Session>();

// Heatmap: armazena (path, x_pct, y_pct, ts, device) — separado pra nao inchar events principais
interface HeatPoint { path: string; x: number; y: number; ts: number; device: string; }
const heat: HeatPoint[] = [];
const MAX_HEAT = 20_000;

// ─── Persistencia (snapshot JSON em volume persistente) ───
// PATH: usa ANALYTICS_DATA_DIR (env), default /data (volume Railway) com fallback /tmp.
// CRITICO: /tmp e efemero no Railway — dados somem a cada redeploy/restart.

const ANALYTICS_DIR = process.env.ANALYTICS_DATA_DIR || '/data';
const SNAPSHOT_PATH = `${ANALYTICS_DIR}/analytics-snapshot.json`;
const SNAPSHOT_INTERVAL_MS = 60_000;

function saveSnapshot() {
  try {
    if (!fs.existsSync(ANALYTICS_DIR)) {
      fs.mkdirSync(ANALYTICS_DIR, { recursive: true });
    }
    const payload = {
      events,
      sessions: Array.from(sessions.entries()),
      heat,
      savedAt: Date.now()
    };
    fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(payload), 'utf-8');
  } catch (e) {
    console.warn('[analytics] snapshot save failed:', e);
  }
}

function loadSnapshot() {
  try {
    if (!fs.existsSync(SNAPSHOT_PATH)) return;
    const raw = fs.readFileSync(SNAPSHOT_PATH, 'utf-8');
    const p = JSON.parse(raw);
    if (Array.isArray(p.events)) events.push(...p.events);
    if (Array.isArray(p.sessions)) {
      for (const [sid, s] of p.sessions) sessions.set(sid, s);
    }
    if (Array.isArray(p.heat)) heat.push(...p.heat);
    console.log(`[analytics] loaded snapshot: ${events.length} events, ${sessions.size} sessions`);
  } catch (e) {
    console.warn('[analytics] snapshot load failed:', e);
  }
}

let snapTimer: ReturnType<typeof setInterval> | null = null;
let initialized = false;
export function initStore() {
  if (initialized) return;
  initialized = true;
  loadSnapshot();
  snapTimer = setInterval(saveSnapshot, SNAPSHOT_INTERVAL_MS);
}

// ─── Helpers ───

function gcIfNeeded() {
  const now = Date.now();
  if (events.length > MAX_EVENTS || (events.length && now - events[0].ts > EVENT_TTL_MS)) {
    const cutoff = now - EVENT_TTL_MS;
    while (events.length && events[0].ts < cutoff) events.shift();
    while (events.length > MAX_EVENTS) events.shift();
  }
  if (sessions.size > MAX_SESSIONS / 2) {
    for (const [sid, s] of sessions) {
      if (now - s.lastSeenAt > SESSION_TTL_MS * 2) sessions.delete(sid);
    }
  }
  if (heat.length > MAX_HEAT) heat.splice(0, heat.length - MAX_HEAT);
}

export function parseDevice(ua: string): 'mobile' | 'desktop' | 'tablet' {
  if (!ua) return 'desktop';
  if (/iPad|Tablet/i.test(ua)) return 'tablet';
  if (/Mobi|Android|iPhone/i.test(ua)) return 'mobile';
  return 'desktop';
}

export function parseBrowser(ua: string): { browser: string; os: string } {
  let browser = 'unknown';
  let os = 'unknown';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/Chrome\//.test(ua) && !/Edg/.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';
  else if (/Opera|OPR/.test(ua)) browser = 'Opera';

  if (/Windows/.test(ua)) os = 'Windows';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  return { browser, os };
}

function detectBot(ua: string, ip: string): { isBot: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (/bot|crawler|spider|crawling|headless|preview|fetch/i.test(ua)) reasons.push('ua-bot');
  if (!ua || ua.length < 20) reasons.push('ua-short');
  if (/python|curl|wget|http-client|axios/i.test(ua)) reasons.push('ua-tool');
  return { isBot: reasons.length > 0, reasons };
}

export function maskIp(ip: string | null | undefined): string {
  if (!ip) return '';
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.x.x`;
  }
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

// ─── Ingest ───

export interface IngestInput {
  ts: number;
  sid: string;
  ev: EventName;
  path: string;
  ref?: string;
  ua?: string;
  ip?: string;
  device: 'mobile' | 'desktop' | 'tablet';
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  fbclid?: string;
  data?: Record<string, unknown>;
  geo?: { country?: string; countryCode?: string; city?: string; isp?: string; proxy?: boolean };
}

export function ingest(evt: IngestInput) {
  const isHeatmap = evt.ev === 'click_heatmap';

  if (!isHeatmap) {
    events.push({
      ts: evt.ts,
      sid: evt.sid,
      ev: evt.ev,
      path: evt.path,
      ref: evt.ref,
      ua: evt.ua?.slice(0, 200),
      device: evt.device,
      country: evt.geo?.country,
      city: evt.geo?.city,
      ipMask: maskIp(evt.ip),
      utm_source: evt.utm_source,
      utm_medium: evt.utm_medium,
      utm_campaign: evt.utm_campaign,
      utm_content: evt.utm_content,
      utm_term: evt.utm_term,
      data: evt.data
    });
  } else if (typeof evt.data?.x === 'number' && typeof evt.data?.y === 'number') {
    heat.push({
      path: evt.path,
      x: Math.round(evt.data.x),
      y: Math.round(evt.data.y),
      ts: evt.ts,
      device: evt.device
    });
  }

  // Atualiza/cria sessao
  let s = sessions.get(evt.sid);
  if (!s) {
    const bot = evt.ua ? detectBot(evt.ua, evt.ip || '') : { isBot: false, reasons: [] };
    if (evt.geo?.proxy) {
      bot.isBot = true;
      bot.reasons.push('proxy-hosting');
    }
    const { browser, os } = evt.ua ? parseBrowser(evt.ua) : { browser: 'unknown', os: 'unknown' };
    s = {
      sid: evt.sid,
      startedAt: evt.ts,
      lastSeenAt: evt.ts,
      currentPath: evt.path,
      landingPath: evt.path,
      device: evt.device,
      country: evt.geo?.country,
      countryCode: evt.geo?.countryCode,
      city: evt.geo?.city,
      isp: evt.geo?.isp,
      isProxy: evt.geo?.proxy,
      browser,
      os,
      ref: evt.ref,
      utm_source: evt.utm_source,
      utm_medium: evt.utm_medium,
      utm_campaign: evt.utm_campaign,
      utm_content: evt.utm_content,
      utm_term: evt.utm_term,
      fbclid: evt.fbclid,
      pageViews: 0,
      reachedDonate: false,
      selectedAmount: null,
      clickedBancontact: false,
      vitals: {},
      sectionTimes: {},
      scrollMax: 0,
      scrollBacks: 0,
      clicks: 0,
      rageClicks: 0,
      deadClicks: 0,
      hasMouseMove: false,
      vslPlayedWithSound: false,
      vslMaxQuartile: 0,
      vslRewatches: 0,
      isBot: bot.isBot,
      botReasons: bot.reasons
    };
    sessions.set(evt.sid, s);
  }

  s.lastSeenAt = evt.ts;
  s.currentPath = evt.path;
  if (evt.utm_source && !s.utm_source) s.utm_source = evt.utm_source;
  if (evt.utm_medium && !s.utm_medium) s.utm_medium = evt.utm_medium;
  if (evt.utm_campaign && !s.utm_campaign) s.utm_campaign = evt.utm_campaign;
  if (evt.utm_content && !s.utm_content) s.utm_content = evt.utm_content;
  if (evt.utm_term && !s.utm_term) s.utm_term = evt.utm_term;
  if (evt.fbclid && !s.fbclid) s.fbclid = evt.fbclid;
  if (evt.geo?.country && !s.country) {
    s.country = evt.geo.country;
    s.countryCode = evt.geo.countryCode;
    s.city = evt.geo.city;
    s.isp = evt.geo.isp;
    if (evt.geo.proxy) s.isProxy = true;
  }

  const d = evt.data || {};
  switch (evt.ev) {
    case 'pageview':
      s.pageViews++;
      if (evt.path.startsWith('/donate')) {
        if (!s.reachedDonate) {
          s.reachedDonate = true;
          s.reachedDonateAt = evt.ts;
        }
      }
      break;
    case 'amount_select': {
      const amt = Number(d.amount);
      if (Number.isFinite(amt) && amt > 0) {
        s.selectedAmount = amt;
        if (!s.selectedAmountAt) s.selectedAmountAt = evt.ts;
      }
      break;
    }
    case 'bancontact_click':
      s.clickedBancontact = true;
      if (!s.clickedBancontactAt) s.clickedBancontactAt = evt.ts;
      break;
    case 'web_vital':
      if (typeof d.lcp === 'number') s.vitals.lcp = d.lcp as number;
      if (typeof d.inp === 'number') s.vitals.inp = d.inp as number;
      if (typeof d.cls === 'number') s.vitals.cls = d.cls as number;
      if (typeof d.ttfb === 'number') s.vitals.ttfb = d.ttfb as number;
      if (typeof d.fcp === 'number') s.vitals.fcp = d.fcp as number;
      break;
    case 'section_view': {
      const name = String(d.section || '');
      const ms = Number(d.ms || 0);
      if (name && ms > 0) s.sectionTimes[name] = (s.sectionTimes[name] ?? 0) + ms;
      break;
    }
    case 'scroll_depth': {
      const pct = Number(d.pct || 0);
      if (pct > s.scrollMax) s.scrollMax = pct;
      break;
    }
    case 'scroll_back':
      s.scrollBacks++;
      break;
    case 'click_heatmap':
      s.clicks++;
      s.hasMouseMove = true;
      break;
    case 'rage_click':
      s.rageClicks++;
      break;
    case 'dead_click':
      s.deadClicks++;
      break;
    case 'vsl_play_with_sound':
      s.vslPlayedWithSound = true;
      break;
    case 'vsl_quartile': {
      const q = Number(d.q || 0);
      if (q > s.vslMaxQuartile) s.vslMaxQuartile = q;
      break;
    }
    case 'vsl_rewatch':
      s.vslRewatches++;
      break;
    case 'purchase': {
      const amt = Number(d.amount);
      if (Number.isFinite(amt) && amt > 0) {
        s.purchaseAmount = amt;
        s.purchaseAt = evt.ts;
      }
      break;
    }
  }

  // Sinal heuristico de bot: sem mouse_move depois de 2 pageviews
  if (s.pageViews >= 2 && !s.hasMouseMove && !s.isBot) {
    s.isBot = true;
    s.botReasons.push('no-mouse');
  }

  gcIfNeeded();
}

export function reset(): { events: number; sessions: number; heat: number } {
  const cleared = { events: events.length, sessions: sessions.size, heat: heat.length };
  events.length = 0;
  sessions.clear();
  heat.length = 0;
  saveSnapshot();
  return cleared;
}

// ─── Snapshot agregado ───

function p(arr: number[], pct: number): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * pct));
  return sorted[idx];
}

export interface SnapshotOpts {
  windowMs?: number;
  sinceTs?: number;   // timestamp exato de início (sobrescreve windowMs)
  untilTs?: number;   // timestamp exato de fim (default: now)
  pathFilter?: string;
  device?: 'mobile' | 'desktop' | 'tablet';
  countryCode?: string;
  includeBots?: boolean;
}

export function snapshot(opts: SnapshotOpts) {
  const now = Date.now();
  let since: number;
  let until: number;
  let winMs: number;

  if (opts.sinceTs !== undefined) {
    since = opts.sinceTs;
    until = opts.untilTs ?? now;
    winMs = until - since;
  } else {
    winMs = opts.windowMs ?? 24 * 60 * 60 * 1000;
    until = now;
    since = until - winMs;
  }
  const prevSince = since - winMs;

  // Filtra sessoes
  const matchSession = (s: Session) => {
    if (opts.device && s.device !== opts.device) return false;
    if (opts.countryCode && s.countryCode !== opts.countryCode) return false;
    if (!opts.includeBots && s.isBot) return false;
    return true;
  };

  const sessionsInWindow: Session[] = [];
  const sessionsPrev: Session[] = [];
  for (const s of sessions.values()) {
    if (!matchSession(s)) continue;
    if (s.lastSeenAt >= since && s.lastSeenAt < until) sessionsInWindow.push(s);
    else if (s.lastSeenAt >= prevSince && s.lastSeenAt < since) sessionsPrev.push(s);
  }
  const sidsInWindow = new Set(sessionsInWindow.map((s) => s.sid));

  const filteredEvents = events.filter((e) => {
    if (e.ts < since || e.ts >= until) return false;
    if (opts.pathFilter && !e.path.startsWith(opts.pathFilter)) return false;
    if (opts.device && e.device !== opts.device) return false;
    if (!sidsInWindow.has(e.sid)) return false;
    return true;
  });

  // Live (2 min)
  const liveCutoff = now - 2 * 60 * 1000;
  const liveSessions = sessionsInWindow.filter((s) => s.lastSeenAt >= liveCutoff);

  // Contagem de online por rota (path atual da sessao)
  const onlineByPath: Record<string, number> = {};
  for (const s of liveSessions) {
    const key = s.currentPath || '/';
    onlineByPath[key] = (onlineByPath[key] ?? 0) + 1;
  }
  const onlineDonate =
    (onlineByPath['/donate'] ?? 0) +
    Object.entries(onlineByPath)
      .filter(([k]) => k.startsWith('/donate/'))
      .reduce((acc, [, v]) => acc + v, 0);
  const onlineLp = onlineByPath['/'] ?? 0;
  const onlineVsl =
    (onlineByPath['/vsl'] ?? 0) +
    Object.entries(onlineByPath)
      .filter(([k]) => k.startsWith('/vsl/'))
      .reduce((acc, [, v]) => acc + v, 0);

  // KPIs
  const pageviews = filteredEvents.filter((e) => e.ev === 'pageview').length;
  const uniqueVisitors = sessionsInWindow.length;

  let totalDuration = 0;
  for (const s of sessionsInWindow) totalDuration += Math.max(0, s.lastSeenAt - s.startedAt);
  const avgSessionDurationSec = sessionsInWindow.length
    ? Math.round(totalDuration / sessionsInWindow.length / 1000)
    : 0;

  // Funnel — contadores por timestamp da ação (não por lastSeenAt da sessão)
  // Garante que "clicou hoje" = ação ocorreu hoje, não que "estava ativo hoje"
  const totalSessions = sessionsInWindow.length;

  const inWin = (ts?: number) => ts !== undefined && ts >= since && ts < until;

  const reachedDonate    = sessionsInWindow.filter((s) => inWin(s.reachedDonateAt)).length;
  const selectedAmount   = sessionsInWindow.filter((s) => inWin(s.selectedAmountAt)).length;
  const clickedBancontact = sessionsInWindow.filter((s) => inWin(s.clickedBancontactAt)).length;
  // purchased e revenue calculados abaixo por purchaseAt (ver seção Receita)

  const timesLpToDonate: number[] = [];
  const timesDonateToAmount: number[] = [];
  const timesAmountToBcc: number[] = [];
  for (const s of sessionsInWindow) {
    if (inWin(s.reachedDonateAt)) timesLpToDonate.push(s.reachedDonateAt! - s.startedAt);
    if (inWin(s.reachedDonateAt) && inWin(s.selectedAmountAt))
      timesDonateToAmount.push(s.selectedAmountAt! - s.reachedDonateAt!);
    if (inWin(s.selectedAmountAt) && inWin(s.clickedBancontactAt))
      timesAmountToBcc.push(s.clickedBancontactAt! - s.selectedAmountAt!);
  }
  const median = (arr: number[]) => p(arr, 0.5);

  // Receita — filtra por purchaseAt (quando a compra ocorreu), não por lastSeenAt
  // Isso evita atribuir compras de ontem a "hoje" se a sessão ainda está ativa
  let revenue = 0;
  let purchasedCount = 0;
  const revenueBySource = new Map<string, { revenue: number; count: number }>();

  for (const s of sessions.values()) {
    if (!matchSession(s)) continue;
    if (!s.purchaseAmount || !s.purchaseAt) continue;
    if (s.purchaseAt < since || s.purchaseAt >= until) continue;
    revenue += s.purchaseAmount;
    purchasedCount++;
    const key = s.utm_source || '(direct)';
    const cur = revenueBySource.get(key) ?? { revenue: 0, count: 0 };
    cur.revenue += s.purchaseAmount;
    cur.count++;
    revenueBySource.set(key, cur);
  }
  const purchased = purchasedCount;
  const avgTicket = purchased ? revenue / purchased : 0;

  let revenuePrev = 0;
  for (const s of sessions.values()) {
    if (!matchSession(s) || !s.purchaseAmount || !s.purchaseAt) continue;
    if (s.purchaseAt >= prevSince && s.purchaseAt < since) revenuePrev += s.purchaseAmount;
  }
  const pageviewsPrev = events.filter(
    (e) => e.ts >= prevSince && e.ts < since && e.ev === 'pageview'
  ).length;

  // Top amounts
  const amountCounts = new Map<number, number>();
  for (const s of sessionsInWindow) {
    if (s.selectedAmount !== null) {
      amountCounts.set(s.selectedAmount, (amountCounts.get(s.selectedAmount) ?? 0) + 1);
    }
  }
  const topAmounts = [...amountCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([amount, count]) => ({ amount, count }));

  // UTM source
  const utmCounts = new Map<string, number>();
  for (const s of sessionsInWindow) {
    const key = s.utm_source || '(direct)';
    utmCounts.set(key, (utmCounts.get(key) ?? 0) + 1);
  }
  const utmBreakdown = [...utmCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([source, count]) => ({ source, count }));

  // Device
  const deviceCounts = { mobile: 0, desktop: 0, tablet: 0 };
  for (const s of sessionsInWindow) deviceCounts[s.device]++;

  // Browser
  const browserCounts = new Map<string, number>();
  for (const s of sessionsInWindow) {
    const key = s.browser || 'unknown';
    browserCounts.set(key, (browserCounts.get(key) ?? 0) + 1);
  }
  const browserBreakdown = [...browserCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([browser, count]) => ({ browser, count }));

  // Geo breakdown
  const geoCounts = new Map<string, { count: number; code: string; cities: Map<string, number> }>();
  for (const s of sessionsInWindow) {
    const key = s.country || 'Unknown';
    const cur = geoCounts.get(key) ?? { count: 0, code: s.countryCode || '', cities: new Map() };
    cur.count++;
    if (s.city) cur.cities.set(s.city, (cur.cities.get(s.city) ?? 0) + 1);
    geoCounts.set(key, cur);
  }
  const geoBreakdown = [...geoCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([country, v]) => ({
      country,
      countryCode: v.code,
      count: v.count,
      cities: [...v.cities.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([city, c]) => ({ city, count: c }))
    }));

  // Pageviews por rota
  const pathCounts = new Map<string, number>();
  for (const e of filteredEvents) {
    if (e.ev === 'pageview') {
      pathCounts.set(e.path, (pathCounts.get(e.path) ?? 0) + 1);
    }
  }
  const topPaths = [...pathCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([path, count]) => ({ path, count }));

  // Vitals KPIs (p75)
  const lcps: number[] = [];
  const inps: number[] = [];
  const clss: number[] = [];
  const ttfbs: number[] = [];
  const errors: number[] = [];
  for (const s of sessionsInWindow) {
    if (typeof s.vitals.lcp === 'number') lcps.push(s.vitals.lcp);
    if (typeof s.vitals.inp === 'number') inps.push(s.vitals.inp);
    if (typeof s.vitals.cls === 'number') clss.push(s.vitals.cls);
    if (typeof s.vitals.ttfb === 'number') ttfbs.push(s.vitals.ttfb);
  }
  for (const e of filteredEvents) if (e.ev === 'js_error') errors.push(e.ts);
  const vitalsKpis = {
    lcpP75: p(lcps, 0.75),
    inpP75: p(inps, 0.75),
    clsP75: p(clss, 0.75),
    ttfbP75: p(ttfbs, 0.75),
    errorsCount: errors.length,
    samples: lcps.length
  };

  // Tempo por secao (media)
  const sectionAccum = new Map<string, { total: number; count: number }>();
  for (const s of sessionsInWindow) {
    for (const [k, v] of Object.entries(s.sectionTimes)) {
      const cur = sectionAccum.get(k) ?? { total: 0, count: 0 };
      cur.total += v;
      cur.count++;
      sectionAccum.set(k, cur);
    }
  }
  const sectionTimes = [...sectionAccum.entries()]
    .map(([section, { total, count }]) => ({
      section,
      avgMs: Math.round(total / count),
      sessions: count
    }))
    .sort((a, b) => b.avgMs - a.avgMs);

  // VSL retention (funil de quartile)
  const vslSessions = sessionsInWindow.filter((s) => s.vslMaxQuartile > 0 || s.vslPlayedWithSound);
  const vslRetention = {
    started: vslSessions.length,
    soundOn: vslSessions.filter((s) => s.vslPlayedWithSound).length,
    q25: vslSessions.filter((s) => s.vslMaxQuartile >= 25).length,
    q50: vslSessions.filter((s) => s.vslMaxQuartile >= 50).length,
    q75: vslSessions.filter((s) => s.vslMaxQuartile >= 75).length,
    q100: vslSessions.filter((s) => s.vslMaxQuartile >= 100).length,
    rewatchTotal: vslSessions.reduce((acc, s) => acc + s.vslRewatches, 0)
  };

  // A/B LP vs VSL
  const lpSessions = sessionsInWindow.filter((s) => s.landingPath === '/' || s.landingPath === '');
  const vslLanding = sessionsInWindow.filter((s) => s.landingPath?.startsWith('/vsl'));
  const cmpStats = (arr: Session[]) => ({
    sessions: arr.length,
    convCheckout: arr.filter((s) => s.clickedBancontact).length,
    convPurchase: arr.filter((s) => s.purchaseAmount).length,
    revenue: arr.reduce((a, s) => a + (s.purchaseAmount || 0), 0),
    avgDurationSec:
      arr.length === 0
        ? 0
        : Math.round(arr.reduce((a, s) => a + (s.lastSeenAt - s.startedAt), 0) / arr.length / 1000)
  });
  const abTest = { lp: cmpStats(lpSessions), vsl: cmpStats(vslLanding) };

  // Time series
  const bucketMs = winMs > 6 * 60 * 60 * 1000 ? 60 * 60 * 1000 : 10 * 60 * 1000;
  const buckets = Math.ceil(winMs / bucketMs);
  const timeSeries: { t: number; pv: number; sessions: number; revenue: number }[] = [];
  for (let i = 0; i < buckets; i++) timeSeries.push({ t: since + i * bucketMs, pv: 0, sessions: 0, revenue: 0 });
  const sessionStartByBucket = new Map<number, Set<string>>();
  for (const e of filteredEvents) {
    const idx = Math.floor((e.ts - since) / bucketMs);
    if (idx < 0 || idx >= buckets) continue;
    if (e.ev === 'pageview') timeSeries[idx].pv++;
    let set = sessionStartByBucket.get(idx);
    if (!set) { set = new Set(); sessionStartByBucket.set(idx, set); }
    set.add(e.sid);
  }
  for (const s of sessionsInWindow) {
    if (s.purchaseAt && s.purchaseAmount) {
      const idx = Math.floor((s.purchaseAt - since) / bucketMs);
      if (idx >= 0 && idx < buckets) timeSeries[idx].revenue += s.purchaseAmount;
    }
  }
  for (const [idx, set] of sessionStartByBucket) timeSeries[idx].sessions = set.size;

  // Live sessoes detalhadas
  const liveSorted = liveSessions
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
    .slice(0, 100)
    .map((s) => ({
      sid: s.sid.slice(0, 10),
      sidFull: s.sid,
      path: s.currentPath,
      landing: s.landingPath,
      device: s.device,
      browser: s.browser,
      country: s.country,
      countryCode: s.countryCode,
      city: s.city,
      durationSec: Math.round((s.lastSeenAt - s.startedAt) / 1000),
      idleSec: Math.round((now - s.lastSeenAt) / 1000),
      utm_source: s.utm_source || null,
      reachedDonate: s.reachedDonate,
      selectedAmount: s.selectedAmount,
      clickedBancontact: s.clickedBancontact,
      purchaseAmount: s.purchaseAmount,
      scrollMax: s.scrollMax,
      vslMaxQuartile: s.vslMaxQuartile,
      isBot: s.isBot,
      rageClicks: s.rageClicks
    }));

  // Live feed
  const liveFeed = events
    .slice(-300)
    .filter((e) => e.ts >= now - 5 * 60 * 1000)
    .filter((e) => e.ev !== 'heartbeat' && e.ev !== 'web_vital')
    .filter((e) => sidsInWindow.has(e.sid))
    .slice(-60)
    .reverse()
    .map((e) => ({
      ts: e.ts,
      sid: e.sid.slice(0, 10),
      ev: e.ev,
      path: e.path,
      device: e.device,
      country: e.country,
      data: e.data ?? null
    }));

  // Heatmap dos cliques (apenas no path filtrado se houver)
  const heatFiltered = heat
    .filter((h) => h.ts >= since)
    .filter((h) => (opts.pathFilter ? h.path.startsWith(opts.pathFilter) : true))
    .filter((h) => (opts.device ? h.device === opts.device : true))
    .slice(-500);

  // Comparativo periodo anterior
  const sessPrev = sessionsPrev.length;
  const conversionPrev = sessPrev ? sessionsPrev.filter((s) => s.clickedBancontact).length / sessPrev : 0;
  const conversionRate = totalSessions ? clickedBancontact / totalSessions : 0;
  const compare = {
    sessions: { now: totalSessions, prev: sessPrev, delta: deltaPct(totalSessions, sessPrev) },
    pageviews: { now: pageviews, prev: pageviewsPrev, delta: deltaPct(pageviews, pageviewsPrev) },
    revenue: { now: revenue, prev: revenuePrev, delta: deltaPct(revenue, revenuePrev) },
    conversion: { now: conversionRate, prev: conversionPrev, delta: deltaPct(conversionRate, conversionPrev) }
  };

  return {
    now,
    windowMs: winMs,
    kpis: {
      online: liveSessions.length,
      onlineLp,
      onlineDonate,
      onlineVsl,
      onlineByPath,
      pageviews,
      uniqueVisitors,
      avgSessionDurationSec,
      totalSessions,
      conversionRate,
      revenue,
      avgTicket,
      purchased
    },
    funnel: {
      totalSessions,
      reachedDonate,
      selectedAmount,
      clickedBancontact,
      purchased
    },
    funnelTiming: {
      medianLpToDonateMs: median(timesLpToDonate),
      medianDonateToAmountMs: median(timesDonateToAmount),
      medianAmountToBccMs: median(timesAmountToBcc)
    },
    revenueBySource: [...revenueBySource.entries()]
      .map(([source, v]) => ({ source, revenue: v.revenue, count: v.count }))
      .sort((a, b) => b.revenue - a.revenue),
    topAmounts,
    utmBreakdown,
    deviceCounts,
    browserBreakdown,
    geoBreakdown,
    topPaths,
    sectionTimes,
    vslRetention,
    abTest,
    vitalsKpis,
    timeSeries,
    heatmap: heatFiltered,
    liveSessions: liveSorted,
    liveFeed,
    compare,
    capacity: {
      events: events.length,
      sessions: sessions.size,
      heat: heat.length
    }
  };
}

function deltaPct(now: number, prev: number): number {
  if (prev === 0) return now === 0 ? 0 : 1;
  return (now - prev) / prev;
}

export function getSessionDetail(sid: string) {
  const s = sessions.get(sid);
  if (!s) return null;
  const sEvents = events
    .filter((e) => e.sid === sid)
    .sort((a, b) => a.ts - b.ts)
    .map((e) => ({ ts: e.ts, ev: e.ev, path: e.path, data: e.data ?? null }));
  return { session: s, events: sEvents };
}
