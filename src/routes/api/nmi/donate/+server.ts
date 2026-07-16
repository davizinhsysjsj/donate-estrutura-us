import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { processSale, type NMIBillingAddress } from '$lib/server/nmi';

interface DonateBody {
	amount?: number;
	token?: string;
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
	const ip = getClientAddress?.();

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
		return json(
			{
				success: false,
				error: result.error || 'Payment declined',
				responseCode: result.responseCode,
				responseText: result.responseText
			},
			{ status: 402 }
		);
	}

	return json({
		success: true,
		transactionId: result.transactionId,
		authCode: result.authCode,
		orderId
	});
};
