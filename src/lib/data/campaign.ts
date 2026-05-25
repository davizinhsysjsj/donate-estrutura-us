// Dados editaveis da campanha — substitua os placeholders aqui sem mexer no template.
// Imagens recomendadas: 4:3 ou 16:9, hospedadas em URL publica (Unsplash, IA).

export type CampaignDonor = {
  name: string;
  amount: number;
  ago: string;
  initials: string;
  color: string;
  anonymous?: boolean;
  message?: string;
};

export type CampaignUpdate = {
  date: string;
  title: string;
  body: string;
};

export const CAMPAIGN = {
  // Branding
  brand: 'PawsCo',
  organizer: 'Aoife Murphy',
  organizerCity: 'Antwerp, Belgium',
  category: 'Animals',
  createdMonth: 'May 2026',

  // Hero
  title: 'Help Belgian Rescues feed 300 animals this winter',
  subtitle: "Aoife Murphy is organizing this fundraiser to support shelters in Antwerp.",
  // Deixe vazio ("") pra renderizar placeholder cinza. Quando tiver URL, template usa direto.
  heroImage: '',
  storyImage: '',

  // Progress
  raisedEur: 18450,
  goalEur: 30000,
  donationsCount: 412,
  daysLeft: 21,

  // Story
  story: [
    "Three weeks ago, a phone call came in from a small rescue shelter in Antwerp. Their stockroom was almost empty, the freezer was off to save power, and 47 dogs and cats were waiting for the next meal.",
    "We drove up the same night with whatever food we could load into the van. What we found there made the long drive home feel like nothing — kennels packed two to a space, volunteers paying for kibble out of their own pockets, and a 9-year-old shepherd named Loki who hadn't been adopted in three winters.",
    "We made them a promise: we would not let them run out of food again this winter. We're keeping that promise — but only if you keep it with us."
  ],

  // CTA / story highlight
  highlight: 'Loki was lucky. 300 more are waiting.',

  // Donor list (placeholder — depois plugar feed real)
  donors: [
    { name: "Lieve Janssens", amount: 50, ago: '1h ago', initials: 'LJ', color: 'av-green' },
    { name: 'Pieter De Smet', amount: 25, ago: '2h ago', initials: 'PD', color: 'av-teal' },
    { name: 'Anonymous', amount: 100, ago: '4h ago', initials: '', color: 'av-gray', anonymous: true },
    { name: 'Marie Dubois', amount: 35, ago: '6h ago', initials: 'MD', color: 'av-amber' },
    { name: 'Tom Verbeek', amount: 20, ago: '8h ago', initials: 'TV', color: 'av-rose' },
    { name: 'Sofie Maes', amount: 35, ago: '12h ago', initials: 'SM', color: 'av-purple' },
    { name: 'Jeroen Peeters', amount: 10, ago: '1d ago', initials: 'JP', color: 'av-coral' },
    { name: 'Anke Vandenberg', amount: 25, ago: '1d ago', initials: 'AV', color: 'av-blue' }
  ] satisfies CampaignDonor[],

  // Stats card
  stats: [
    { value: '2,847', label: 'animals waiting in partner shelters' },
    { value: '12', label: 'rescue partners across Belgium' },
    { value: '€4.20', label: 'feeds one rescue for a week' },
    { value: '88%', label: 'goes directly to feeding & care' }
  ],

  // Testimonials / words of support
  testimonials: [
    {
      avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
      name: 'Emma B.',
      city: 'Antwerp',
      quote: "I know exactly where my donation went — and I got a photo a week later. That's why I came back."
    },
    {
      avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
      name: 'Niels V.',
      city: 'Ghent',
      quote: 'No guilt-trip emails, just a simple receipt and an update. Trustworthy from start to finish.'
    },
    {
      avatar: 'https://randomuser.me/api/portraits/women/68.jpg',
      name: 'Camille L.',
      city: 'Brussels',
      quote: 'I met the shelter coordinators in person. This money is actually reaching the animals.'
    },
    {
      avatar: 'https://randomuser.me/api/portraits/women/12.jpg',
      name: 'Lieve D.',
      city: 'Bruges',
      quote: "I've donated to bigger charities and never knew where it went. Here I got a real update with names of the dogs."
    },
    {
      avatar: 'https://randomuser.me/api/portraits/men/76.jpg',
      name: 'Mathieu R.',
      city: 'Liège',
      quote: 'Donated for my late dog Bruno. Felt like the right way to honour him. Thank you for what you do.'
    },
    {
      avatar: 'https://randomuser.me/api/portraits/men/52.jpg',
      name: 'Sven J.',
      city: 'Leuven',
      quote: "Small donation but they made me feel like it mattered. Will set up a monthly contribution next month."
    },
    {
      avatar: 'https://randomuser.me/api/portraits/women/29.jpg',
      name: 'Charlotte M.',
      city: 'Namur',
      quote: 'Easy, fast, no pressure. The photo of Loki sleeping after the meal made my week.'
    },
    {
      avatar: 'https://randomuser.me/api/portraits/men/15.jpg',
      name: 'Bram V.',
      city: 'Mechelen',
      quote: "Transparent and human. Belgian rescues need way more support like this."
    }
  ],

  shareUrl: 'https://donate-estrutura.vercel.app',
  shareTitle: 'Help feed Belgian rescue animals this winter'
};
