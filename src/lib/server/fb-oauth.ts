import { env } from '$env/dynamic/private';

// App credentials — necessario env vars no Railway:
//   FB_APP_ID, FB_APP_SECRET
// E adicionar o redirect URI no painel do app FB:
//   https://belgianpawshelter.help/api/fb-ads/oauth/callback
export function getAppCreds() {
  const appId = env.FB_APP_ID;
  const appSecret = env.FB_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error('FB_APP_ID e FB_APP_SECRET nao configurados no Railway');
  }
  return { appId, appSecret };
}

export function getRedirectUri(origin?: string): string {
  // Permite override via env, senao usa o origin da request
  if (env.FB_OAUTH_REDIRECT_URI) return env.FB_OAUTH_REDIRECT_URI;
  if (origin) return `${origin}/api/fb-ads/oauth/callback`;
  return 'https://belgianpawshelter.help/api/fb-ads/oauth/callback';
}

// Permissoes que pedimos: ler ads + listar BMs + (opcional) gerenciar
export const OAUTH_SCOPES = [
  'ads_read',
  'business_management',
  'ads_management',
  'read_insights',
  'pages_read_engagement',
].join(',');

export function buildAuthorizeUrl(state: string, origin: string): string {
  const { appId } = getAppCreds();
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: getRedirectUri(origin),
    scope: OAUTH_SCOPES,
    response_type: 'code',
    state,
  });
  return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
}

interface TokenExchangeResult {
  access_token: string;
  expires_in?: number;       // segundos
  token_type?: string;
}

// Etapa 1: troca code -> short-lived user token (~1-2h)
export async function exchangeCodeForToken(code: string, origin: string): Promise<TokenExchangeResult> {
  const { appId, appSecret } = getAppCreds();
  const url = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
  url.searchParams.set('client_id', appId);
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('redirect_uri', getRedirectUri(origin));
  url.searchParams.set('code', code);

  const r = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err?.error?.message || `oauth/access_token ${r.status}`);
  }
  return r.json();
}

// Etapa 2: troca short-lived -> long-lived (60 dias). Tambem renova long-lived ja existente.
export async function extendToLongLived(shortToken: string): Promise<TokenExchangeResult> {
  const { appId, appSecret } = getAppCreds();
  const url = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
  url.searchParams.set('grant_type', 'fb_exchange_token');
  url.searchParams.set('client_id', appId);
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('fb_exchange_token', shortToken);

  const r = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err?.error?.message || `extend ${r.status}`);
  }
  return r.json();
}

// Inspeciona um token via debug_token (precisa de app access token)
export async function debugToken(token: string): Promise<{
  is_valid: boolean;
  expires_at: number;   // epoch seconds, 0 = never
  data_access_expires_at?: number;
  scopes?: string[];
  user_id?: string;
}> {
  const { appId, appSecret } = getAppCreds();
  const appAccessToken = `${appId}|${appSecret}`;
  const url = new URL('https://graph.facebook.com/v21.0/debug_token');
  url.searchParams.set('input_token', token);
  url.searchParams.set('access_token', appAccessToken);

  const r = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err?.error?.message || `debug_token ${r.status}`);
  }
  const body = await r.json();
  return body.data;
}

// Cria um CSRF state (16 bytes hex)
export function makeState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
