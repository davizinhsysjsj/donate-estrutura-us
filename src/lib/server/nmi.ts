import { env } from '$env/dynamic/private';

const NMI_API_URL = env.NMI_API_URL || 'https://api.nmi.com/api/v5';
const NMI_SECURITY_KEY = env.NMI_SECURITY_KEY;

export interface NMIBillingAddress {
	first_name?: string;
	last_name?: string;
	address?: string;
	address2?: string;
	city?: string;
	state?: string;
	postal_code?: string;
	country?: string;
	email?: string;
	phone?: string;
}

export interface NMISaleInput {
	amountCents: number;
	currency?: string;
	paymentToken: string;
	billing?: NMIBillingAddress;
	orderId?: string;
	orderDescription?: string;
	ipAddress?: string;
}

export interface NMISaleResult {
	success: boolean;
	transactionId?: string;
	authCode?: string;
	responseCode?: string;
	responseText?: string;
	avsResponse?: string;
	cvvResponse?: string;
	raw?: unknown;
	error?: string;
}

export async function processSale(input: NMISaleInput): Promise<NMISaleResult> {
	if (!NMI_SECURITY_KEY) {
		return { success: false, error: 'NMI_SECURITY_KEY not configured' };
	}
	if (!input.paymentToken) {
		return { success: false, error: 'Missing payment token' };
	}
	if (!input.amountCents || input.amountCents < 100) {
		return { success: false, error: 'Amount must be at least $1.00' };
	}

	const body: Record<string, unknown> = {
		amount: input.amountCents,
		currency: input.currency || 'USD',
		payment_details: { payment_token: input.paymentToken },
		order_id: input.orderId,
		order_description: input.orderDescription || 'Support Ellie'
	};

	if (input.billing) body.billing_address = input.billing;
	if (input.ipAddress) body.ip_address = input.ipAddress;

	let response: Response;
	try {
		response = await fetch(`${NMI_API_URL}/payments/sale`, {
			method: 'POST',
			headers: {
				Authorization: NMI_SECURITY_KEY,
				'Content-Type': 'application/json',
				Accept: 'application/json'
			},
			body: JSON.stringify(body)
		});
	} catch (e) {
		return { success: false, error: `Network error: ${(e as Error).message}` };
	}

	const raw = await response.json().catch(() => ({}));

	const transactionId = raw?.id || raw?.transaction_id;
	const responseCode = String(raw?.response_code ?? raw?.response ?? '');
	const responseText = raw?.response_text || raw?.text || raw?.message;
	const authCode = raw?.auth_code;
	const avsResponse = raw?.avs_response;
	const cvvResponse = raw?.cvv_response;

	const approved =
		response.ok &&
		(raw?.response === 1 ||
			raw?.response === '1' ||
			raw?.status === 'approved' ||
			responseCode === '100');

	if (!approved) {
		return {
			success: false,
			transactionId,
			responseCode,
			responseText,
			error: responseText || `HTTP ${response.status}`,
			raw
		};
	}

	return {
		success: true,
		transactionId,
		authCode,
		responseCode,
		responseText,
		avsResponse,
		cvvResponse,
		raw
	};
}
