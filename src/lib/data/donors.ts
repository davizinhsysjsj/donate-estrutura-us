export type Donor = {
  name: string;
  amount: number;
  ago: string;
  color: string;
  anonymous?: boolean;
};

export const DONORS: Donor[] = [
  { name: "Sean O'Brien", amount: 50, ago: '1h', color: 'av-skyblue' },
  { name: 'Niamh Kelly', amount: 25, ago: '2h', color: 'av-coral' },
  { name: 'Anonymous', amount: 100, ago: '4h', color: 'av-gray', anonymous: true },
  { name: 'Ciara Doyle', amount: 10, ago: '6h', color: 'av-amber' },
  { name: 'Liam Walsh', amount: 25, ago: '8h', color: 'av-teal' },
  { name: 'Aisling Murphy', amount: 50, ago: '12h', color: 'av-purple' },
  { name: 'Cathal Byrne', amount: 25, ago: '1d', color: 'av-rose' },
  { name: 'Roisin Quinn', amount: 10, ago: '1d', color: 'av-blue' }
];

export const RAISED_EUR = 1247;
export const GOAL_EUR = 5000;
