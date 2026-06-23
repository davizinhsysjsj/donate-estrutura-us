/**
 * Persiste leads do formulario "Adopteer Shadow" em arquivo JSON.
 * Volume Railway (mesma pasta de campaign-stats / donors-feed).
 */

import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.SCHEDULER_DATA_DIR || path.join(process.cwd(), '.data');
const FILE = path.join(DATA_DIR, 'adoption-leads.json');

export interface AdoptionLead {
	name: string;
	city: string;
	email: string;
	createdAt: number;
	ip?: string;
	userAgent?: string;
}

function ensureDir() {
	if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function recordAdoptionLead(lead: AdoptionLead) {
	ensureDir();
	let leads: AdoptionLead[] = [];
	try {
		if (fs.existsSync(FILE)) {
			leads = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
		}
	} catch (e) {
		console.error('[adoption-leads] read failed, starting fresh', e);
	}
	leads.unshift(lead);
	// Mantem ate 1000 leads em memoria (mais que o suficiente pra essa campanha)
	if (leads.length > 1000) leads.length = 1000;
	fs.writeFileSync(FILE, JSON.stringify(leads, null, 2), 'utf-8');
	console.log('[adoption-leads] saved', { name: lead.name, city: lead.city, email: lead.email });
}

export function listAdoptionLeads(): AdoptionLead[] {
	try {
		if (!fs.existsSync(FILE)) return [];
		return JSON.parse(fs.readFileSync(FILE, 'utf-8'));
	} catch {
		return [];
	}
}
