/**
 * POST /api/track-ic
 * Dispara InitiateCheckout via Meta CAPI (server-side).
 * Usado quando o usuário abre o popup de doação.
 * Complementa o client-side fbq — bypassa ad-blockers.
 */
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import crypto from 'node:crypto';
import { env } from '$env/dynamic/private';
import { notifyIcStarted } from '$lib/server/notify';
import { lookupGeo } from '$lib/server/geo';
import { parseDevice, parseBrowser } from '$lib/server/analytics';

const META_CAPI_VERSION = 'v21.0';

function sha256Lower(value: string | undefined | null): string | undefined {
	if (!value) return undefined;
	return crypto.createHash('sha256').update(String(value).trim().toLowerCase()).digest('hex');
}

export const POST: RequestHandler = async ({ request }) => {
	const PIXEL_ID = env.META_PIXEL_ID;
	const ACCESS_TOKEN = env.META_CAPI_TOKEN;

	if (!PIXEL_ID || !ACCESS_TOKEN) {
		console.error('[track-ic] missing env vars');
		return json({ ok: false, error: 'misconfigured' }, { status: 500 });
	}

	// IP real do cliente (Railway usa X-Forwarded-For via proxy)
	const clientIpFromHeaders =
		request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
		request.headers.get('x-real-ip') ||
		undefined;

	let body: any;
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, error: 'invalid json' }, { status: 400 });
	}

	const {
		eventId,
		value,
		currency = 'EUR',
		fbclid,
		fbp,
		fbc: fbcFromClient,
		userAgent,
		sourceUrl,
		sid,
		utm_source,
		utm_campaign
	} = body;

	// IP: prefere o do header (mais confiável) sobre o enviado pelo cliente
	const clientIp = clientIpFromHeaders;

	if (!eventId) {
		return json({ ok: false, error: 'missing eventId' }, { status: 400 });
	}

	// Constrói fbc se tiver fbclid
	let fbc = fbcFromClient;
	if (!fbc && fbclid) {
		fbc = `fb.1.${Date.now()}.${fbclid}`;
	}

	const userData: Record<string, any> = {
		client_ip_address: clientIp || undefined,
		client_user_agent: userAgent || undefined,
		fbc: fbc || undefined,
		fbp: fbp || undefined
	};

	// Remove undefined
	Object.keys(userData).forEach((k) => userData[k] === undefined && delete userData[k]);

	const evt = {
		event_name: 'InitiateCheckout',
		event_time: Math.floor(Date.now() / 1000),
		event_id: eventId,
		event_source_url: sourceUrl || undefined,
		action_source: 'website',
		user_data: userData,
		custom_data: {
			currency,
			value: value ?? 0,
			content_ids: [String(value ?? 0)],
			content_type: 'product',
			num_items: 1
		}
	};

	const testEventCode = env.META_TEST_EVENT_CODE;
	const payload: Record<string, any> = { data: [evt] };
	if (testEventCode) payload.test_event_code = testEventCode;

	const metaUrl = `https://graph.facebook.com/${META_CAPI_VERSION}/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`;

	try {
		const res = await fetch(metaUrl, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(payload)
		});
		const respText = await res.text();

		if (!res.ok) {
			console.error('[track-ic] meta capi error', res.status, respText);
			return json({ ok: false, error: respText }, { status: 502 });
		}

		console.log('[track-ic] IC enviado via CAPI', { eventId, value, currency, hasFbc: !!fbc });

		// Notificação push (Pushcut) — fire-and-forget, com geo lookup async
		try {
			const ua = userAgent || '';
			const device = parseDevice(ua);
			const { browser } = parseBrowser(ua);
			const geoP = clientIp ? lookupGeo(clientIp) : Promise.resolve({} as any);
			geoP
				.then((geo) => {
					notifyIcStarted({
						sid,
						amount: typeof value === 'number' ? value : Number(value) || undefined,
						currency,
						country: geo?.country,
						countryCode: geo?.countryCode,
						city: geo?.city,
						device,
						browser,
						utmSource: utm_source,
						utmCampaign: utm_campaign,
						eventId
					});
				})
				.catch(() => {});
		} catch (e) {
			console.warn('[track-ic] notify dispatch failed', e);
		}

		return json({ ok: true, eventId });
	} catch (e) {
		console.error('[track-ic] fetch failed', e);
		return json({ ok: false, error: 'fetch failed' }, { status: 502 });
	}
};
