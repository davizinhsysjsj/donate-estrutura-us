// Client-side analytics helper.
// Usa sendBeacon quando possivel (nao bloqueia navegacao).

const SID_KEY = 'bp_sid';
const HEARTBEAT_MS = 15_000;

let sidCache: string | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let scrollMilestones = new Set<number>();
let lastPath = '';

export function getSid(): string {
  if (typeof window === 'undefined') return '';
  if (sidCache) return sidCache;
  try {
    let sid = localStorage.getItem(SID_KEY);
    if (!sid) {
      sid = uuid();
      localStorage.setItem(SID_KEY, sid);
    }
    sidCache = sid;
    return sid;
  } catch {
    return uuid();
  }
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) {
    return (crypto as any).randomUUID();
  }
  return 'x-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
}

function captureUtm(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const out: Record<string, string> = {};
  try {
    const params = new URLSearchParams(window.location.search);
    for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
      const v = params.get(k);
      if (v) {
        out[k] = v;
        try { sessionStorage.setItem('bp_' + k, v); } catch {}
      } else {
        try {
          const saved = sessionStorage.getItem('bp_' + k);
          if (saved) out[k] = saved;
        } catch {}
      }
    }
  } catch {}
  return out;
}

export function track(ev: string, data?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  const body = JSON.stringify({
    ev,
    sid: getSid(),
    path: window.location.pathname,
    ref: document.referrer || undefined,
    utm: captureUtm(),
    data
  });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }));
      return;
    }
  } catch {}
  fetch('/api/track', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    keepalive: true
  }).catch(() => {});
}

export function trackPageview() {
  if (typeof window === 'undefined') return;
  const path = window.location.pathname;
  if (path === lastPath) return; // dedup
  lastPath = path;
  scrollMilestones = new Set(); // reset por pagina
  track('pageview');
}

export function startHeartbeat() {
  if (typeof window === 'undefined') return;
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    if (document.visibilityState === 'visible') track('heartbeat');
  }, HEARTBEAT_MS);
}

export function stopHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

export function attachScrollDepth() {
  if (typeof window === 'undefined') return;
  const onScroll = () => {
    const scrolled = window.scrollY + window.innerHeight;
    const total = document.documentElement.scrollHeight;
    if (total <= 0) return;
    const pct = Math.min(100, Math.round((scrolled / total) * 100));
    for (const m of [25, 50, 75, 100]) {
      if (pct >= m && !scrollMilestones.has(m)) {
        scrollMilestones.add(m);
        track('scroll_depth', { pct: m });
      }
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
}
