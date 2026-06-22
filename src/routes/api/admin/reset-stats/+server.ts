import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import fs from 'node:fs';
import path from 'node:path';

const TOKEN = 'reset-katten-2026-06-22-xj7';

export const POST: RequestHandler = async ({ url }) => {
  if (url.searchParams.get('token') !== TOKEN) {
    return json({ error: 'unauthorized' }, { status: 401 });
  }

  const raisedEur = Number(url.searchParams.get('raised') ?? '640');
  const donationsCount = Number(url.searchParams.get('count') ?? '47');

  if (!Number.isFinite(raisedEur) || raisedEur < 0 || !Number.isFinite(donationsCount) || donationsCount < 0) {
    return json({ error: 'invalid raised/count' }, { status: 400 });
  }

  const DATA_DIR = process.env.SCHEDULER_DATA_DIR || path.join(process.cwd(), '.data');
  const FILE = path.join(DATA_DIR, 'campaign-stats.json');

  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(
      FILE,
      JSON.stringify({ raisedEur, donationsCount, updatedAt: Date.now() }, null, 2),
      'utf-8'
    );
  } catch (e) {
    return json({ error: String(e) }, { status: 500 });
  }

  return json({ ok: true, raisedEur, donationsCount });
};
