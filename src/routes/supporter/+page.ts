import type { PageLoad } from './$types';
import { TIERS, tierByAmount, type Tier } from '$lib/data/tiers';

export const load: PageLoad = ({ url }) => {
  const raw = url.searchParams.get('tier');
  const parsed = raw ? Number(raw) : 50;
  const tier: Tier = tierByAmount(parsed) ?? TIERS.find((t) => t.amount === 50)!;

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-IE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const orderId = `PWC-${today.getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;

  return {
    tier,
    dateStr,
    orderId
  };
};
