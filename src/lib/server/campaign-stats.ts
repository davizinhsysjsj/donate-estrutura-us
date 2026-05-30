/**
 * Stats dinâmicos da campanha — raisedEur e donationsCount.
 *
 * Persiste em .data/campaign-stats.json (mesmo volume Railway que email-scheduler e donors-feed).
 * Seed inicial: valores do CAMPAIGN.ts como base (nao zera em deploy).
 * Chamado pelo webhook shopify-purchase apos cada compra paga.
 */

import fs from 'node:fs';
import path from 'node:path';
import { CAMPAIGN } from '$lib/data/campaign';

const DATA_DIR = process.env.SCHEDULER_DATA_DIR || path.join(process.cwd(), '.data');
const FILE = path.join(DATA_DIR, 'campaign-stats.json');

interface CampaignStats {
	raisedEur: number;
	donationsCount: number;
	updatedAt: number;
}

// Valores iniciais do campaign.ts como piso (nao começa do zero)
const SEED: CampaignStats = {
	raisedEur: CAMPAIGN.raisedEur,
	donationsCount: CAMPAIGN.donationsCount,
	updatedAt: Date.now()
};

function ensureDir() {
	try {
		if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
	} catch (e) {
		console.error('[campaign-stats] cant create data dir', e);
	}
}

function load(): CampaignStats {
	try {
		if (!fs.existsSync(FILE)) return { ...SEED };
		const raw = fs.readFileSync(FILE, 'utf-8');
		const parsed = JSON.parse(raw);
		// Garante que os valores sao >= ao seed (nunca abaixo do inicial hardcoded)
		return {
			raisedEur: Math.max(parsed.raisedEur ?? 0, SEED.raisedEur),
			donationsCount: Math.max(parsed.donationsCount ?? 0, SEED.donationsCount),
			updatedAt: parsed.updatedAt ?? Date.now()
		};
	} catch (e) {
		console.error('[campaign-stats] failed to load', e);
		return { ...SEED };
	}
}

function save(stats: CampaignStats) {
	try {
		ensureDir();
		fs.writeFileSync(FILE, JSON.stringify(stats, null, 2), 'utf-8');
	} catch (e) {
		console.error('[campaign-stats] failed to save', e);
	}
}

/**
 * Retorna os stats atuais da campanha.
 */
export function getCampaignStats(): CampaignStats {
	return load();
}

/**
 * Incrementa raisedEur e donationsCount apos uma compra.
 * Chamado pelo webhook shopify-purchase.
 */
export function recordPurchase(amountEur: number) {
	if (!amountEur || amountEur <= 0) return;
	const current = load();
	const updated: CampaignStats = {
		raisedEur: Math.round(current.raisedEur + amountEur),
		donationsCount: current.donationsCount + 1,
		updatedAt: Date.now()
	};
	save(updated);
	console.log('[campaign-stats] updated', updated);
}
