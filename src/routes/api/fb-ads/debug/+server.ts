import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { getFbToken, getTokenStatus } from '$lib/server/fb-token';

function isAuthed(cookies: any): boolean {
  const expected = env.DASHBOARD_TOKEN;
  if (!expected) return true;
  return cookies.get('dash_token') === expected;
}

async function probe(path: string, token: string) {
  try {
    const r = await fetch(
      `https://graph.facebook.com/v21.0/${path}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}`,
      { signal: AbortSignal.timeout(10_000) }
    );
    const body = await r.json();
    if (!r.ok || body.error) {
      return { ok: false, error: body?.error?.message || `HTTP ${r.status}`, fbCode: body?.error?.code };
    }
    return { ok: true, body };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'network error' };
  }
}

export const GET: RequestHandler = async ({ cookies }) => {
  if (!isAuthed(cookies)) return json({ error: 'unauthorized' }, { status: 401 });

  const token = getFbToken();
  const status = getTokenStatus();

  // 1) /me — quem é o usuário/system user
  const me = await probe('me?fields=id,name,email', token);

  // 2) /me/permissions — quais permissions o token tem
  const perms = await probe('me/permissions', token);
  const grantedPerms = perms.ok
    ? (perms.body.data || []).filter((p: any) => p.status === 'granted').map((p: any) => p.permission)
    : [];

  // 3) /me/businesses — todos os BMs
  const businesses = await probe('me/businesses?fields=id,name,verification_status&limit=100', token);
  const businessList = businesses.ok ? (businesses.body.data || []) : [];

  // 4) /me/adaccounts — contas diretas
  const accounts = await probe('me/adaccounts?fields=id,name,account_status&limit=200', token);
  const accountList = accounts.ok ? (accounts.body.data || []) : [];

  // 5) Por cada BM: contagem de owned + client accounts
  const bmStats = await Promise.all(
    businessList.slice(0, 20).map(async (b: any) => {
      const [owned, client] = await Promise.all([
        probe(`${b.id}/owned_ad_accounts?fields=id&limit=200`, token),
        probe(`${b.id}/client_ad_accounts?fields=id&limit=200`, token),
      ]);
      return {
        id: b.id,
        name: b.name,
        ownedCount: owned.ok ? (owned.body.data?.length || 0) : 0,
        clientCount: client.ok ? (client.body.data?.length || 0) : 0,
        ownedError: owned.ok ? null : owned.error,
        clientError: client.ok ? null : client.error,
      };
    })
  );

  // Checklist: o token consegue ver tudo?
  const requiredPerms = ['ads_read', 'business_management'];
  const missingPerms = requiredPerms.filter((p) => !grantedPerms.includes(p));

  const diagnosis: string[] = [];
  if (!me.ok) {
    diagnosis.push('❌ Token inválido ou expirado — não consegue chamar /me');
  } else {
    diagnosis.push(`✅ Token autenticado como: ${me.body.name || me.body.id}`);
  }
  if (missingPerms.length) {
    diagnosis.push(`⚠️ Faltam permissões: ${missingPerms.join(', ')} — sem isso, /me/businesses retorna vazio`);
  } else if (grantedPerms.length) {
    diagnosis.push(`✅ Permissões OK: ${grantedPerms.join(', ')}`);
  }
  if (businesses.ok && businessList.length === 0) {
    diagnosis.push('⚠️ /me/businesses retornou 0 — token é System User OU usuário não é admin de nenhum BM');
  } else if (businessList.length > 0) {
    diagnosis.push(`✅ ${businessList.length} BM(s) acessível(eis)`);
  }
  if (!businesses.ok) {
    diagnosis.push(`❌ /me/businesses falhou: ${businesses.error}`);
  }

  return json({
    tokenStatus: status,
    me: me.ok ? me.body : { error: me.error },
    permissions: {
      granted: grantedPerms,
      missing: missingPerms,
      all: perms.ok ? perms.body.data : [],
    },
    businesses: {
      count: businessList.length,
      list: businessList,
      error: businesses.ok ? null : businesses.error,
    },
    adAccountsDirect: {
      count: accountList.length,
      error: accounts.ok ? null : accounts.error,
    },
    businessAccounts: bmStats,
    diagnosis,
  });
};
