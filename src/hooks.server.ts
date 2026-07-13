import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';
import { lookupGeo } from '$lib/server/geo';
import { env } from '$env/dynamic/private';
import { building } from '$app/environment';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { initDomainMonitor } from '$lib/server/domain-monitor';

if (!building) {
  initDomainMonitor();
}

export const API_ONLY_HOSTS = new Set<string>(['api.belgiancarestore.com']);

// ── Vitrack mode ──────────────────────────────────────────────────────────
// Quando VITRACK_MODE=true (env do projeto Railway "vitrack"), o serviço só
// expõe /dashboard e /login. Tudo mais redireciona pra /dashboard.
// Acesso ao /dashboard exige cookie de auth válido (48h).
// Hosts que ativam vitrack mode automaticamente (o mesmo service serve LP + vitrack)
const VITRACK_HOSTS = new Set<string>(['vitrack.online', 'www.vitrack.online']);
const VITRACK_MODE_ENV = env.VITRACK_MODE === 'true';
const VITRACK_PASSWORD = env.VITRACK_PASSWORD || 'davizkx';
const VITRACK_AUTH_COOKIE = 'vitrack_auth';
const VITRACK_AUTH_TTL_SEC = 48 * 60 * 60; // 48h

function vitrackSign(ts: string): string {
  return createHmac('sha256', VITRACK_PASSWORD).update(ts).digest('hex');
}

export function vitrackMakeCookie(): string {
  const ts = String(Math.floor(Date.now() / 1000));
  return `${ts}.${vitrackSign(ts)}`;
}

function vitrackIsValid(cookie: string | undefined): boolean {
  if (!cookie) return false;
  const [ts, sig] = cookie.split('.');
  if (!ts || !sig) return false;
  const expected = vitrackSign(ts);
  try {
    if (sig.length !== expected.length) return false;
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  } catch { return false; }
  const age = Math.floor(Date.now() / 1000) - Number(ts);
  return age >= 0 && age < VITRACK_AUTH_TTL_SEC;
}

// ── Proteção Brasil ────────────────────────────────────────────────────────
// Rotas do funil protegidas contra visitas do Brasil
// Nota: /bedankt é prerendered (sem request real), não pode ser bloqueado aqui
const PROTECTED_PATHS = new Set(['/', '/vsl', '/donate', '/over', '/wacht', '/supporter', '/updates']);

// IPs sempre permitidos — configurar via Railway env: BRAZIL_BYPASS_IPS=IP1,IP2
// O IP do dono está hardcoded abaixo como fallback seguro
const OWNER_BYPASS_IPS = new Set(['177.38.28.44', '177.38.27.53', '177.38.29.45', '177.38.27.54']);

function getBypassIPs(): Set<string> {
  const raw = env.BRAZIL_BYPASS_IPS || '';
  const fromEnv = raw.split(',').map(s => s.trim()).filter(Boolean);
  return new Set([...OWNER_BYPASS_IPS, ...fromEnv]);
}

function getClientIP(event: Parameters<Handle>[0]['event']): string {
  try {
    // x-forwarded-for: "IP1, IP2, ..." — primeiro é o cliente real
    const fwd = event.request.headers.get('x-forwarded-for');
    if (fwd) return fwd.split(',')[0].trim();
    return event.getClientAddress() ?? '';
  } catch {
    // getClientAddress() lança durante prerender — retorna vazio (vai cair no isLocal)
    return '';
  }
}

function isProtected(pathname: string): boolean {
  const clean = pathname.replace(/\/$/, '') || '/';
  return PROTECTED_PATHS.has(clean);
}
// ──────────────────────────────────────────────────────────────────────────

// ── First-party tracking cookies ──────────────────────────────────────────
// _fbp: id do navegador no formato Meta. Hoje so eh setado se o Pixel JS rodar
// (adblock/Brave/iOS bloqueia → CAPI fica sem fbp → match quality despenca).
// Setar aqui no servidor garante que sempre exista, dura mais (90d) e nao
// depende do cliente. O Pixel JS, quando rodar, le esse mesmo cookie e usa.
//
// bp_eid: external_id estavel 1st-party (2 anos). Usado como `external_id` no
// CAPI quando email nao esta disponivel — melhora atribuicao cross-device.
function ensureFirstPartyCookies(event: Parameters<Handle>[0]['event']) {
  const path = event.url.pathname;
  // So aplica em rotas de pagina (nao em APIs/assets) — evita re-Set-Cookie spam
  if (path.startsWith('/api/') || path.startsWith('/_app/') || path.includes('.')) return;

  if (!event.cookies.get('_fbp')) {
    const rand = Math.floor(1_000_000_000 + Math.random() * 9_000_000_000);
    const fbp = `fb.1.${Date.now()}.${rand}`;
    event.cookies.set('_fbp', fbp, {
      path: '/',
      maxAge: 60 * 60 * 24 * 90,
      sameSite: 'lax',
      httpOnly: false,
      secure: true
    });
  }
  if (!event.cookies.get('bp_eid')) {
    const eid = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36));
    event.cookies.set('bp_eid', eid, {
      path: '/',
      maxAge: 60 * 60 * 24 * 730,
      sameSite: 'lax',
      httpOnly: false,
      secure: true
    });
  }
}
// ──────────────────────────────────────────────────────────────────────────

