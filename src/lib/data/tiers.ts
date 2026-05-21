export type Tier = {
  amount: number;
  dogs: number;
};

export const TIERS: Tier[] = [
  { amount: 10, dogs: 2 },
  { amount: 20, dogs: 5 },
  { amount: 25, dogs: 6 },
  { amount: 35, dogs: 8 }
];

export const DEFAULT_TIER = 25;

export function tierByAmount(amount: number): Tier | undefined {
  return TIERS.find((t) => t.amount === amount);
}

export function dogsForAmount(amount: number): number {
  const t = tierByAmount(amount);
  if (t) return t.dogs;
  return Math.max(1, Math.round(amount / 4.2));
}
