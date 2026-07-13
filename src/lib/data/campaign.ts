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
  organizer: 'Elena Ruiz',
  organizerCity: 'Barcelona, España',
  organizerImage: '/organizer.webp',
  category: 'Animales',
  createdMonth: 'julio 2026',

  // Hero
  title: 'Más de 57 perros rescatados en España están sin comida',
  subtitle: "Elena Ruiz organiza esta recaudación para apoyar a los refugios de Barcelona.",
  // Deixe vazio ("") pra renderizar placeholder cinza. Quando tiver URL, template usa direto.
  heroImage: '/hero-rescue.webp',
  storyImage: '',

  // Progress
  raisedEur: 640,
  goalEur: 890,
  donationsCount: 47,
  // Data de encerramento da campanha (ISO). daysLeft calculado dinamicamente a partir daqui.
  campaignEndDate: '2026-08-31',
  daysLeft: 21, // fallback caso campaignEndDate seja removido

  // Story
  story: [
    "Ayúdanos a alimentar a los que no pueden pedir ayuda 🐾",
    "En este momento nuestros refugios afrontan una situación crítica. Decenas de animales rescatados — perros y gatos abandonados — dependen totalmente de nuestra ayuda para sobrevivir... y estamos sin pienso, sin medicinas, sin medios para continuar.",
    "Cada euro donado hace que estos animales reciban lo que necesitan: comida, atención veterinaria y un lugar seguro. Hoy puedes salvar una vida."
  ],

  // CTA / story highlight
  highlight: 'Loki tuvo suerte. Aún esperan 300.',

  // Donor list (placeholder — depois plugar feed real)
  donors: [
    { name: 'Lucía Martín', amount: 50, ago: 'ahora mismo', initials: 'LM', color: 'av-green' },
    { name: 'Pablo García', amount: 25, ago: 'hace 3 min', initials: 'PG', color: 'av-teal' },
    { name: 'Sandra Simões', amount: 25, ago: 'hace 12 min', initials: 'SS', color: 'av-coral' },
    { name: 'Anónimo', amount: 100, ago: 'hace 28 min', initials: '', color: 'av-gray', anonymous: true },
    { name: 'María Delgado', amount: 35, ago: 'hace 47 min', initials: 'MD', color: 'av-amber' },
    { name: 'Diego Gamito', amount: 10, ago: 'hace 1 h', initials: 'DG', color: 'av-skyblue' },
    { name: 'Tomás Vera', amount: 20, ago: 'hace 2 h', initials: 'TV', color: 'av-rose' },
    { name: 'Filipa Ferreira', amount: 50, ago: 'hace 2 h', initials: 'FF', color: 'av-purple' },
    { name: 'Sofía Molina', amount: 35, ago: 'hace 3 h', initials: 'SM', color: 'av-teal' },
    { name: 'Javier Pérez', amount: 10, ago: 'hace 4 h', initials: 'JP', color: 'av-coral' },
    { name: 'Carmen López', amount: 25, ago: 'hace 5 h', initials: 'CL', color: 'av-amber' },
    { name: 'Anónimo', amount: 75, ago: 'hace 6 h', initials: '', color: 'av-gray', anonymous: true },
    { name: 'Bruno Vidal', amount: 35, ago: 'hace 8 h', initials: 'BV', color: 'av-blue' },
    { name: 'Ana Vargas', amount: 25, ago: 'hace 10 h', initials: 'AV', color: 'av-rose' },
    { name: 'Miguel Rivera', amount: 50, ago: 'hace 11 h', initials: 'MR', color: 'av-green' },
    { name: 'Elena Castro', amount: 15, ago: 'hace 13 h', initials: 'EC', color: 'av-purple' },
    { name: 'Nacho Villar', amount: 20, ago: 'hace 15 h', initials: 'NV', color: 'av-skyblue' },
    { name: 'Anónimo', amount: 200, ago: 'hace 18 h', initials: '', color: 'av-gray', anonymous: true },
    { name: 'Cristina Marín', amount: 35, ago: 'hace 20 h', initials: 'CM', color: 'av-coral' },
    { name: 'Sergio Jiménez', amount: 25, ago: 'hace 22 h', initials: 'SJ', color: 'av-amber' }
  ] satisfies CampaignDonor[],

  // Ons werk — carrossel de fotos da rotina no abrigo (LP + VSL)
  workImages: [
    { src: '/work-1.webp', caption: 'Cada mañana empieza aquí — dar de comer con lo que tenemos.' },
    { src: '/work-2.webp', caption: 'Nuestros voluntarios cuidan de cada animal, cada día.' },
    { src: '/work-3.webp', caption: 'Un lugar seguro gracias a donantes como tú.' }
  ],

  // Stats card
  stats: [
    { value: '2.847', label: 'animales esperando en refugios asociados' },
    { value: '12', label: 'refugios asociados en toda España' },
    { value: '€4,20', label: 'alimenta a un animal rescatado una semana' },
    { value: '88%', label: 'va directamente a comida y cuidados' }
  ],

  // Testimonials / words of support — pessoas que ja doaram pra Shadow
  testimonials: [
    {
      avatar: '/avatars/women-44.webp',
      name: 'Elena B.',
      city: 'Barcelona',
      quote: "Le enseñé a mi hija (8) la foto de Shadow y se puso a llorar en el acto. Juntas donamos €30 de su hucha. Cada noche me pregunta si ya está mejor."
    },
    {
      avatar: '/avatars/men-32.webp',
      name: 'Nacho V.',
      city: 'Valencia',
      quote: 'Tengo un gato negro en casa — Mowgli, 11 años. Cuando vi a Shadow con la vía puesta, me acordé de él enseguida. €50 donados. No pude pasar de largo.'
    },
    {
      avatar: '/avatars/women-68.webp',
      name: 'Carmen L.',
      city: 'Madrid',
      quote: 'Mi gato Felix murió de cáncer hace 2 años. Cuando leí sobre Shadow, se me saltaron las lágrimas. €100 donados para su operación — en memoria de Felix.'
    },
    {
      avatar: '/avatars/women-12.webp',
      name: 'Lucía D.',
      city: 'Sevilla',
      quote: "Vi la historia de Shadow en Facebook y no pude dejar de pensar en ese pobre animal en toda la noche. €25 donados para su comida — cada euro cuenta ahora."
    },
    {
      avatar: '/avatars/men-76.webp',
      name: 'Mateo R.',
      city: 'Bilbao',
      quote: 'El año pasado me operaron a mí. Sé lo que es estar solo y con miedo. Shadow también se merece esa segunda oportunidad. €40 donados esta mañana.'
    },
    {
      avatar: '/avatars/men-52.webp',
      name: 'Sergio J.',
      city: 'Zaragoza',
      quote: "Como estudiante no puedo permitirme mucho, pero €15 para Shadow sí. Por favor mantenednos al día de su operación — pienso en él toda la semana."
    },
    {
      avatar: '/avatars/women-29.webp',
      name: 'Carla M.',
      city: 'Málaga',
      quote: 'La radiografía con el tumor me impactó mucho. Mi marido y yo donamos €60 juntos. Por favor avisadnos cuando salga de la operación.'
    },
    {
      avatar: '/avatars/men-15.webp',
      name: 'Bruno V.',
      city: 'Granada',
      quote: "Trabajo de repartidor y veo muchos animales callejeros. Pero los ojos de Shadow en esa foto me llegaron distinto. €35 donados. Ánimo a todos los que cuidan de él."
    }
  ],

  shareUrl: 'https://belgianpawsfoundation.org',
  shareTitle: 'Ayuda a alimentar a los animales rescatados este invierno'
};
