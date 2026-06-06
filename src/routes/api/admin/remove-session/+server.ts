import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { removeSession, initStore as initAnalyticsStore } from '$lib/server/analytics';

initAnalyticsStore();

export const POST: RequestHandler = async ({ request }) => {
	const ADMIN_SECRET = env.SHOPIFY_WEBHOOK_SECRET;
	if (!ADMIN_SECRET) throw error(500, 'misconfigured');

	const headerSecret = request.headers.get('x-admin-secret');
	if (headerSecret !== ADMIN_SECRET) throw error(401, 'unauthorized');

	let body: any;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'invalid json');
	}

	const sid = String(body.sid || '').trim();
	if (!sid) throw error(400, 'missing sid');

	const result = removeSession(sid);
	console.log('[remove-session]', { sid, ...result });

	return json({ ok: true, sid, ...result });
};
