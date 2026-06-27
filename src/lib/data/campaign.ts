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
  organizerImage: '/organizer.webp',
  category: 'Dieren',
  createdMonth: 'mei 2026',

  // Hero
  title: 'Meer dan 57 geredde honden in België zitten zonder eten',
  subtitle: "Aoife Murphy organiseert deze inzamelactie om opvangcentra in Antwerpen te steunen.",
  // Deixe vazio ("") pra renderizar placeholder cinza. Quando tiver URL, template usa direto.
  heroImage: '/hero-rescue.webp',
  storyImage: '',

  // Progress
  raisedEur: 640,
  goalEur: 890,
  donationsCount: 47,
  // Data de encerramento da campanha (ISO). daysLeft calculado dinamicamente a partir daqui.
  campaignEndDate: '2026-06-30',
  daysLeft: 21, // fallback caso campaignEndDate seja removido

  // Story
  story: [
    "Help ons te voeden wie niet om hulp kan vragen 🐾",
    "Op dit moment staat Honden Poten voor een kritieke situatie. Tientallen geredde dieren — verlaten honden en katten — zijn volledig afhankelijk van onze hulp om te overleven... en we zitten zonder voer, zonder medicijnen, zonder middelen om door te gaan.",
    "Elke gedoneerde euro zorgt ervoor dat deze dieren krijgen wat ze nodig hebben: voedsel, dierenartsenzorg en een veilige plek. Jij kunt vandaag een leven redden."
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

  // Ons werk — carrossel de fotos da rotina no abrigo (LP + VSL)
  workImages: [
    { src: '/work-1.webp', caption: 'Elke ochtend begint hier — voeren wat we hebben.' },
    { src: '/work-2.webp', caption: 'Onze vrijwilligers zorgen voor elk dier, elke dag.' },
    { src: '/work-3.webp', caption: 'Een veilige plek dankzij donateurs zoals jij.' }
  ],

  // Stats card
  stats: [
    { value: '2.847', label: 'dieren die wachten in partneropvangen' },
    { value: '12', label: 'opvangpartners in heel België' },
    { value: '€4,20', label: 'voedt één opvangdier een week lang' },
    { value: '88%', label: 'gaat rechtstreeks naar voeding & verzorging' }
  ],

  // Testimonials / words of support — pessoas que ja doaram pra Shadow
  testimonials: [
    {
      avatar: '/avatars/women-44.webp',
      name: 'Emma B.',
      city: 'Antwerpen',
      quote: "Ik liet mijn dochtertje (8) de foto van Shadow zien en ze begon meteen te huilen. Samen hebben we €30 gedoneerd uit haar spaarpot. Elke avond vraagt ze of het al beter gaat met hem."
    },
    {
      avatar: '/avatars/men-32.webp',
      name: 'Niels V.',
      city: 'Gent',
      quote: 'Ik heb thuis een zwarte kat — Mowgli, 11 jaar oud. Toen ik Shadow zag liggen met dat infuus, moest ik direct aan hem denken. €50 gedoneerd. Ik kon gewoon niet wegklikken.'
    },
    {
      avatar: '/avatars/women-68.webp',
      name: 'Camille L.',
      city: 'Brussel',
      quote: 'Mijn kat Felix is 2 jaar geleden overleden aan kanker. Toen ik over Shadow las, kreeg ik tranen in mijn ogen. €100 gedoneerd voor zijn operatie — in Felix’s naam.'
    },
    {
      avatar: '/avatars/women-12.webp',
      name: 'Lieve D.',
      city: 'Brugge',
      quote: "Ik heb Shadow’s verhaal op Facebook gezien en kon de hele avond niet stoppen met denken aan dat arme beestje. €25 gedoneerd voor zijn eten — elke euro telt nu."
    },
    {
      avatar: '/avatars/men-76.webp',
      name: 'Mathieu R.',
      city: 'Luik',
      quote: 'Vorig jaar werd ik zelf geopereerd. Ik weet wat het is om alleen te zijn en bang. Shadow verdient die tweede kans ook. €40 gedoneerd vanmorgen.'
    },
    {
      avatar: '/avatars/men-52.webp',
      name: 'Sven J.',
      city: 'Leuven',
      quote: "Als student kan ik niet veel missen, maar €15 voor Shadow lukte wel. Alstublieft hou ons op de hoogte van zijn operatie — ik denk de hele week aan hem."
    },
    {
      avatar: '/avatars/women-29.webp',
      name: 'Charlotte M.',
      city: 'Namen',
      quote: 'De röntgenfoto met die tumor heeft me echt geraakt. Mijn man en ik hebben samen €60 gedoneerd. Laat het ons alstublieft weten als hij door de operatie heen is.'
    },
    {
      avatar: '/avatars/men-15.webp',
      name: 'Bram V.',
      city: 'Mechelen',
      quote: "Ik werk als koerier en zie veel zwerfdieren onderweg. Maar Shadow’s ogen op die foto raakten me anders. €35 gedoneerd. Sterkte aan iedereen die voor hem zorgt."
    }
  ],

  shareUrl: 'https://belgianpawshelter.help',
  shareTitle: 'Help deze winter Belgische opvangdieren te voeden'
};
