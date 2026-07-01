// Client-side analytics: batching + sendBeacon + helpers (vitals, sections, clicks, vsl, scroll).

const SID_KEY = 'bp_sid';
const HEARTBEAT_MS = 15_000;
const FLUSH_MS = 3_000;
const BATCH_MAX = 30;

let sidCache: string | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let flushTimer: ReturnType<typeof setInterval> | null = null;
let queue: any[] = [];

let scrollMilestones = new Set<number>();
let lastPath = '';
let lastScrollY = 0;
let scrollBacks = 0;

let lastClickTarget: Element | null = null;
let lastClickTime = 0;
let lastClickCount = 0;
let intersectionObs: IntersectionObserver | null = null;
const sectionEnter: Record<string, number> = {};

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

function captureFbclid(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const params = new URLSearchParams(window.location.search);
    const fbclid = params.get('fbclid');
    if (fbclid) {
      try { sessionStorage.setItem('bp_fbclid', fbclid); } catch {}
      return fbclid;
    }
    try {
      const saved = sessionStorage.getItem('bp_fbclid');
      if (saved) return saved;
    } catch {}
  } catch {}
  return undefined;
}

// Rotas/hosts que NÃO devem trackear (dashboard interno + login) — evita poluir
// a própria dashboard com eventos do usuário navegando nela.
function isVitrackRoute(): boolean {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname;
  const host = window.location.hostname;
  if (path.startsWith('/dashboard') || path === '/login') return true;
  if (host === 'vitrack.online' || host === 'www.vitrack.online') return true;
  return false;
}

export function track(ev: string, data?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  if (isVitrackRoute()) return;
  queue.push({
    ev,
    sid: getSid(),
    path: window.location.pathname,
    ref: document.referrer || undefined,
    utm: captureUtm(),
    fbclid: captureFbclid(),
    ts: Date.now(),
    data
  });
  if (queue.length >= BATCH_MAX) flush();
}

function flush(useBeacon = false) {
  if (typeof window === 'undefined') return;
  if (!queue.length) return;
  const events = queue.splice(0, queue.length);
  const body = JSON.stringify({ events });
  try {
    if (useBeacon && navigator.sendBeacon) {
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
  if (path === lastPath) return;
  lastPath = path;
  scrollMilestones = new Set();
  lastScrollY = 0;
  scrollBacks = 0;
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
    const y = window.scrollY;
    const scrolled = y + window.innerHeight;
    const total = document.documentElement.scrollHeight;
    if (total > 0) {
      const pct = Math.min(100, Math.round((scrolled / total) * 100));
      for (const m of [25, 50, 75, 100]) {
        if (pct >= m && !scrollMilestones.has(m)) {
          scrollMilestones.add(m);
          track('scroll_depth', { pct: m });
        }
      }
    }
    // Detecta scroll-and-back (rolou pra baixo, voltou rapido)
    if (lastScrollY > 0 && y < lastScrollY - 200 && y < 400) {
      scrollBacks++;
      track('scroll_back', { from: lastScrollY, to: y });
    }
    lastScrollY = y;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
}

// ─── Web Vitals ───

export function attachVitals() {
  if (typeof window === 'undefined') return;
  const reported: VitalsData = {};
  function send() { track('web_vital', reported as any); }

  // LCP
  try {
    const lcpObs = new PerformanceObserver((list) => {
      const entries = list.getEntries() as any[];
      const last = entries[entries.length - 1];
      if (last) reported.lcp = Math.round(last.renderTime || last.loadTime || last.startTime);
    });
    lcpObs.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {}

  // CLS
  let clsValue = 0;
  try {
    const clsObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as any[]) {
        if (!entry.hadRecentInput) clsValue += entry.value;
      }
      reported.cls = +clsValue.toFixed(3);
    });
    clsObs.observe({ type: 'layout-shift', buffered: true });
  } catch {}

  // INP (simplificado: max event duration)
  let maxInp = 0;
  try {
    const inpObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as any[]) {
        if (entry.duration > maxInp) maxInp = entry.duration;
      }
      reported.inp = Math.round(maxInp);
    });
    inpObs.observe({ type: 'event', buffered: true, durationThreshold: 16 } as any);
  } catch {}

  // TTFB / FCP
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (nav) reported.ttfb = Math.round(nav.responseStart);
  } catch {}
  try {
    const fcp = performance.getEntriesByName('first-contentful-paint')[0];
    if (fcp) reported.fcp = Math.round(fcp.startTime);
  } catch {}

  // Reporta na visibilitychange (hidden) + apos 8s
  setTimeout(send, 8_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') send();
  });

  // Erros JS
  window.addEventListener('error', (ev) => {
    track('js_error', {
      msg: String(ev.message).slice(0, 200),
      src: String(ev.filename || '').slice(0, 200),
      ln: ev.lineno
    });
  });
  window.addEventListener('unhandledrejection', (ev) => {
    track('js_error', { msg: String((ev as any).reason).slice(0, 200), kind: 'unhandled_promise' });
  });
}

interface VitalsData { lcp?: number; inp?: number; cls?: number; ttfb?: number; fcp?: number; }

// ─── Section tracking via IntersectionObserver ───

