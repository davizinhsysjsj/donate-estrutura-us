/**
 * Endpoint temporário de debug — retorna o feed de doadores reais bruto.
 * Protegido por MAIL_TEST_TOKEN (reutilizado). Uso:
 *   GET /api/debug-donors?token=<MAIL_TEST_TOKEN>
 */
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import fs from 'node:fs';
import path from 'node:path';

export const GET: RequestHandler = async ({ url }) => {
  const token = url.searchParams.get('token');
  const expected = process.env.MAIL_TEST_TOKEN;
  if (!expected || token !== expected) {
    return json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const DATA_DIR = process.env.SCHEDULER_DATA_DIR || path.join(process.cwd(), '.data');
  const FILE = path.join(DATA_DIR, 'recent-donors.json');

  try {
    if (!fs.existsSync(FILE)) {
      return json({ ok: true, exists: false, file: FILE, count: 0, donors: [] });
    }
    const raw = fs.readFileSync(FILE, 'utf-8');
    const arr = JSON.parse(raw);
    return json({
      ok: true,
      exists: true,
      file: FILE,
      count: Array.isArray(arr) ? arr.length : 0,
      donors: arr
    });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || 'read failed' }, { status: 500 });
  }
};
