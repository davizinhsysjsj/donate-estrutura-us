export type Tier = {
  amount: number;
  name: string;
  feeds: string;
  dogsForWeek: number;
  bonuses: string;
};

export const TIERS: Tier[] = [
  { amount: 10, name: 'STARTER', feeds: 'Feeds 2 dogs for a week', dogsForWeek: 2, bonuses: 'Digital bundle + PDF certificate' },
  { amount: 25, name: 'STANDARD', feeds: 'Feeds 6 dogs for a week', dogsForWeek: 6, bonuses: '+ Rescue Stories ebook' },
  { amount: 50, name: 'HERO', feeds: 'Feeds 12 dogs for a week', dogsForWeek: 12, bonuses: '+ digital sticker pack' },
  { amount: 100, name: 'CHAMPION', feeds: 'Feeds 25 dogs for a week', dogsForWeek: 25, bonuses: '+ your name on the Wall of Hope' },
  { amount: 250, name: 'GUARDIAN', feeds: 'Feeds 60 dogs for a week', dogsForWeek: 60, bonuses: '+ monthly Q&A with our founder' }
];

export function tierByAmount(amount: number): Tier | undefined {
  return TIERS.find((t) => t.amount === amount);
}

export function dogsForAmount(amount: number): number {
  const t = tierByAmount(amount);
  if (t) return t.dogsForWeek;
  // Linear approx: €4.20 feeds one dog/week
  return Math.max(1, Math.round(amount / 4.2));
}
