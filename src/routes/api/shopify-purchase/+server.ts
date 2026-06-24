import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import crypto from 'node:crypto';
import { env } from '$env/dynamic/private';
import { ingest as ingestAnalytics, parseDevice, initStore as initAnalyticsStore, getSessionBySid } from '$lib/server/analytics';
import { scheduleEmailFlow, initEmailScheduler, cancelPendingRecoveryForEmail, cancelPendingAbandonedCheckoutForEmail } from '$lib/server/email-scheduler';
import { setSidEmail, removePopupBySid } from '$lib/server/abandoned-popups';
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
	const tblci = readNoteAttr(noteAttrs, 'tblci');
	const ttclid = readNoteAttr(noteAttrs, 'ttclid');
	const ttp = readNoteAttr(noteAttrs, 'ttp');

	// UTMs do webhook (podem vir nulos quando in-app browser bloqueia localStorage
	// e o cart link e construido sem attributes[utm_*]).
	const rawUtmSource   = readNoteAttr(noteAttrs, 'utm_source');
	const rawUtmMedium   = readNoteAttr(noteAttrs, 'utm_medium');
	const rawUtmCampaign = readNoteAttr(noteAttrs, 'utm_campaign');
	const rawUtmContent  = readNoteAttr(noteAttrs, 'utm_content');
	const rawUtmTerm     = readNoteAttr(noteAttrs, 'utm_term');

	// Enriquecimento server-side: se webhook nao trouxe UTMs MAS tem bp_sid,
	// faz lookup na sessao Vitrack (in-memory, sync) e recupera os UTMs
	// originais do clique. Cobre o caso de in-app browser que perdeu storage
	// entre /katten -> /donate.
	let resolvedUtmSource   = rawUtmSource;
	let resolvedUtmMedium   = rawUtmMedium;
	let resolvedUtmCampaign = rawUtmCampaign;
	let resolvedUtmContent  = rawUtmContent;
	let resolvedUtmTerm     = rawUtmTerm;
	let utmRecoveredFromSid = false;
	if (!rawUtmSource && bpSid) {
		try {
			const s: any = getSessionBySid(bpSid);
			if (s?.utm_source) {
				resolvedUtmSource   = s.utm_source;
				resolvedUtmMedium   = s.utm_medium   || resolvedUtmMedium;
				resolvedUtmCampaign = s.utm_campaign || resolvedUtmCampaign;
				resolvedUtmContent  = s.utm_content  || resolvedUtmContent;
				resolvedUtmTerm     = s.utm_term     || resolvedUtmTerm;
				utmRecoveredFromSid = true;
				console.log('[shopify-purchase] UTMs recovered from bp_sid lookup', {
					orderId, bpSid, utm_source: resolvedUtmSource, utm_campaign: resolvedUtmCampaign
				});
			}
		} catch (e) {
			console.warn('[shopify-purchase] utm lookup failed', e);
		}
	}

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
			utm_source:   resolvedUtmSource,
			utm_medium:   resolvedUtmMedium,
			utm_campaign: resolvedUtmCampaign,
			utm_content:  resolvedUtmContent,
			utm_term:     resolvedUtmTerm,
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

	// Remove abandoned-popup pendente desse sid (converteu — nao manda recovery)
	if (bpSid) removePopupBySid(bpSid);

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

	// ── Taboola S2S — dispara "Compra" se tblci disponível ──
	// Endpoint documentado: trc.taboola.com/actions-handler/log/3/s2s-actions (sem auth)
	if (tblci) {
		const taboolaParams = new URLSearchParams({
			'click-id': tblci,
			'name': 'Compra',
			'revenue': String(value),
			'currency': currency,
			'timestamp': String(Math.floor(Date.now() / 1000))
		});
		fetch(`https://trc.taboola.com/actions-handler/log/3/s2s-actions?${taboolaParams}`)
			.then(async (r) => {
				const body = await r.text().catch(() => '');
				if (!r.ok) console.error('[shopify-purchase] taboola s2s error', r.status, body);
				else console.log('[shopify-purchase] taboola ok', { tblci, value, status: r.status });
			})
			.catch((e) => console.error('[shopify-purchase] taboola fetch failed', e));
	}

	// ── TikTok Events API V2 — dispara "CompletePayment" se houver atribuição ──
	// Endpoint: business-api.tiktok.com/open_api/v1.3/event/track/
	// Requer TIKTOK_PIXEL_ID + TIKTOK_ACCESS_TOKEN. Se ausentes, pula silenciosamente.
	const TIKTOK_PIXEL_ID = env.TIKTOK_PIXEL_ID || 'D8PI2QBC77U8IPSBIFU0';
	const TIKTOK_ACCESS_TOKEN = env.TIKTOK_ACCESS_TOKEN;
	if (TIKTOK_ACCESS_TOKEN && (ttclid || ttp || email || phone)) {
		const ttPayload = {
			event_source: 'web',
			event_source_id: TIKTOK_PIXEL_ID,
			data: [
				{
					event: 'CompletePayment',
					event_time: Math.floor(Date.now() / 1000),
					event_id: eventId,
					user: {
						email: email ? sha256Lower(email) : undefined,
						phone: phone ? sha256Lower(String(phone).replace(/\D/g, '')) : undefined,
						external_id: email ? sha256Lower(email) : undefined,
						ttclid: ttclid || undefined,
						ttp: ttp || undefined,
						ip: order.client_details?.browser_ip || undefined,
						user_agent: order.client_details?.user_agent || undefined
					},
					properties: {
						currency,
						value,
						content_type: 'product',
						content_id: contentIds[0] || String(orderId),
						content_name: `Donation`,
						contents: contents.map((c: any) => ({
							content_id: c.id,
							content_type: 'product',
							quantity: c.quantity,
							price: c.item_price
						})),
						order_id: String(orderId)
					},
					page: {
						url: order.order_status_url || undefined
					}
				}
			]
		};
		Object.keys(ttPayload.data[0].user).forEach(
			(k) => (ttPayload.data[0].user as any)[k] === undefined && delete (ttPayload.data[0].user as any)[k]
		);
		fetch('https://business-api.tiktok.com/open_api/v1.3/event/track/', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'Access-Token': TIKTOK_ACCESS_TOKEN
			},
			body: JSON.stringify(ttPayload)
		})
			.then(async (r) => {
				const body = await r.text().catch(() => '');
				if (!r.ok) console.error('[shopify-purchase] tiktok events api error', r.status, body);
				else console.log('[shopify-purchase] tiktok ok', { ttclid: !!ttclid, ttp: !!ttp, value, status: r.status });
			})
			.catch((e) => console.error('[shopify-purchase] tiktok fetch failed', e));
	} else if (!TIKTOK_ACCESS_TOKEN) {
		console.warn('[shopify-purchase] TIKTOK_ACCESS_TOKEN ausente — pulando S2S TikTok');
	}

	// ── Meta CAPI + UTMify webhook em paralelo (nenhum bloqueia o outro) ──
	const metaPromise = fetch(metaUrl, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload)
	});

	// UTMify recebe o payload raw da ordem Shopify — fire-and-forget.
	// Se recuperamos UTMs via bp_sid lookup, injetamos nos note_attributes do
	// body antes de enviar — caso contrario o UTMify tambem veria "sem campanha".
	const UTMIFY_WEBHOOK = 'https://api.utmify.com.br/webhooks/shopify?id=69f938dafc6573f89333f5bf';
	let utmifyBody = rawBody;
	if (utmRecoveredFromSid) {
		try {
			const enriched = JSON.parse(rawBody);
			const attrs: Array<{ name: string; value: string }> = Array.isArray(enriched.note_attributes)
				? [...enriched.note_attributes]
				: [];
			const upsert = (name: string, value: string | undefined) => {
				if (!value) return;
				const idx = attrs.findIndex((a) => a.name === name);
				if (idx >= 0) attrs[idx] = { name, value };
				else attrs.push({ name, value });
			};
			upsert('utm_source',   resolvedUtmSource);
			upsert('utm_medium',   resolvedUtmMedium);
			upsert('utm_campaign', resolvedUtmCampaign);
			upsert('utm_content',  resolvedUtmContent);
			upsert('utm_term',     resolvedUtmTerm);
			enriched.note_attributes = attrs;
			utmifyBody = JSON.stringify(enriched);
		} catch (e) {
			console.warn('[shopify-purchase] utmify body enrich failed (sending raw)', e);
		}
	}
	const utmifyPromise = fetch(UTMIFY_WEBHOOK, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'x-shopify-topic': 'orders/paid',
			'x-shopify-shop-domain': 'inigualavelshop.myshopify.com'
		},
		body: utmifyBody
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
			// Abandoned-checkout: se tinha algum pendente desse email, cancela (a compra concretizou)
			const cancelledAbandoned = cancelPendingAbandonedCheckoutForEmail(email);
			if (cancelledAbandoned > 0) {
				console.log('[shopify-purchase] cancelled pending abandoned-checkout on purchase', { email, cancelled: cancelledAbandoned });
			}
			// Mapeia sid → email pra abandoned-popup recovery em compras futuras
			if (bpSid) setSidEmail(bpSid, email);
		} catch (e) {
			console.error('[shopify-purchase] schedule email failed', e);
		}
	} else {
		console.warn('[shopify-purchase] no email in order, skipping email schedule', { orderId });
	}

	return json({ ok: true, eventId });
};
