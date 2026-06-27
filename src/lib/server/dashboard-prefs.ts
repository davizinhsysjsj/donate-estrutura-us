// Persistencia das preferencias do dashboard (single-user via DASHBOARD_TOKEN).
// Guarda em /data (volume Railway) — sobrevive a restart e e shared entre
// dispositivos.

import * as fs from 'node:fs';
import * as path from 'node:path';

const DATA_DIR = process.env.ANALYTICS_DATA_DIR || '/data';
const FILE = `${DATA_DIR}/dashboard-prefs.json`;

export interface DashboardPrefs {
  selectedAccountIds: string[];
  updatedAt: number;
}

const DEFAULTS: DashboardPrefs = { selectedAccountIds: [], updatedAt: 0 };

let cache: DashboardPrefs | null = null;

function ensureDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch { /* ignora */ }
}

export function getPrefs(): DashboardPrefs {
  if (cache) return cache;
  try {
    if (fs.existsSync(FILE)) {
      const raw = fs.readFileSync(FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      cache = {
        selectedAccountIds: Array.isArray(parsed.selectedAccountIds)
          ? parsed.selectedAccountIds.filter((x: unknown) => typeof x === 'string')
          : [],
        updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0
      };
      return cache;
    }
  } catch (e) {
    console.warn('[dashboard-prefs] load failed:', e);
  }
  cache = { ...DEFAULTS };
  return cache;
}

export function setSelectedAccountIds(ids: string[]): DashboardPrefs {
  ensureDir();
  const cleaned = ids
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .filter((s, i, a) => a.indexOf(s) === i); // dedupe
  const next: DashboardPrefs = { selectedAccountIds: cleaned, updatedAt: Date.now() };
  try {
    fs.writeFileSync(FILE, JSON.stringify(next), 'utf-8');
    cache = next;
  } catch (e) {
    console.warn('[dashboard-prefs] save failed:', e);
  }
  return next;
}