export function attachSectionTracking() {
  if (typeof window === 'undefined') return;
  if (intersectionObs) intersectionObs.disconnect();

  // Reseta tempos quando muda de pagina
  for (const k of Object.keys(sectionEnter)) delete sectionEnter[k];

  intersectionObs = new IntersectionObserver(
    (entries) => {
      const now = Date.now();
      for (const entry of entries) {
        const el = entry.target as HTMLElement;
        const name = el.dataset.section || el.id || el.tagName.toLowerCase();
        if (entry.isIntersecting) {
          sectionEnter[name] = now;
        } else if (sectionEnter[name]) {
          const ms = now - sectionEnter[name];
          delete sectionEnter[name];
          if (ms > 200) track('section_view', { section: name, ms });
        }
      }
    },
    { threshold: 0.5 }
  );

  // Observa todos os elementos com data-section ou role=region
  requestAnimationFrame(() => {
    document.querySelectorAll('[data-section]').forEach((el) => intersectionObs!.observe(el));
  });
}

// Flush tempos de secao ainda abertos (chamar antes de pagehide)
function flushOpenSections() {
  const now = Date.now();
  for (const [name, start] of Object.entries(sectionEnter)) {
    const ms = now - start;
    if (ms > 200) track('section_view', { section: name, ms });
    delete sectionEnter[name];
  }
}

// ─── Click heatmap + rage + dead ───

export function attachClickTracking() {
  if (typeof window === 'undefined') return;
  window.addEventListener('click', (e) => {
    const target = e.target as Element | null;
    if (!target) return;
    // Coord normalizado pelo viewport
    const x = Math.round((e.clientX / window.innerWidth) * 1000) / 10; // 0-100 com 1 decimal
    const y = Math.round((e.clientY / window.innerHeight) * 1000) / 10;
    track('click_heatmap', { x, y, tag: target.tagName, id: target.id || undefined });

    // Rage detect (3 cliques no mesmo target em 1s)
    const now = Date.now();
    if (target === lastClickTarget && now - lastClickTime < 1000) {
      lastClickCount++;
      if (lastClickCount === 3) track('rage_click', { tag: target.tagName, id: target.id });
    } else {
      lastClickCount = 1;
    }
    lastClickTarget = target;
    lastClickTime = now;

    // Dead click: clicou em elemento que nao tem onclick/listener visivel (heuristica simples)
    const isInteractive =
      target.tagName === 'A' ||
      target.tagName === 'BUTTON' ||
      target.tagName === 'INPUT' ||
      target.tagName === 'SELECT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'LABEL' ||
      (target as HTMLElement).getAttribute('role') === 'button' ||
      Boolean((target as HTMLElement).onclick) ||
      target.closest('a, button, [role="button"]');
    if (!isInteractive) {
      // dispara dead-click somente se passar 1.5s e nada acontecer no DOM/URL
      const urlBefore = window.location.href;
      const targetSnap = target;
      setTimeout(() => {
        if (window.location.href === urlBefore) {
          track('dead_click', { tag: targetSnap.tagName });
        }
      }, 1500);
    }
  }, { passive: true });

  // Bot signal: mouse_move (apenas 1 sinal — o servidor usa pra heuristica)
  let movedOnce = false;
  window.addEventListener('mousemove', () => {
    if (movedOnce) return;
    movedOnce = true;
    track('click_heatmap', { x: -1, y: -1, mm: 1 }); // marcador, server le como sinal de mouse
  }, { passive: true });
}

// ─── VSL tracking ───

export function attachVslTracking(video: HTMLVideoElement | null) {
  if (!video) return;
  let started = false;
  let soundReported = false;
  let lastTime = 0;
  let rewatchReported = false;
  const quartilesSeen = new Set<number>();

  video.addEventListener('play', () => {
    if (!started) started = true;
    else if (!rewatchReported && video.currentTime < 1) {
      rewatchReported = true;
      track('vsl_rewatch');
    }
  });

  video.addEventListener('volumechange', () => {
    if (!video.muted && video.volume > 0 && !soundReported) {
      soundReported = true;
      track('vsl_play_with_sound');
    }
  });

  video.addEventListener('timeupdate', () => {
    const dur = video.duration;
    if (!dur || !isFinite(dur)) return;
    const pct = (video.currentTime / dur) * 100;
    for (const q of [25, 50, 75, 100]) {
      if (pct >= q && !quartilesSeen.has(q)) {
        quartilesSeen.add(q);
        track('vsl_quartile', { q });
      }
    }
    // Detecta rewatch (saltou pra antes)
    if (video.currentTime < lastTime - 5) {
      // skip rewind in middle (nao conta)
    }
    lastTime = video.currentTime;
  });

  video.addEventListener('ended', () => {
    track('vsl_complete');
  });
}

// ─── Inicializacao geral ───

let inited = false;
export function initAnalytics() {
  if (inited || typeof window === 'undefined') return;
  if (window.location.pathname.startsWith('/dashboard')) return;
  inited = true;
  trackPageview();
  startHeartbeat();
  attachScrollDepth();
  attachVitals();
  attachSectionTracking();
  attachClickTracking();
  // Flush periodico
  flushTimer = setInterval(() => flush(false), FLUSH_MS);
  // Flush no unload
  window.addEventListener('pagehide', () => {
    flushOpenSections();
    flush(true);
  });
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushOpenSections();
      flush(true);
    }
  });
}

export function reattachSectionsOnNavigate() {
  if (typeof window === 'undefined') return;
  // Re-anexa observer porque DOM mudou
  attachSectionTracking();
}
