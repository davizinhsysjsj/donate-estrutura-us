import { env } from '$env/dynamic/private';
import fs from 'node:fs';
import path from 'node:path';

// Caminho no volume persistente do Railway (sobrevive deploys)
const TOKEN_PATH = '/data/fb-token.json';
// Fallback local (dev) caso /data nao exista
const FALLBACK_PATH = '.data/fb-token.json';

interface StoredToken {
  token: string;
  defaultAccount?: string;
  updatedAt: number;
  // Epoch ms quando o token expira. null = "longa duracao desconhecida" (system user).
  expiresAt?: number | null;
  // Tipo: 'oauth' = veio do flow OAuth, 'manual' = colado no painel, 'system' = system user
  kind?: 'oauth' | 'manual' | 'system';
}

function resolvePath(): string {
  // Prefere /data se o diretorio existir (Railway). Senao usa .data local.
  try {
    if (fs.existsSync('/data')) return TOKEN_PATH;
  } catch {}
  return FALLBACK_PATH;
}

let _cached: StoredToken | null | undefined; // undefined = nao lido ainda

function readFromDisk(): StoredToken | null {
  if (_cached !== undefined) return _cached;
  try {
    const p = resolvePath();
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf8');
      const parsed = JSON.parse(raw) as StoredToken;
      if (parsed.token && typeof parsed.token === 'string') {
        _cached = parsed;
        return parsed;
      }
    }
  } catch (e) {
    console.error('[fb-token] read error:', e);
  }
  _cached = null;
  return null;
}

export function saveToken(
  token: string,
  opts: { defaultAccount?: string; expiresAt?: number | null; kind?: StoredToken['kind'] } = {}
): void {
  const p = resolvePath();
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const prev = readFromDisk();
    const data: StoredToken = {
      token,
      defaultAccount: opts.defaultAccount ?? prev?.defaultAccount,
      updatedAt: Date.now(),
      expiresAt: opts.expiresAt ?? null,
      kind: opts.kind ?? prev?.kind ?? 'manual',
    };
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
    _cached = data;
  } catch (e) {
    console.error('[fb-token] save error:', e);
    throw e;
  }
}

// Retorna info do token armazenado (sem expor o token em si)
export function getStoredTokenInfo(): { expiresAt: number | null; kind: string | null; updatedAt: number | null } {
  const stored = readFromDisk();
  return {
    expiresAt: stored?.expiresAt ?? null,
    kind: stored?.kind ?? null,
    updatedAt: stored?.updatedAt ?? null,
  };
}

export function clearToken(): void {
  const p = resolvePath();
  try {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch {}
  _cached = null;
}

// Token efetivo: disco > env > hardcoded fallback
const HARDCODED = 'EAASpkEKZBxb8BRkZAvHccwFXjbEUJcgkb7qzwZBfx6t6qkNJMMPrIitCI3YQATc9iiqZCo6OrrYkGhFdrULwg0z1aBBWoFMhHJx0TzC8T9T01nRKmAtZA0PJyn3fgNZBhuQ1Mg8J1KA1XeDPMJIZC41J8CMREjCiAWnyOqHyQI1qQ9vqeIdftvZBsHY9jcRn7wZDZD';

export function getFbToken(): string {
  const stored = readFromDisk();
  if (stored?.token) return stored.token;
  return env.FB_ADS_TOKEN || HARDCODED;
}

export function getDefaultAccountId(): string {
  const stored = readFromDisk();
  if (stored?.defaultAccount) return stored.defaultAccount;
  return env.FB_ADS_ACCOUNT_ID || 'act_1451507589956064';
}

export function getTokenStatus() {
  const stored = readFromDisk();
  const effective = getFbToken();
  const expiresAt = stored?.expiresAt ?? null;
  const now = Date.now();
  const daysLeft = expiresAt ? Math.floor((expiresAt - now) / 86_400_000) : null;
  return {
    source: stored?.token ? 'disk' : (env.FB_ADS_TOKEN ? 'env' : 'hardcoded'),
    masked: effective ? effective.slice(0, 6) + '…' + effective.slice(-6) : '',
    length: effective.length,
    updatedAt: stored?.updatedAt || null,
    defaultAccount: getDefaultAccountId(),
    expiresAt,
    daysLeft,
    kind: stored?.kind ?? null,
    needsRefresh: expiresAt ? daysLeft! < 7 : false,
  };
}

// Reset cache (util pra testes)
export function _resetCache() { _cached = undefined; }

// ── AUTO-REFRESH em background ────────────────────────────────────────
// Dispara renovacao do long-lived se faltar < 7 dias pro vencimento.
// Roda no maximo 1x por hora (evita flood) e nao bloqueia a request.
let _lastRefreshAttempt = 0;
const REFRESH_COOLDOWN = 60 * 60 * 1000;  // 1h
const REFRESH_THRESHOLD = 7 * 86_400_000; // 7 dias

export function maybeRefreshInBackground(): void {
  const stored = readFromDisk();
  if (!stored?.token || !stored.expiresAt) return;
  if (stored.kind === 'system') return;  // System User nao expira

  const now = Date.now();
  if (stored.expiresAt - now > REFRESH_THRESHOLD) return;
  if (now - _lastRefreshAttempt < REFRESH_COOLDOWN) return;
  _lastRefreshAttempt = now;

  // Fire-and-forget — nao espera a resposta
  (async () => {
    try {
      // Import lazy pra evitar ciclo (fb-oauth importa env)
      const { extendToLongLived, debugToken } = await import('./fb-oauth.js');
      const extended = await extendToLongLived(stored.token);
      const info = await debugToken(extended.access_token);
      const expiresAt = info.expires_at && info.expires_at > 0
        ? info.expires_at * 1000
        : (extended.expires_in ? Date.now() + extended.expires_in * 1000 : null);
      saveToken(extended.access_token, { expiresAt, kind: 'oauth' });
      console.log('[fb-token] auto-refresh OK, novo expiresAt=' + new Date(expiresAt!).toISOString());
    } catch (e) {
      console.error('[fb-token] auto-refresh falhou:', e);
    }
  })();
}
