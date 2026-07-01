/**
 * GET  /api/admin/domain-status              → estado atual (cacheado, sem re-checar)
 * GET  /api/admin/domain-status?force=1      → força check imediato antes de retornar
 *
 * Autenticação: cookie dash_token (mesmo padrão do resto de /api/dashboard/*),
 * ou header x-admin-secret com SHOPIFY_WEBHOOK_SECRET.
 */

import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getDomainStatus, forceCheck, initDomainMonitor } from '$lib/server/domain-monitor';

initDomainMonitor();

function authed(request: Request, cookies: import('@sveltejs/kit').Cookies): boolean {
	// Admin secret (mesma header que /api/admin/remove-session)
	const headerSecret = request.headers.get('x-admin-secret');
	if (headerSecret && headerSecret === env.SHOPIFY_WEBHOOK_SECRET) return true;
	// Cookie do dashboard (setado após login vitrack)
	const expected = env.DASHBOARD_TOKEN;
	const cookie = cookies.get('dash_token');
	if (expected && cookie === expected) return true;
	// Se DASHBOARD_TOKEN não estiver setado, libera
	if (!expected) return true;
	return false;
}

export const GET: RequestHandler = async ({ url, request, cookies }) => {
	if (!authed(request, cookies)) {
		return json({ ok: false, error: 'unauthorized' }, { status: 401 });
	}
	const force = url.searchParams.get('force') === '1';
	const data = force ? await forceCheck() : getDomainStatus();
	return json(
		{ ok: true, checkedAt: Date.now(), domains: data },
		{ headers: { 'cache-control': 'no-store' } }
	);
};
