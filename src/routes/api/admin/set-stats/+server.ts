import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.SCHEDULER_DATA_DIR || path.join(process.cwd(), '.data');
const FILE = path.join(DATA_DIR, 'campaign-stats.json');

export const POST: RequestHandler = async ({ request }) => {
	const ADMIN_SECRET = env.SHOPIFY_WEBHOOK_SECRET;
	if (!ADMIN_SECRET) throw error(500, 'misconfigured');
	if (request.headers.get('x-admin-secret') !== ADMIN_SECRET) throw error(401, 'unauthorized');

	const { raisedEur, donationsCount } = await request.json();
	if (typeof raisedEur !== 'number' || typeof donationsCount !== 'number') {
		throw error(400, 'raisedEur and donationsCount required');
	}

	try { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}
	const stats = { raisedEur, donationsCount, updatedAt: Date.now() };
	fs.writeFileSync(FILE, JSON.stringify(stats, null, 2), 'utf-8');

	return json({ ok: true, stats });
};
