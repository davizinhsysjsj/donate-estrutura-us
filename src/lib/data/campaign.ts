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
  organizerCity: 'Antwerpen, België',
  category: 'Dieren',
  createdMonth: 'mei 2026',

  // Hero
  title: 'Help de dieren de honger te overleven',
  subtitle: "Aoife Murphy organiseert deze inzamelactie om opvangcentra in Antwerpen te steunen.",
  // Deixe vazio ("") pra renderizar placeholder cinza. Quando tiver URL, template usa direto.
  heroImage: '/hero-rescue.webp',
  storyImage: '',

  // Progress
  raisedEur: 1053,
  goalEur: 5000,
  donationsCount: 412,
  // Data de encerramento da campanha (ISO). daysLeft calculado dinamicamente a partir daqui.
  campaignEndDate: '2026-06-30',
  daysLeft: 21, // fallback caso campaignEndDate seja removido

  // Story
  story: [
    "Drie weken geleden kregen we een telefoontje van een klein opvangcentrum in Antwerpen. Hun voorraadkamer was bijna leeg, de vriezer stond uit om stroom te besparen, en 47 honden en katten wachtten op hun volgende maaltijd.",
    "We reden diezelfde nacht naar boven met al het voer dat we in de bestelwagen konden laden. Wat we daar aantroffen maakte de lange rit naar huis als niets — kennels met twee dieren per plek, vrijwilligers die brokken uit eigen zak betaalden, en een 9 jaar oude herder genaamd Loki die al drie winters niet geadopteerd was.",
    "We deden hen een belofte: we zouden niet toelaten dat ze deze winter opnieuw zonder voer zouden komen te zitten. We houden ons aan die belofte — maar alleen als jij hem mee houdt."
  ],

  // CTA / story highlight
  highlight: 'Loki had geluk. Er wachten er nog 300.',

  // Donor list (placeholder — depois plugar feed real)
  donors: [
    { name: 'Lieve Janssens', amount: 50, ago: 'zojuist', initials: 'LJ', color: 'av-green' },
    { name: 'Pieter De Smet', amount: 25, ago: '3 min geleden', initials: 'PD', color: 'av-teal' },
    { name: 'Sandra Simões', amount: 25, ago: '12 min geleden', initials: 'SS', color: 'av-coral' },
    { name: 'Anoniem', amount: 100, ago: '28 min geleden', initials: '', color: 'av-gray', anonymous: true },
    { name: 'Marie Dubois', amount: 35, ago: '47 min geleden', initials: 'MD', color: 'av-amber' },
    { name: 'Diogo Gamito', amount: 10, ago: '1 u geleden', initials: 'DG', color: 'av-skyblue' },
    { name: 'Tom Verbeek', amount: 20, ago: '2 u geleden', initials: 'TV', color: 'av-rose' },
    { name: 'Filipa Ferreira', amount: 50, ago: '2 u geleden', initials: 'FF', color: 'av-purple' },
    { name: 'Sofie Maes', amount: 35, ago: '3 u geleden', initials: 'SM', color: 'av-teal' },
    { name: 'Jeroen Peeters', amount: 10, ago: '4 u geleden', initials: 'JP', color: 'av-coral' },
    { name: 'Camille Lefèvre', amount: 25, ago: '5 u geleden', initials: 'CL', color: 'av-amber' },
    { name: 'Anoniem', amount: 75, ago: '6 u geleden', initials: '', color: 'av-gray', anonymous: true },
    { name: 'Bram Vermeulen', amount: 35, ago: '8 u geleden', initials: 'BV', color: 'av-blue' },
    { name: 'Anke Vandenberg', amount: 25, ago: '10 u geleden', initials: 'AV', color: 'av-rose' },
    { name: 'Mathieu Renard', amount: 50, ago: '11 u geleden', initials: 'MR', color: 'av-green' },
    { name: 'Eva Claes', amount: 15, ago: '13 u geleden', initials: 'EC', color: 'av-purple' },
    { name: 'Niels Vandeput', amount: 20, ago: '15 u geleden', initials: 'NV', color: 'av-skyblue' },
    { name: 'Anoniem', amount: 200, ago: '18 u geleden', initials: '', color: 'av-gray', anonymous: true },
    { name: 'Charlotte Mertens', amount: 35, ago: '20 u geleden', initials: 'CM', color: 'av-coral' },
    { name: 'Sven Janssens', amount: 25, ago: '22 u geleden', initials: 'SJ', color: 'av-amber' }
  ] satisfies CampaignDonor[],

  // Stats card
  stats: [
    { value: '2.847', label: 'dieren die wachten in partneropvangen' },
    { value: '12', label: 'opvangpartners in heel België' },
    { value: '€4,20', label: 'voedt één opvangdier een week lang' },
    { value: '88%', label: 'gaat rechtstreeks naar voeding & verzorging' }
  ],

  // Testimonials / words of support
  testimonials: [
    {
      avatar: '/avatars/women-44.webp',
      name: 'Emma B.',
      city: 'Antwerpen',
      quote: "Ik weet precies waar mijn donatie naartoe ging — en een week later kreeg ik een foto. Daarom ben ik teruggekomen."
    },
    {
      avatar: '/avatars/men-32.webp',
      name: 'Niels V.',
      city: 'Gent',
      quote: 'Geen schuldgevoel-mails, gewoon een eenvoudig betaalbewijs en een update. Betrouwbaar van begin tot eind.'
    },
    {
      avatar: '/avatars/women-68.webp',
      name: 'Camille L.',
      city: 'Brussel',
      quote: 'Ik heb de coördinatoren van het opvangcentrum persoonlijk ontmoet. Dit geld bereikt echt de dieren.'
    },
    {
      avatar: '/avatars/women-12.webp',
      name: 'Lieve D.',
      city: 'Brugge',
      quote: "Ik heb gedoneerd aan grotere goede doelen en wist nooit waar het naartoe ging. Hier kreeg ik een echte update met de namen van de honden."
    },
    {
      avatar: '/avatars/men-76.webp',
      name: 'Mathieu R.',
      city: 'Luik',
      quote: 'Ik doneerde voor mijn overleden hond Bruno. Het voelde als de juiste manier om hem te eren. Bedankt voor wat jullie doen.'
    },
    {
      avatar: '/avatars/men-52.webp',
      name: 'Sven J.',
      city: 'Leuven',
      quote: "Kleine donatie, maar ze gaven me het gevoel dat het ertoe deed. Volgende maand zet ik een maandelijkse bijdrage op."
    },
    {
      avatar: '/avatars/women-29.webp',
      name: 'Charlotte M.',
      city: 'Namen',
      quote: 'Makkelijk, snel, geen druk. De foto van Loki die sliep na de maaltijd maakte mijn week goed.'
    },
    {
      avatar: '/avatars/men-15.webp',
      name: 'Bram V.',
      city: 'Mechelen',
      quote: "Transparant en menselijk. Belgische opvangcentra hebben veel meer steun zoals dit nodig."
    }
  ],

  shareUrl: 'https://belgianpawshelter.help',
  shareTitle: 'Help deze winter Belgische opvangdieren te voeden'
};
