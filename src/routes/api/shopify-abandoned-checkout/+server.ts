/**
 * Webhook Shopify: checkouts/update (e checkouts/create).
 *
 * Dispara assim que o cliente preenche o email no checkout. Agendamos 1
 * email de recuperacao 10min depois — agressivo, com link direto pro
 * abandoned_checkout_url da Shopify (carrinho preservado).
 *
 * Anti-duplicado:
 *  - Shopify dispara checkouts/update varias vezes (a cada alteracao do
 *    customer). scheduleAbandonedCheckout() ignora se ja tem pendente.
 *  - Se a compra acontecer antes do envio, shopify-purchase chama
 *    cancelPendingAbandonedCheckoutForEmail() pra evitar mandar.
 *
 * Setup Shopify Admin:
 *  - Settings → Notifications → Webhooks → Create webhook
 *  - Event: Checkout updated (Topic: checkouts/update)
 *  - Format: JSON
 *  - URL: https://shopify-4av6l.bldshp.com/api/shopify-abandoned-checkout
 *  - Secret: env SHOPIFY_CHECKOUT_WEBHOOK_SECRET
 */

import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import crypto from 'node:crypto';
import { env } from '$env/dynamic/private';
import { scheduleAbandonedCheckout, initEmailScheduler } from '$lib/server/email-scheduler';

initEmailScheduler();

function timingSafeEq(a: string, b: string): boolean {
	const ab = Buffer.from(a, 'utf8');
	const bb = Buffer.from(b, 'utf8');
	if (ab.length !== bb.length) return false;
	return crypto.timingSafeEqual(ab, bb);
}

export const POST: RequestHandler = async ({ request }) => {
	const SHOPIFY_SECRET = env.SHOPIFY_CHECKOUT_WEBHOOK_SECRET || env.SHOPIFY_WEBHOOK_SECRET;
	if (!SHOPIFY_SECRET) {
		console.error('[shopify-abandoned-checkout] missing SHOPIFY_CHECKOUT_WEBHOOK_SECRET');
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
		console.error('[shopify-abandoned-checkout] hmac mismatch');
		throw error(401, 'invalid hmac');
	}

	let checkout: any;
	try {
		checkout = JSON.parse(rawBody);
	} catch {
		throw error(400, 'invalid json');
	}

	const checkoutId = checkout.id;
	const email: string | undefined = checkout.email || checkout.customer?.email;
	const recoverUrl: string | undefined = checkout.abandoned_checkout_url;

	// Sem email, nao tem pra quem mandar. Shopify gera webhooks antes do email ser preenchido.
	if (!email) {
		return json({ ok: true, skipped: 'no_email', checkoutId });
	}

	// Sem recover URL nao tem como recuperar. Devolve 200 pra Shopify nao retry.
	if (!recoverUrl) {
		console.warn('[shopify-abandoned-checkout] missing abandoned_checkout_url', { checkoutId, email });
		return json({ ok: true, skipped: 'no_recover_url', checkoutId });
	}

	// Se ja tem completed_at, o checkout virou pedido — nao agenda recuperacao
	if (checkout.completed_at) {
		return json({ ok: true, skipped: 'already_completed', checkoutId });
	}

	const amount = parseFloat(checkout.total_price || '0');
	const currency = checkout.currency || 'EUR';
	const shipping = checkout.shipping_address || checkout.billing_address || {};
	const customer = checkout.customer || {};
	const firstName: string | undefined =
		shipping.first_name || customer.first_name || undefined;

	// Primeiro line item — vai exibido em destaque no email
	const firstItem = (checkout.line_items || [])[0];
	const itemTitle: string | undefined = firstItem
		? `${firstItem.title}${firstItem.variant_title ? ` — ${firstItem.variant_title}` : ''}`
		: undefined;

	try {
		const r = scheduleAbandonedCheckout({
			toEmail: email,
			firstName,
			amount,
			currency,
			recoverUrl,
			itemTitle
		});
		console.log('[shopify-abandoned-checkout]', {
			checkoutId,
			email,
			amount,
			currency,
			scheduled: r.scheduled,
			reason: r.reason
		});
		return json({ ok: true, scheduled: r.scheduled, reason: r.reason });
	} catch (e: any) {
		console.error('[shopify-abandoned-checkout] schedule failed', e);
		// Mesmo se falhar, devolve 200 pra Shopify nao retry agressivamente
		return json({ ok: true, error: e?.message || 'schedule_failed' });
	}
};
