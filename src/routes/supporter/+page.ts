import type { PageLoad } from './$types';
import { dogsForAmount } from '$lib/data/tiers';

export const load: PageLoad = ({ url }) => {
  const raw = url.searchParams.get('tier');
  const parsed = raw ? Number(raw) : 25;
  const amount = Number.isFinite(parsed) && parsed >= 1 ? parsed : 25;
  const dogs = dogsForAmount(amount);

  const today = new Date();
  const dateStr = today.toLocaleDateString('nl-BE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const orderId = `PWC-${today.getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;

  return { amount, dogs, dateStr, orderId };
};
