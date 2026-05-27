import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';

const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
	'Access-Control-Allow-Headers': 'content-type',
	'Access-Control-Max-Age': '86400'
};

export const OPTIONS: RequestHandler = async () => {
	return new Response(null, { status: 204, headers: CORS_HEADERS });
};

export const POST: RequestHandler = async ({ request }) => {
	let payload: any = null;
	try {
		payload = await request.json();
	} catch (e) {
		payload = { error: 'invalid_json', raw: await request.text().catch(() => '') };
	}
	const userAgent = request.headers.get('user-agent') ?? '';
	const referer = request.headers.get('referer') ?? '';
	const origin = request.headers.get('origin') ?? '';
	console.log(
		'[debug-pixel]',
		JSON.stringify({
			ts: new Date().toISOString(),
			payload,
			userAgent,
			referer,
			origin
		})
	);
	return json({ ok: true }, { status: 200, headers: CORS_HEADERS });
};
