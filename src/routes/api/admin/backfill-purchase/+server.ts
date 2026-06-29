import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { ingest as ingestAnalytics, initStore as initAnalyticsStore } from '$lib/server/analytics';

initAnalyticsStore();

/**
 * Backfill manual de purchase no Vitrack.
 *
 * Uso (autenticado via SHOPIFY_WEBHOOK_SECRET no header):
 *
 *   curl -X POST https://belgianpawsfoundation.org/api/admin/backfill-purchase \
 *     -H "x-admin-secret: <SHOPIFY_WEBHOOK_SECRET>" \
 *     -H "content-type: application/json" \
 *     -d '{"orderId":"1075","amount":15,"currency":"EUR","ts":"2026-06-01T18:00:00Z","utm_source":"email","utm_medium":"recompra"}'
 *
 * Cria sessao sintetica `shopify_<orderId>` e registra purchase.
 * Se ja existe purchase nessa sid, vai atualizar (mesmo orderId nao duplica).
 */
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

	const orderId = body.orderId ?? body.order_id;
	const amount = Number(body.amount);
	const currency = String(body.currency || 'EUR');

	if (!orderId) throw error(400, 'missing orderId');
	if (!Number.isFinite(amount) || amount <= 0) throw error(400, 'invalid amount');

	const ts = body.ts ? new Date(body.ts).getTime() : Date.now();
	if (!Number.isFinite(ts)) throw error(400, 'invalid ts');

	const sid = `shopify_${orderId}`;
	const ua = body.ua || '';
	const device = (body.device as 'mobile' | 'desktop' | 'tablet') || 'desktop';

	ingestAnalytics({
		ts,
		sid,
		ev: 'purchase',
		path: '/checkout/success',
		ua,
		device,
		utm_source: body.utm_source,
		utm_medium: body.utm_medium,
		utm_campaign: body.utm_campaign,
		utm_content: body.utm_content,
		utm_term: body.utm_term,
		data: {
			amount,
			currency,
			order_id: orderId,
			backfilled: true
		}
	});

	console.log('[backfill-purchase] ingested', { orderId, sid, amount, currency, ts });

	return json({ ok: true, sid, orderId, amount, currency, ts });
};
