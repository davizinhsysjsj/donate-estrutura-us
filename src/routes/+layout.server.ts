import type { LayoutServerLoad } from './$types';
import { getRecentRealDonors, type FeedDonor } from '$lib/server/donors-feed';
import { getCampaignStats } from '$lib/server/campaign-stats';
import { CAMPAIGN } from '$lib/data/campaign';

/**
 * Carrega doadores pra LP/VSL: reais (das ultimas 24h) primeiro, completa com fakes.
 *
 * - Reais vem do webhook Shopify (.data/recent-donors.json)
 * - Fakes: CAMPAIGN.donors (placeholder original)
 * - Sempre devolve >= 20 itens pra UI nao quebrar
 * - Cache 60s no header pra nao ler disco em todo request
 */
export const load: LayoutServerLoad = async ({ setHeaders }) => {
	const real = getRecentRealDonors();

	// merge: reais no topo + fakes pra completar ate 20
	const fakes = (CAMPAIGN.donors as unknown as Array<{
		name: string;
		amount: number;
		ago: string;
		initials: string;
		color: string;
		anonymous?: boolean;
	}>).map((d) => ({
		name: d.name,
		amount: d.amount,
		ago: d.ago,
		initials: d.initials,
		color: d.color,
		anonymous: !!d.anonymous,
		ts: 0,
		real: false as const
	}));

	const needed = Math.max(0, 20 - real.length);
	const merged: (FeedDonor | (typeof fakes)[number])[] = [
		...real,
		...fakes.slice(0, needed)
	];

	// Stats dinâmicos: raisedEur e donationsCount do arquivo persistido
	const stats = getCampaignStats();

	// cache curto: o feed muda quando uma nova compra entra (raro o suficiente
	// pra 60s ser aceitavel; alivia I/O de disco em trafego alto)
	setHeaders({ 'cache-control': 'public, max-age=60' });

	return {
		donors: merged,
		realDonorsCount: real.length,
		raisedEur: stats.raisedEur,
		donationsCount: stats.donationsCount
	};
};
