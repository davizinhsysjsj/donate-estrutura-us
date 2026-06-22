/**
 * Stats FIXOS da campanha — sempre retorna os valores hardcoded em CAMPAIGN.
 * recordPurchase e no-op (compras nao incrementam mais a barra).
 * Pra mudar os numeros, edite raisedEur/donationsCount em src/lib/data/campaign.ts.
 */

import { CAMPAIGN } from '$lib/data/campaign';

interface CampaignStats {
	raisedEur: number;
	donationsCount: number;
	updatedAt: number;
}

export function getCampaignStats(): CampaignStats {
	return {
		raisedEur: CAMPAIGN.raisedEur,
		donationsCount: CAMPAIGN.donationsCount,
		updatedAt: Date.now()
	};
}

export function recordPurchase(_amountEur: number) {
	// no-op: contador da barra de progresso fica fixo
}
