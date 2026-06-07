import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import crypto from 'node:crypto';
import { env } from '$env/dynamic/private';
import { ingest as ingestAnalytics, parseDevice, initStore as initAnalyticsStore } from '$lib/server/analytics';
import { scheduleEmailFlow, initEmailScheduler, cancelPendingRecoveryForEmail } from '$lib/server/email-scheduler';
import { addRealDonor } from '$lib/server/donors-feed';
import { recordPurchase } from '$lib/server/campaign-stats';

initAnalyticsStore();
initEmailScheduler();

const META_CAPI_VERSION = 'v21.0';

function timingSafeEq(a: string, b: string): boolean {
	const ab = Buffer.from(a, 'utf8');
	const bb = Buffer.from(b, 'utf8');
	if (ab.length !== bb.length) return false;
	return crypto.timingSafeEqual(ab, bb);
}

function sha256Lower(value: string | undefined | null): string | undefined {
	if (!value) return undefined;
	return crypto.createHash('sha256').update(String(value).trim().toLowerCase()).digest('hex');
}

function readNoteAttr(
	attrs: Array<{ name: string; value: string }> | undefined,
	name: string
): string | undefined {
	if (!attrs) return undefined;
	const found = attrs.find((a) => a.name === name);
	return found?.value;
}

export const POST: RequestHandler = async ({ request }) => {
	const PIXEL_ID = env.META_PIXEL_ID;
	const ACCESS_TOKEN = env.META_CAPI_TOKEN;
	const SHOPIFY_SECRET = env.SHOPIFY_WEBHOOK_SECRET;

	if (!PIXEL_ID || !ACCESS_TOKEN || !SHOPIFY_SECRET) {
		console.error('[shopify-purchase] missing env vars');
		throw error(500, 'misconfigured');
	}

	const hmacHeader = request.headers.get('x-shopify-hmac-sha256');
	if (!hmacHeader) throw error(401, 'missing hmac');

	const rawBody = await request.text();
	const expectedHmac = crypto
		.createHmac('sha256', SHOPIFY_SECRET)
		.update(rawBody, 'utf8')
		.digest('base64');
	if (!timingSafeEq(hmacHeader, expectedHmac)) {
		console.error('[shopify-purchase] hmac mismatch');
		throw error(401, 'invalid hmac');
	}

	let order: any;
	try {
		order = JSON.parse(rawBody);
	} catch {
		throw error(400, 'invalid json');
	}

	const orderId: string | number = order.id;
	const noteAttrs = order.note_attributes as
		| Array<{ name: string; value: string }>
		| undefined;

	const fbclid = readNoteAttr(noteAttrs, 'fbclid');
	const fbp = readNoteAttr(noteAttrs, 'fbp');
	const eventIdAttr = readNoteAttr(noteAttrs, 'event_id');
	const bpSid = readNoteAttr(noteAttrs, 'bp_sid');

	// Analytics interno (Vitrack): grava purchase SEMPRE — mesmo sem bp_sid.
	// Se nao tem bp_sid, gera sid sintetico baseado no orderId (sessao isolada
	// so pra esse purchase). Garante que toda venda do webhook conta no Vitrack.
	try {
		const orderValue = parseFloat(order.total_price || '0');
		const ua = order.client_details?.user_agent || '';
		const sid = bpSid || `shopify_${orderId}`;
		ingestAnalytics({
			ts: Date.now(),
			sid,
			ev: 'purchase',
			path: '/checkout/success',
			ua,
			device: parseDevice(ua),
			utm_source: readNoteAttr(noteAttrs, 'utm_source'),
			utm_medium: readNoteAttr(noteAttrs, 'utm_medium'),
			utm_campaign: readNoteAttr(noteAttrs, 'utm_campaign'),
			utm_content: readNoteAttr(noteAttrs, 'utm_content'),
			utm_term: readNoteAttr(noteAttrs, 'utm_term'),
			data: {
				amount: orderValue,
				currency: order.currency || 'EUR',
				order_id: order.id,
				synthetic_sid: !bpSid
			}
		});
		if (!bpSid) {
			console.log('[shopify-purchase] analytics ingest (synthetic sid)', { orderId, sid });
		}
	} catch (e) {
		console.warn('[shopify-purchase] analytics ingest failed', e);
	}

	const eventId = eventIdAttr || `shopify_${orderId}`;

	let fbc: string | undefined;
	if (fbclid) {
		fbc = `fb.1.${Date.now()}.${fbclid}`;
	}

	const customer = order.customer || {};
	const shipping = order.shipping_address || order.billing_address || {};
	const email = order.email || customer.email;
	const phone = order.phone || shipping.phone || customer.phone;

	const userData: Record<string, any> = {
		em: email ? [sha256Lower(email)] : undefined,
		ph: phone ? [sha256Lower(String(phone).replace(/\D/g, ''))] : undefined,
		fn: shipping.first_name ? [sha256Lower(shipping.first_name)] : undefined,
		ln: shipping.last_name ? [sha256Lower(shipping.last_name)] : undefined,
		ct: shipping.city ? [sha256Lower(shipping.city)] : undefined,
		st: shipping.province_code ? [sha256Lower(shipping.province_code)] : undefined,
		zp: shipping.zip ? [sha256Lower(String(shipping.zip).replace(/\s/g, ''))] : undefined,
		country: shipping.country_code ? [sha256Lower(shipping.country_code)] : undefined,
		client_ip_address: order.client_details?.browser_ip || undefined,
		client_user_agent: order.client_details?.user_agent || undefined,
		fbc,
		fbp,
		external_id: email ? [sha256Lower(email)] : undefined
	};

	Object.keys(userData).forEach((k) => userData[k] === undefined && delete userData[k]);

	const value = parseFloat(order.total_price || '0');
	const currency = order.currency || 'EUR';

	const contents = (order.line_items || []).map((li: any) => ({
		id: String(li.variant_id || li.product_id),
		quantity: li.quantity || 1,
		item_price: parseFloat(li.price || '0')
	}));
	const contentIds = contents.map((c: any) => c.id);

	const evt = {
		event_name: 'Purchase',
		event_time: Math.floor(Date.now() / 1000),
		event_id: eventId,
		event_source_url: order.order_status_url || undefined,
		action_source: 'website',
		user_data: userData,
		custom_data: {
			currency,
			value,
			content_ids: contentIds,
			content_type: 'product',
			contents,
			order_id: String(orderId),
			num_items: contents.reduce((s: number, c: any) => s + (c.quantity || 1), 0)
		}
	};

	const testEventCode = env.META_TEST_EVENT_CODE;

	const payload: Record<string, any> = { data: [evt] };
	if (testEventCode) payload.test_event_code = testEventCode;

	const metaUrl = `https://graph.facebook.com/${META_CAPI_VERSION}/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`;

	// ── Meta CAPI + UTMify webhook em paralelo (nenhum bloqueia o outro) ──
	const metaPromise = fetch(metaUrl, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload)
	});

	// UTMify recebe o payload raw da ordem Shopify — fire-and-forget
	const UTMIFY_WEBHOOK = 'https://api.utmify.com.br/webhooks/shopify?id=69f938dafc6573f89333f5bf';
	const utmifyPromise = fetch(UTMIFY_WEBHOOK, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'x-shopify-topic': 'orders/paid',
			'x-shopify-shop-domain': 'inigualavelshop.myshopify.com'
		},
		body: rawBody
	});

	// Aguarda os dois em paralelo
	const [metaRes] = await Promise.allSettled([metaPromise, utmifyPromise]);

	if (metaRes.status === 'fulfilled') {
		const r = metaRes.value;
		const respText = await r.text();
		if (!r.ok) {
			console.error('[shopify-purchase] meta capi error', r.status, respText);
		} else {
			console.log('[shopify-purchase] meta ok', { eventId, orderId, value, currency, hasFbc: !!fbc });
		}
	} else {
		console.error('[shopify-purchase] meta fetch failed', metaRes.reason);
	}

	// Log UTMify separado (não impede retorno 200 mesmo se falhar)
	utmifyPromise
		.then(async (r) => {
			if (!r.ok) console.error('[shopify-purchase] utmify error', r.status, await r.text().catch(() => ''));
			else console.log('[shopify-purchase] utmify ok', { orderId });
		})
		.catch((e) => console.error('[shopify-purchase] utmify fetch failed', e));

	// ── Feed de doadores reais (alimenta ProgressCard e lista da LP) ──
	// So registra se a compra tem valor positivo (default). Privacy: so first name + inicial.
	try {
		addRealDonor({
			firstName: shipping.first_name || customer.first_name,
			lastName: shipping.last_name || customer.last_name,
			amount: value,
			currency
		});
	} catch (e) {
		console.error('[shopify-purchase] addRealDonor failed', e);
	}

	// ── Stats dinâmicos da campanha (raisedEur + donationsCount) ──
	try {
		recordPurchase(value);
	} catch (e) {
		console.error('[shopify-purchase] recordPurchase failed', e);
	}

	// ── Agendamento de emails transacionais (NL) ──
	// Email 1: agradecimento 1h apos compra
	// Email 2: upsell 48h apos compra
	// Ambos persistidos em disco — sobrevivem a restart do Railway.
	// Se o email ja recebeu o fluxo (ex: recompra via upsell), nao reenvia.
	if (email) {
		try {
			const firstName = shipping.first_name || customer.first_name || undefined;
			const flowResult = scheduleEmailFlow({ toEmail: email, firstName, amount: value, currency });
			if (!flowResult.scheduled) {
				console.log('[shopify-purchase] email flow skipped (already sent)', { orderId, email, reason: flowResult.reason });
				// Re-compra: cancela qualquer recovery pendente (ja voltou)
				const cancelled = cancelPendingRecoveryForEmail(email);
				if (cancelled > 0) console.log('[shopify-purchase] cancelled pending recovery on repeat purchase', { email, cancelled });
			}
		} catch (e) {
			console.error('[shopify-purchase] schedule email failed', e);
		}
	} else {
		console.warn('[shopify-purchase] no email in order, skipping email schedule', { orderId });
	}

	return json({ ok: true, eventId });
};
