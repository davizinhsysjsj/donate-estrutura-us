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

export function saveToken(token: string, defaultAccount?: string): void {
  const p = resolvePath();
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const data: StoredToken = { token, defaultAccount, updatedAt: Date.now() };
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
    _cached = data;
  } catch (e) {
    console.error('[fb-token] save error:', e);
    throw e;
  }
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
  return {
    source: stored?.token ? 'disk' : (env.FB_ADS_TOKEN ? 'env' : 'hardcoded'),
    masked: effective ? effective.slice(0, 6) + '…' + effective.slice(-6) : '',
    length: effective.length,
    updatedAt: stored?.updatedAt || null,
    defaultAccount: getDefaultAccountId(),
  };
}

// Reset cache (util pra testes)
export function _resetCache() { _cached = undefined; }
