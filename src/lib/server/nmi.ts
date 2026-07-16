import { env } from '$env/dynamic/private';
import { pickAddress, type USAddress } from './us-addresses';

// NMI Classic API — payment_token de Collect.js/Apple Pay/Google Pay é
// consumido em POST https://secure.nmi.com/api/transact.php com form-urlencoded.
// A API v5 REST/JSON exige outro formato de token e retornou "The provided data is invalid".
const NMI_TRANSACT_URL =
	env.NMI_TRANSACT_URL || 'https://secure.nmi.com/api/transact.php';
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
	address?: USAddress;
	raw?: Record<string, string>;
	error?: string;
}

function parseQueryString(text: string): Record<string, string> {
	const out: Record<string, string> = {};
	const params = new URLSearchParams(text);
	for (const [k, v] of params.entries()) out[k] = v;
	return out;
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

	const amountDollars = (input.amountCents / 100).toFixed(2);
	const address = pickAddress();
	const billing = input.billing || {};

	// Merge cliente + endereco fake (endereco sobrescreve o postal_code/state/city
	// pra manter AVS coerente; nome/email do cliente prevalece)
	const form = new URLSearchParams();
	form.set('security_key', NMI_SECURITY_KEY);
	form.set('type', 'sale');
	form.set('amount', amountDollars);
	form.set('currency', input.currency || 'USD');
	form.set('payment_token', input.paymentToken);

	if (input.orderId) form.set('orderid', input.orderId);
	if (input.orderDescription) form.set('order_description', input.orderDescription);
	if (input.ipAddress) form.set('ipaddress', input.ipAddress);

	form.set('first_name', billing.first_name || address.first_name);
	form.set('last_name', billing.last_name || address.last_name);
	if (billing.email) form.set('email', billing.email);
	if (billing.phone) form.set('phone', billing.phone);

	form.set('address1', address.address1);
	form.set('city', address.city);
	form.set('state', address.state);
	form.set('zip', address.zip);
	form.set('country', 'US');

	// Shipping = mesmo do billing (produto fisico plausivel)
	form.set('shipping_firstname', billing.first_name || address.first_name);
	form.set('shipping_lastname', billing.last_name || address.last_name);
	form.set('shipping_address1', address.address1);
	form.set('shipping_city', address.city);
	form.set('shipping_state', address.state);
	form.set('shipping_zip', address.zip);
	form.set('shipping_country', 'US');

	let response: Response;
	try {
		response = await fetch(NMI_TRANSACT_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				Accept: 'text/plain'
			},
			body: form.toString()
		});
	} catch (e) {
		console.error('[NMI processSale] network error', {
			url: NMI_TRANSACT_URL,
			message: (e as Error).message
		});
		return {
			success: false,
			address,
			error: `Network error: ${(e as Error).message}`
		};
	}

	const text = await response.text();
	const raw = parseQueryString(text);

	const responseFlag = raw.response; // "1"=approved, "2"=declined, "3"=error
	const responseCode = raw.response_code || '';
	const responseText = raw.responsetext || raw.response_text || '';
	const transactionId = raw.transactionid || raw.transaction_id;
	const authCode = raw.authcode;
	const avsResponse = raw.avsresponse;
	const cvvResponse = raw.cvvresponse;

	const approved = response.ok && responseFlag === '1' && responseCode === '100';

	if (!approved) {
		console.warn('[NMI processSale] not approved', {
			httpStatus: response.status,
			responseFlag,
			responseCode,
			responseText,
			addressUsed: address.address1,
			raw
		});
		return {
			success: false,
			transactionId,
			responseCode,
			responseText,
			address,
			error: responseText || `NMI response=${responseFlag} code=${responseCode}`,
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
		address,
		raw
	};
}
