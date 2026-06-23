import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { recordAdoptionLead } from '$lib/server/adoption-leads';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	let body: { name?: string; city?: string; email?: string } = {};
	try {
		body = await request.json();
	} catch {
		return json({ error: 'invalid json' }, { status: 400 });
	}

	const name = String(body.name ?? '').trim().slice(0, 120);
	const city = String(body.city ?? '').trim().slice(0, 120);
	const email = String(body.email ?? '').trim().toLowerCase().slice(0, 200);

	if (!name || !city || !email) {
		return json({ error: 'missing fields' }, { status: 400 });
	}
	if (!EMAIL_RE.test(email)) {
		return json({ error: 'invalid email' }, { status: 400 });
	}

	let ip: string | undefined;
	try {
		const fwd = request.headers.get('x-forwarded-for');
		ip = fwd ? fwd.split(',')[0].trim() : getClientAddress();
	} catch {}
	const userAgent = request.headers.get('user-agent') ?? undefined;

	try {
		recordAdoptionLead({ name, city, email, createdAt: Date.now(), ip, userAgent });
	} catch (e) {
		console.error('[api/adoption] save failed', e);
		return json({ error: 'save failed' }, { status: 500 });
	}

	return json({ ok: true });
};