export const handle: Handle = async ({ event, resolve }) => {
  // x-forwarded-host tem prioridade — o Cloudflare Worker reescreve Host pra o
  // domínio interno do Railway ao proxear, mas seta x-forwarded-host com o
  // original (vitrack.online). Sem isso, VITRACK_MODE nunca ativa via hostname.
  const forwardedHost = event.request.headers.get('x-forwarded-host');
  const host = (
    forwardedHost ?? event.request.headers.get('host') ?? event.url.hostname
  ).toLowerCase();
  const path = event.url.pathname;

  // ── Alias /vitrack → /dashboard (enquanto vitrack.online está morto) ──
  if (path === '/vitrack' || path === '/vitrack/') {
    throw redirect(302, '/dashboard');
  }
  if (path === '/vitrack/login') {
    throw redirect(302, '/login');
  }
  if (path.startsWith('/vitrack/')) {
    throw redirect(302, '/dashboard' + path.slice('/vitrack'.length));
  }

  // ── /dashboard sempre exige auth (em qualquer host) ──
  // Antes ficava só protegido em VITRACK_HOSTS; agora também em
  // belgianpawsfoundation.org/dashboard (alcançável via /vitrack).
  if (!building && path.startsWith('/dashboard')) {
    if (!vitrackIsValid(event.cookies.get(VITRACK_AUTH_COOKIE))) {
      let nextPath = path;
      try { nextPath += event.url.search; } catch { /* prerender */ }
      throw redirect(302, `/login?next=${encodeURIComponent(nextPath)}`);
    }
  }

  // ── Vitrack: só /dashboard + /login + assets, com auth ──
  // Ativa se env VITRACK_MODE=true OU se o hostname é vitrack.online
  // (mesmo service donate-belgica agora serve os dois modos, decidindo por host)
  const isVitrackMode = VITRACK_MODE_ENV || VITRACK_HOSTS.has(host);
  if (isVitrackMode && !building) {
    const isAsset =
      path.startsWith('/_app/') ||
      path.startsWith('/api/') ||
      path === '/favicon.ico' ||
      path.includes('.');
    const isLogin = path === '/login';
    const isDashboard = path.startsWith('/dashboard');

    if (!isAsset && !isLogin && !isDashboard) {
      throw redirect(302, '/dashboard');
    }

    if (isDashboard && !vitrackIsValid(event.cookies.get(VITRACK_AUTH_COOKIE))) {
      // url.search lança em prerender; cai pro pathname sozinho nesse caso
      let nextPath = path;
      try { nextPath += event.url.search; } catch { /* prerender */ }
      const next = encodeURIComponent(nextPath);
      throw redirect(302, `/login?next=${next}`);
    }

    return resolve(event);
  }

  // Restrição de host (lógica original)
  if (API_ONLY_HOSTS.has(host) && !path.startsWith('/api/') && path !== '/bedankt') {
    return new Response('Not Found', { status: 404 });
  }

  ensureFirstPartyCookies(event);

  // ── Bloqueio Brasil ──
  // Nunca interfere em: APIs, dashboard, página de bloqueio, assets
  const skipBlock =
    path.startsWith('/api/') ||
    path.startsWith('/dashboard') ||
    path.startsWith('/bloqueado') ||
    path.startsWith('/_app/') ||
    path.includes('.');

  if (!skipBlock && isProtected(path)) {
    const ip = getClientIP(event);

    // Desenvolvimento local → passa sempre
    const isLocal = !ip || ip === '127.0.0.1' || ip === '::1' ||
      ip.startsWith('192.168.') || ip.startsWith('10.');

    if (!isLocal) {
      // Whitelist → passa sem lookup
      if (!getBypassIPs().has(ip)) {
        // Lookup com cache 24h (mesma função do analytics — zero custo para IPs já conhecidos)
        const geo = await lookupGeo(ip);
        if (geo.countryCode === 'BR') {
          throw redirect(302, '/bloqueado');
        }
      }
    }
  }

  return resolve(event);
};
