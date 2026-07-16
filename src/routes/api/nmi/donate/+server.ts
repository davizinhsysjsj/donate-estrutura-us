import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { processSale, type NMIBillingAddress } from '$lib/server/nmi';

interface DonateBody {
	amount?: number;
	token?: string;
	tokenType?: string;
	billing?: NMIBillingAddress;
	orderDescription?: string;
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	let body: DonateBody;
	try {
		body = (await request.json()) as DonateBody;
	} catch {
		return json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
	}

	const dollars = Number(body.amount);
	if (!Number.isFinite(dollars) || dollars < 1) {
		return json({ success: false, error: 'Invalid amount' }, { status: 400 });
	}
	if (!body.token || typeof body.token !== 'string') {
		return json({ success: false, error: 'Missing payment token' }, { status: 400 });
	}

	const orderId = `ellie-us-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	let ip: string | undefined;
	try {
		ip = getClientAddress?.();
	} catch {
		ip = undefined;
	}

	try {
		const result = await processSale({
			amountCents: Math.round(dollars * 100),
			currency: 'USD',
			paymentToken: body.token,
			billing: body.billing,
			orderId,
			orderDescription: body.orderDescription || 'Support Ellie',
			ipAddress: ip
		});

		if (!result.success) {
			console.warn('[NMI donate] declined', {
				orderId,
				amount: dollars,
				tokenType: body.tokenType,
				responseCode: result.responseCode,
				responseText: result.responseText,
				error: result.error
			});
			return json(
				{
					success: false,
					error: result.error || result.responseText || 'Payment declined',
					responseCode: result.responseCode,
					responseText: result.responseText,
					orderId
				},
				{ status: 200 }
			);
		}

		console.log('[NMI donate] approved', {
			orderId,
			amount: dollars,
			tokenType: body.tokenType,
			transactionId: result.transactionId,
			authCode: result.authCode
		});

		return json({
			success: true,
			transactionId: result.transactionId,
			authCode: result.authCode,
			orderId
		});
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		console.error('[NMI donate] unhandled error', { orderId, message, error: e });
		return json(
			{
				success: false,
				error: `Payment processor error: ${message}`,
				orderId
			},
			{ status: 200 }
		);
	}
};
