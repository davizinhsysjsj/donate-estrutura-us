/**
 * Templates HTML dos emails transacionais.
 *
 * Suporta locale 'nl' (producao, default) e 'pt' (testes/QA).
 *
 * Logo: header verde escuro (cor da camisa "Dog Paws Shelter" da foto)
 * com texto "BELGIAN PAWS" + patinha 🐾.
 *
 * Imagem: hospedada em https://belgianpawshelter.help/email/feeding-dogs.jpg
 */

const SITE_URL = 'https://belgianpawshelter.help';
const DONATE_URL = `${SITE_URL}/`;
const UPSELL_DONATE_URL = `${SITE_URL}/donate?utm_source=email&utm_medium=recompra&utm_campaign=48h`;
const HERO_IMAGE = `${SITE_URL}/email/feeding-dogs.jpg`;
const UPSELL_HERO_IMAGE = `${SITE_URL}/email/rescued-dogs.jpg`;
const ABANDONED_CHECKOUT_HERO_IMAGE = `${SITE_URL}/email/abandoned-checkout-hero.jpg`;
const LOGO_IMAGE = `${SITE_URL}/email/logo.png`;
const SUPPORT_EMAIL = 'contact@belgianpaws.help';
const BRAND_COLOR = '#16A34A'; // verde camisa (usado no botao CTA)
const BRAND_DARK = '#15803D';

export type Locale = 'nl' | 'pt';

export interface ThankYouVars {
  firstName?: string;
  amount: number;
  currency: string;
  locale?: Locale;
}

export interface UpsellVars {
  firstName?: string;
  previousAmount: number;
  currency: string;
  locale?: Locale;
}

export interface UpsellV2Vars {
  firstName?: string;
  previousAmount: number;
  currency: string;
  locale?: Locale;
  recipientEmail?: string;
}

export interface RecoveryVars {
  firstName?: string;
  recentDonorsCount?: number; // pulled dynamically se vazio, fallback no template
  locale?: Locale;
}

export interface AbandonedPopupVars {
  firstName?: string;
  amount: number; // valor que o user quase doou
  locale?: Locale;
  recipientEmail?: string;
}

export interface AbandonedCheckoutVars {
  firstName?: string;
  amount: number; // total do checkout abandonado
  currency: string;
  recoverUrl: string; // abandoned_checkout_url da Shopify
  itemTitle?: string; // primeiro line item (ex: "Hero — €50")
  locale?: Locale;
}

function escape(s: string | undefined | null): string {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatAmount(v: number, currency: string, locale: Locale): string {
  const intlLocale = locale === 'pt' ? 'pt-BR' : 'nl-BE';
  return new Intl.NumberFormat(intlLocale, {
    style: 'currency',
    currency: currency || 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(v);
}

/**
 * Strings por idioma.
 */
const STR = {
  nl: {
    htmlLang: 'nl',
    fallbackName: 'vriend',
    tagline: 'Helping rescued dogs in Belgium',
    footerBrand: 'Belgian Paws Helper · Rescued dog care, Belgium',
    footerSupport: (mail: string) => `Heb je een vraag? Antwoord direct op deze e-mail of mail naar <a href="mailto:${mail}" style="color:${BRAND_DARK};text-decoration:none;">${mail}</a>.`,
    // Thank you
    thankSubject: 'Wij hebben al voer gekocht voor 3 honden 🐾',
    thankPreview: 'Hier is een foto van Max, Luna en Milo die eten dankzij jouw donatie. Klik en bekijk.',
    thankH1: (name: string) => `Bedankt, ${name}. Jij hebt vandaag het verschil gemaakt.`,
    thankP1: (amount: string) =>
      `Jouw donatie van <strong style="color:${BRAND_DARK};">${amount}</strong> is al onderweg naar de bakjes van enkele van onze geredde honden. Vandaag eten ze warm en veilig, en dat is dankzij jou.`,
    thankP2: 'Je bent geweldig. Bedankt dat je ons helpt — we rekenen blijvend op jouw steun om meer viervoeters een tweede kans te geven.',
    thankCta: 'Bekijk hoe je nog meer kan helpen',
    thankSignoff: 'Met warme groet,',
    teamName: 'Het Belgian Paws team',
    heroAlt: 'Onze vrijwilligers voeden geredde honden vandaag',
    // Upsell — 10 caes magros recem resgatados (texto comovente)
    upsellSubject: 'Tien uitgehongerde honden net binnengebracht 🐾',
    upsellPreview: 'Ze zijn gered, maar we hebben jouw hulp nodig om ze te voeden.',
    upsellH1: (name: string) => `${name}, tien honden hebben jou vandaag nodig.`,
    upsellP1: (amount: string) =>
      `Vandaag zijn er tien extreem ondervoede honden in ons opvangcentrum aangekomen. Hun ribben staken uit, hun ogen waren leeg — maar we konden ze redden, mede dankzij jouw eerdere donatie van <strong style="color:${BRAND_DARK};">${amount}</strong>.`,
    upsellP2: 'Nu beginnt het zwaarste deel: ze terug op krachten brengen. Elke hond heeft schoon water, hoogwaardig herstelvoer en medische zorg nodig om weer op poten te komen.',
    upsellP3: 'Als je kunt — al is het maar een klein beetje — zou je ons opnieuw willen helpen? Zonder jou redden ze het niet.',
    upsellCta: 'Ja, ik help nog een hond',
    upsellSignoff: 'Uit de grond van ons hart, bedankt.',
    upsellHeroAlt: 'Tien uitgehongerde honden net gered door Dog Paws Shelter',
    // Upsell V2 — 3 botoes ancorados (50/80/100) com missoes tangiveis
    upsellV2Subject: '7 van de 10 honden wachten nog op een redder 🐾',
    upsellV2Preview: 'Drie zijn al gered door donateurs zoals jij. Er blijven er 7 over. Kies welke jij vandaag voedt.',
    upsellV2H1: (name: string) => `${name}, er blijven nog 7 honden over die honger hebben.`,
    upsellV2P1: (amount: string) =>
      `Dankzij jouw eerdere donatie van <strong style="color:${BRAND_DARK};">${amount}</strong> hebben we 3 van de 10 ondervoede honden die deze week binnenkwamen al kunnen redden. Maar er blijven er 7 met lege bakjes — en ze kijken naar de deur, wachtend op iemand zoals jij.`,
    upsellV2P2: 'Vandaag vraag ik je iets concreets te doen: kies <strong>één hond</strong> en geef hem een echte kans. Hieronder zie je wat elk bedrag precies betekent — geen ronde getallen, geen vage beloftes. Echte missies, voor echte honden.',
    upsellV2MissionsTitle: 'Kies jouw missie',
    upsellV2Mission50Title: '€50 — Voer 1 hond een hele week',
    upsellV2Mission50Desc: 'Hoogwaardig herstelvoer, schoon water en een schone slaapplek voor 7 dagen.',
    upsellV2Mission80Badge: 'MEEST GEKOZEN',
    upsellV2Mission80Title: '€80 — Voer + vaccinatie voor 1 hond',
    upsellV2Mission80Desc: '1 week voeding + alle vaccins die nodig zijn om hem te beschermen tegen ziekte.',
    upsellV2Mission100Title: '€100 — Red een puppy in kritieke staat',
    upsellV2Mission100Desc: 'Spoedeisende veterinaire zorg, infuus en intensieve behandeling voor een pup die het zonder hulp niet redt.',
    upsellV2Footnote: 'Elke knop brengt je direct naar de betaalpagina. Geen extra klikken, geen formulieren — Bancontact, klaar.',
    upsellV2Signoff: 'Uit de grond van ons hart, bedankt dat je terugkomt.',
    upsellV2HeroAlt: 'Geredde hond die wacht op zijn maaltijd bij Belgian Paws Shelter',
    // Recovery — 7 dias apos compra, pra quem nao reagiu ao upsell-v2 (social proof)
    recoverySubject: 'Deze week hebben anderen al geholpen — jij ook?',
    recoveryPreview: 'Een laatste herinnering. De honden wachten nog steeds.',
    recoveryH1: (name: string) => `${name}, even een snelle herinnering.`,
    recoveryP1: (count: string) =>
      `In de afgelopen 7 dagen hebben <strong style="color:${BRAND_DARK};">${count} mensen</strong> opnieuw gedoneerd om onze honden te voeden. Sommigen kwamen terug voor de 2e of 3e keer. Andere voor het eerst — geraakt door dezelfde verhalen die ook jou raakten.`,
    recoveryP2: 'De maaltijdbakjes zijn elke dag leeg, en elke dag vullen we ze opnieuw — maar alleen dankzij donateurs zoals jij.',
    recoveryP3: 'Als jouw situatie het toelaat, helpt zelfs een klein bedrag enorm. We hebben geen enkel teken nodig dat je mee blijft helpen — alleen jouw concrete actie van vandaag.',
    recoveryCta: 'Help opnieuw',
    recoveryFootnote: 'Geen verplichtingen, geen abonnementen. Elke donatie is eenmalig en gaat rechtstreeks naar voeding en zorg.',
    recoverySignoff: 'Bedankt dat je dit nog steeds leest. Dat zegt al heel veel.',
    recoveryHeroAlt: 'Hond bij Belgian Paws Shelter wacht op vrijwilligers',
    // Abandoned popup — disparado 1h apos o popup do donate fechar sem compra
    abandonedSubject: 'Je was bijna klaar om te helpen 🐾',
    abandonedPreview: 'Je hebt het bedrag al gekozen. Eén klik en je donatie is rond.',
    abandonedH1: (name: string) => `${name}, je was er bijna.`,
    abandonedP1: (amount: string) =>
      `Je hebt een donatie van <strong style="color:${BRAND_DARK};">${amount}</strong> gekozen, maar de betaling werd niet afgerond. Geen zorgen — alles is bewaard. Eén klik en je sluit het af.`,
    abandonedP2: 'Elke maaltijd telt voor onze geredde honden. Jouw donatie maakt vandaag het verschil.',
    abandonedCta: 'Mijn donatie afronden',
    abandonedFootnote: 'Bancontact, klaar. Geen extra formulieren.',
    abandonedSignoff: 'We rekenen op je.',
    abandonedHeroAlt: 'Geredde hond wacht op zijn maaltijd',
    // Abandoned Shopify CHECKOUT — disparado 10min apos checkout abandonado (Shopify webhook)
    abandonedCoSubject: 'Een hond zit nog in jouw winkelwagen 🐾',
    abandonedCoPreview: 'Je was klaar om hem te redden. Hij wacht nog steeds. Eén klik en hij eet vandaag.',
    abandonedCoUrgencyTag: '⚠️ Jouw winkelwagen verloopt binnenkort',
    abandonedCoH1: (name: string) => `${name}, hij wacht nog steeds op jou.`,
    abandonedCoP1: (amount: string) =>
      `Je was klaar om <strong style="color:${BRAND_DARK};">${amount}</strong> te doneren om een hond te redden. Maar je betaling werd niet voltooid. Geen zorgen — alles wat je hebt gekozen is nog opgeslagen.`,
    abandonedCoP2: 'Vandaag zijn er <strong>3 honden binnengekomen</strong> die nog niets warm hebben gegeten. Ze kijken naar de deur van het opvangcentrum. Ze wachten op iemand zoals jij.',
    abandonedCoItemLabel: 'In jouw winkelwagen:',
    abandonedCoP3: 'Eén klik op de knop hieronder en je donatie is rond. Geen formulieren, geen nieuwe gegevens — alles staat al klaar.',
    abandonedCoCta: 'Mijn donatie nu afronden →',
    abandonedCoUrgencyNote: '⏰ Deze link is 24 uur geldig. Daarna moet je opnieuw beginnen.',
    abandonedCoFootnote: 'Bancontact, klaar in 30 seconden. Veilige betaling via Shopify.',
    abandonedCoSignoff: 'Hij rekent op jou. Wij ook.',
    abandonedCoHeroAlt: 'Geredde hond wacht op een tweede kans'
  },
  pt: {
    htmlLang: 'pt-BR',
    fallbackName: 'amigo',
    tagline: 'Ajudando cães resgatados na Bélgica',
    footerBrand: 'Belgian Paws Helper · Cuidado com cães resgatados, Bélgica',
    footerSupport: (mail: string) => `Alguma dúvida? Responda direto este e-mail ou escreva para <a href="mailto:${mail}" style="color:${BRAND_DARK};text-decoration:none;">${mail}</a>.`,
    // Thank you
    thankSubject: 'Nós já compramos rações para 3 cães 🐾',
    thankPreview: 'Aqui está uma foto do Max, Luna e do Milo comendo com o dinheiro da sua doação. Clique e veja.',
    thankH1: (name: string) => `Obrigado, ${name}. Você fez a diferença hoje.`,
    thankP1: (amount: string) =>
      `Sua doação de <strong style="color:${BRAND_DARK};">${amount}</strong> já está alimentando alguns dos nossos cães resgatados. Hoje eles comem quentinho e seguro, e isso é graças a você.`,
    thankP2: 'Você foi incrível. Obrigado por nos ajudar — contamos sempre com sua ajuda para dar uma segunda chance a mais cães.',
    thankCta: 'Veja como você pode ajudar mais',
    thankSignoff: 'Com carinho,',
    teamName: 'Equipe Belgian Paws',
    heroAlt: 'Nossos voluntários alimentando cães resgatados hoje',
    // Upsell — 10 caes magros recem resgatados (texto comovente)
    upsellSubject: 'Dez cães faminto acabaram de chegar 🐾',
    upsellPreview: 'Eles foram resgatados, mas precisamos de você pra alimentá-los.',
    upsellH1: (name: string) => `${name}, dez cães precisam de você hoje.`,
    upsellP1: (amount: string) =>
      `Hoje chegaram dez cães extremamente magros no nosso abrigo. Costelas à mostra, olhar perdido — mas conseguimos resgatá-los, graças em parte à sua doação anterior de <strong style="color:${BRAND_DARK};">${amount}</strong>.`,
    upsellP2: 'Agora começa a parte mais difícil: trazê-los de volta à vida. Cada um precisa de água limpa, ração de recuperação de alta qualidade e cuidados veterinários pra ficar em pé de novo.',
    upsellP3: 'Se você puder — nem que seja um pouquinho — topa ajudar de novo? Sem você, eles não conseguem.',
    upsellCta: 'Sim, quero ajudar mais um cão',
    upsellSignoff: 'Do fundo do coração, obrigado.',
    upsellHeroAlt: 'Dez cães faminto recém resgatados pela Dog Paws Shelter',
    // Upsell V2 — 3 botoes ancorados (50/80/100) com missoes tangiveis
    upsellV2Subject: '7 dos 10 cães ainda esperam por um salvador 🐾',
    upsellV2Preview: 'Três já foram salvos por doadores como você. Restam 7. Escolha qual você alimenta hoje.',
    upsellV2H1: (name: string) => `${name}, ainda restam 7 cães com fome.`,
    upsellV2P1: (amount: string) =>
      `Graças à sua doação anterior de <strong style="color:${BRAND_DARK};">${amount}</strong>, conseguimos resgatar 3 dos 10 cães desnutridos que chegaram esta semana. Mas ainda restam 7 com os potes vazios — e estão olhando pra porta, esperando alguém como você.`,
    upsellV2P2: 'Hoje vou te pedir algo concreto: escolha <strong>um cão</strong> e dê a ele uma chance real. Abaixo você vê exatamente o que cada valor faz — sem números arredondados, sem promessas vagas. Missões reais, pra cães reais.',
    upsellV2MissionsTitle: 'Escolha sua missão',
    upsellV2Mission50Title: '€50 — Alimente 1 cão por uma semana inteira',
    upsellV2Mission50Desc: 'Ração de recuperação de alta qualidade, água limpa e abrigo seguro por 7 dias.',
    upsellV2Mission80Badge: 'MAIS ESCOLHIDA',
    upsellV2Mission80Title: '€80 — Alimentação + vacinação para 1 cão',
    upsellV2Mission80Desc: '1 semana de ração + todas as vacinas necessárias pra protegê-lo contra doenças.',
    upsellV2Mission100Title: '€100 — Salve um filhote em estado crítico',
    upsellV2Mission100Desc: 'Atendimento veterinário de emergência, soro e tratamento intensivo pra um filhote que sem ajuda não sobrevive.',
    upsellV2Footnote: 'Cada botão te leva direto pra página de pagamento. Sem cliques extras, sem formulários — Bancontact e pronto.',
    upsellV2Signoff: 'Do fundo do coração, obrigado por voltar.',
    upsellV2HeroAlt: 'Cão resgatado esperando pela refeição no Belgian Paws Shelter',
    // Recovery — paridade com NL (template enviado so em NL atualmente)
    recoverySubject: 'Esta semana outras pessoas ajudaram — você também?',
    recoveryPreview: 'Um último lembrete. Os cães ainda estão esperando.',
    recoveryH1: (name: string) => `${name}, um lembrete rápido.`,
    recoveryP1: (count: string) =>
      `Nos últimos 7 dias, <strong style="color:${BRAND_DARK};">${count} pessoas</strong> doaram pra alimentar nossos cães. Algumas voltaram pela 2ª ou 3ª vez. Outras pela primeira — tocadas pelas mesmas histórias que tocaram você.`,
    recoveryP2: 'Os bowls esvaziam todo dia, e todo dia a gente enche de novo — só por causa de doadores como você.',
    recoveryP3: 'Se sua situação permitir, qualquer valor ajuda demais. A gente não precisa de promessa nenhuma — só da sua ação concreta hoje.',
    recoveryCta: 'Ajudar de novo',
    recoveryFootnote: 'Sem amarras, sem assinatura. Cada doação é única e vai direto pra ração e cuidados.',
    recoverySignoff: 'Obrigado por ainda estar lendo. Isso já diz muita coisa.',
    recoveryHeroAlt: 'Cão do Belgian Paws Shelter esperando os voluntários',
    // Abandoned popup — paridade PT (template enviado so em NL atualmente)
    abandonedSubject: 'Você estava quase pronto pra ajudar 🐾',
    abandonedPreview: 'Você já escolheu o valor. Um clique e sua doação tá pronta.',
    abandonedH1: (name: string) => `${name}, você estava quase lá.`,
    abandonedP1: (amount: string) =>
      `Você escolheu uma doação de <strong style="color:${BRAND_DARK};">${amount}</strong>, mas o pagamento não foi concluído. Sem problemas — tá tudo salvo. Um clique e finaliza.`,
    abandonedP2: 'Cada refeição conta pros nossos cães resgatados. Sua doação faz a diferença hoje.',
    abandonedCta: 'Finalizar minha doação',
    abandonedFootnote: 'Bancontact, pronto. Sem formulário extra.',
    abandonedSignoff: 'Contamos com você.',
    abandonedHeroAlt: 'Cão resgatado esperando sua refeição',
    // Abandoned Shopify CHECKOUT — paridade PT
    abandonedCoSubject: 'Um cão ainda está no seu carrinho 🐾',
    abandonedCoPreview: 'Você estava pronto pra salvá-lo. Ele ainda espera. Um clique e ele come hoje.',
    abandonedCoUrgencyTag: '⚠️ Seu carrinho expira em breve',
    abandonedCoH1: (name: string) => `${name}, ele ainda está esperando por você.`,
    abandonedCoP1: (amount: string) =>
      `Você estava pronto pra doar <strong style="color:${BRAND_DARK};">${amount}</strong> pra salvar um cão. Mas o pagamento não foi concluído. Sem problemas — tudo que você escolheu ainda está salvo.`,
    abandonedCoP2: 'Hoje chegaram <strong>3 cães novos</strong> no abrigo que ainda não comeram nada quente. Estão olhando pra porta. Estão esperando alguém como você.',
    abandonedCoItemLabel: 'No seu carrinho:',
    abandonedCoP3: 'Um clique no botão abaixo e sua doação tá finalizada. Sem formulários, sem dados novos — está tudo pronto.',
    abandonedCoCta: 'Finalizar minha doação agora →',
    abandonedCoUrgencyNote: '⏰ Esse link é válido por 24h. Depois disso, vai precisar começar do zero.',
    abandonedCoFootnote: 'Bancontact, pronto em 30 segundos. Pagamento seguro via Shopify.',
    abandonedCoSignoff: 'Ele conta com você. A gente também.',
    abandonedCoHeroAlt: 'Cão resgatado esperando por uma segunda chance'
  }
} as const;

function resolveLocale(l?: Locale): Locale {
  return l === 'pt' ? 'pt' : 'nl';
}

function header(_locale: Locale): string {
  // Header branco com logo Dog Paws centralizada (substitui texto antigo)
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-bottom:1px solid #f1f5f9;">
      <tr>
        <td align="center" style="padding:28px 16px 24px;">
          <img src="${LOGO_IMAGE}" alt="Belgian Paws" width="220" style="display:block;width:220px;max-width:80%;height:auto;border:0;">
        </td>
      </tr>
    </table>
  `;
}

function footer(locale: Locale): string {
  const t = STR[locale];
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;">
      <tr>
        <td align="center" style="padding:24px 24px 32px;font-family:Arial,Helvetica,sans-serif;color:#64748b;font-size:12px;line-height:1.6;">
          <div style="margin-bottom:8px;">${t.footerBrand}</div>
          <div>${t.footerSupport(SUPPORT_EMAIL)}</div>
          <div style="margin-top:12px;color:#94a3b8;font-size:11px;">
            &copy; ${new Date().getFullYear()} Belgian Paws
          </div>
        </td>
      </tr>
    </table>
  `;
}

function shell(locale: Locale, previewText: string, bodyHtml: string): string {
  const t = STR[locale];
  return `<!doctype html>
<html lang="${t.htmlLang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <title>Belgian Paws</title>
  <style>
    :root { color-scheme: light only; supported-color-schemes: light only; }
    body, table, td { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    img { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; }
    a { color:${BRAND_DARK}; }
    /* Gmail mobile dark mode override (data-ogsc) — for o highlight botao €80 */
    u + .body .force-light-text,
    [data-ogsc] .force-light-text { color:#ffffff !important; }
    [data-ogsc] .force-light-desc { color:#dcfce7 !important; }
    @media (max-width:600px) {
      .container { width:100% !important; }
      .px-mob { padding-left:20px !important; padding-right:20px !important; }
      .h1-mob { font-size:22px !important; line-height:1.3 !important; }
    }
  </style>
</head>
<body class="body" style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;font-size:1px;color:#f1f5f9;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    ${escape(previewText)}
    ${'&#847; &zwnj; &nbsp; '.repeat(120)}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;">
    <tr>
      <td align="center" style="padding:24px 0;">
        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(15,23,42,0.06);">
          <tr><td>${header(locale)}</td></tr>
          <tr><td>${bodyHtml}</td></tr>
          <tr><td>${footer(locale)}</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────
// Template 1 — Thank you (5 min apos compra)
// ─────────────────────────────────────────────────────────────────────

export function thankYouSubject(locale?: Locale): string {
  return STR[resolveLocale(locale)].thankSubject;
}

export function thankYouPreview(locale?: Locale): string {
  return STR[resolveLocale(locale)].thankPreview;
}

export function thankYouHtml(vars: ThankYouVars): string {
  const locale = resolveLocale(vars.locale);
  const t = STR[locale];
  const name = vars.firstName ? escape(vars.firstName) : t.fallbackName;
  const amount = formatAmount(vars.amount, vars.currency, locale);

  const body = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td>
          <img src="${HERO_IMAGE}" alt="${t.heroAlt}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;">
        </td>
      </tr>
      <tr>
        <td class="px-mob" style="padding:32px 40px 8px;">
          <h1 class="h1-mob" style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;font-size:24px;font-weight:700;line-height:1.3;">
            ${t.thankH1(name)}
          </h1>
          <p style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;color:#334155;font-size:16px;line-height:1.65;">
            ${t.thankP1(amount)}
          </p>
          <p style="margin:0 0 32px;font-family:Arial,Helvetica,sans-serif;color:#334155;font-size:16px;line-height:1.65;">
            ${t.thankP2}
          </p>
        </td>
      </tr>
      <tr>
        <td class="px-mob" style="padding:0 40px 32px;">
          <div style="border-top:1px solid #e2e8f0;padding-top:20px;font-family:Arial,Helvetica,sans-serif;color:#475569;font-size:14px;line-height:1.6;">
            ${t.thankSignoff}<br>
            <strong style="color:#0f172a;">${t.teamName}</strong>
          </div>
        </td>
      </tr>
    </table>
  `;

  return shell(locale, t.thankPreview, body);
}

// ─────────────────────────────────────────────────────────────────────
// Template 2 — Upsell (48h apos compra)
// ─────────────────────────────────────────────────────────────────────

export function upsellSubject(locale?: Locale): string {
  return STR[resolveLocale(locale)].upsellSubject;
}

export function upsellPreview(locale?: Locale): string {
  return STR[resolveLocale(locale)].upsellPreview;
}

export function upsellHtml(vars: UpsellVars): string {
  const locale = resolveLocale(vars.locale);
  const t = STR[locale];
  const name = vars.firstName ? escape(vars.firstName) : t.fallbackName;
  const previous = formatAmount(vars.previousAmount, vars.currency, locale);

  const body = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td>
          <img src="${UPSELL_HERO_IMAGE}" alt="${t.upsellHeroAlt}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;">
        </td>
      </tr>
      <tr>
        <td class="px-mob" style="padding:32px 40px 8px;">
          <h1 class="h1-mob" style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;font-size:24px;font-weight:700;line-height:1.3;">
            ${t.upsellH1(name)}
          </h1>
          <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;color:#334155;font-size:16px;line-height:1.65;">
            ${t.upsellP1(previous)}
          </p>
          <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;color:#334155;font-size:16px;line-height:1.65;">
            ${t.upsellP2}
          </p>
          <p style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;color:#334155;font-size:16px;line-height:1.65;">
            ${t.upsellP3}
          </p>
        </td>
      </tr>
      <tr>
        <td class="px-mob" align="center" style="padding:0 40px 32px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td bgcolor="${BRAND_COLOR}" style="border-radius:8px;">
                <a href="${UPSELL_DONATE_URL}" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">
                  ${t.upsellCta}
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td class="px-mob" style="padding:0 40px 32px;">
          <div style="border-top:1px solid #e2e8f0;padding-top:20px;font-family:Arial,Helvetica,sans-serif;color:#475569;font-size:14px;line-height:1.6;">
            ${t.upsellSignoff}<br>
            <strong style="color:#0f172a;">${t.teamName}</strong>
          </div>
        </td>
      </tr>
    </table>
  `;

  return shell(locale, t.upsellPreview, body);
}

// ─────────────────────────────────────────────────────────────────────
// Template 3 — Upsell V2 (3 botoes ancorados em 50/80/100, checkout direto)
// ─────────────────────────────────────────────────────────────────────

const SHOPIFY_CART_DOMAIN = 'inigualavelshop.myshopify.com';
const VARIANT_50 = '49473431208074';   // Hero
const VARIANT_80 = '49473431240842';   // Champion
const VARIANT_100 = '49473431273610';  // Protector

function checkoutUrl(variantId: string, missionTag: string, recipientEmail?: string): string {
  const params: Record<string, string> = {
    utm_source: 'email',
    utm_medium: 'upsell-v2',
    utm_campaign: '48h',
    utm_content: missionTag,
    'attributes[utm_source]': 'email',
    'attributes[utm_medium]': 'upsell-v2',
    'attributes[utm_campaign]': '48h',
    'attributes[utm_content]': missionTag
  };
  // Pre-preenche email no Shopify checkout — reduz friction pra repeat purchase
  if (recipientEmail && /\S+@\S+\.\S+/.test(recipientEmail)) {
    params['checkout[email]'] = recipientEmail;
  }
  return `https://${SHOPIFY_CART_DOMAIN}/cart/${variantId}:1?${new URLSearchParams(params).toString()}`;
}

export function upsellV2Subject(locale?: Locale): string {
  return STR[resolveLocale(locale)].upsellV2Subject;
}

export function upsellV2Preview(locale?: Locale): string {
  return STR[resolveLocale(locale)].upsellV2Preview;
}

export function upsellV2Html(vars: UpsellV2Vars): string {
  const locale = resolveLocale(vars.locale);
  const t = STR[locale];
  const name = vars.firstName ? escape(vars.firstName) : t.fallbackName;
  const previous = formatAmount(vars.previousAmount, vars.currency, locale);

  const url50 = checkoutUrl(VARIANT_50, 'mission-50', vars.recipientEmail);
  const url80 = checkoutUrl(VARIANT_80, 'mission-80', vars.recipientEmail);
  const url100 = checkoutUrl(VARIANT_100, 'mission-100', vars.recipientEmail);

  const missionButton = (opts: {
    href: string;
    badge?: string;
    title: string;
    desc: string;
    highlight: boolean;
  }) => {
    const bg = opts.highlight ? BRAND_COLOR : '#ffffff';
    const border = opts.highlight ? BRAND_COLOR : '#e2e8f0';
    const titleColor = opts.highlight ? '#ffffff' : '#0f172a';
    const descColor = opts.highlight ? '#dcfce7' : '#475569';
    const badgeBg = opts.highlight ? '#15803d' : BRAND_COLOR;
    return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px;">
        <tr>
          <td bgcolor="${bg}" style="border:2px solid ${border};border-radius:12px;padding:0;">
            <a href="${opts.href}" target="_blank" style="display:block;padding:18px 20px;text-decoration:none !important;color:${titleColor} !important;font-family:Arial,Helvetica,sans-serif;">
              ${opts.badge ? `
                <div style="display:inline-block;background:${badgeBg};color:#ffffff !important;font-size:10px;font-weight:700;letter-spacing:0.08em;padding:3px 9px;border-radius:999px;margin-bottom:8px;">
                  <font color="#ffffff"><span class="${opts.highlight ? 'force-light-text' : ''}" style="color:#ffffff !important;">${escape(opts.badge)}</span></font>
                </div>
              ` : ''}
              <div style="font-size:17px;font-weight:700;line-height:1.35;margin-bottom:6px;color:${titleColor} !important;">
                <font color="${titleColor}"><span class="${opts.highlight ? 'force-light-text' : ''}" style="color:${titleColor} !important;">${escape(opts.title)}</span></font>
              </div>
              <div style="font-size:13px;line-height:1.5;color:${descColor} !important;">
                <font color="${descColor}"><span class="${opts.highlight ? 'force-light-desc' : ''}" style="color:${descColor} !important;">${escape(opts.desc)}</span></font>
              </div>
            </a>
          </td>
        </tr>
      </table>
    `;
  };

  const body = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td>
          <img src="${UPSELL_HERO_IMAGE}" alt="${t.upsellV2HeroAlt}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;">
        </td>
      </tr>
      <tr>
        <td class="px-mob" style="padding:32px 40px 8px;">
          <h1 class="h1-mob" style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;font-size:24px;font-weight:700;line-height:1.3;">
            ${t.upsellV2H1(name)}
          </h1>
          <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;color:#334155;font-size:16px;line-height:1.65;">
            ${t.upsellV2P1(previous)}
          </p>
          <p style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;color:#334155;font-size:16px;line-height:1.65;">
            ${t.upsellV2P2}
          </p>
        </td>
      </tr>
      <tr>
        <td class="px-mob" style="padding:0 40px 8px;">
          <div style="font-family:Arial,Helvetica,sans-serif;color:#64748b;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:14px;">
            ${t.upsellV2MissionsTitle}
          </div>
          ${missionButton({
            href: url50,
            title: t.upsellV2Mission50Title,
            desc: t.upsellV2Mission50Desc,
            highlight: false
          })}
          ${missionButton({
            href: url80,
            badge: t.upsellV2Mission80Badge,
            title: t.upsellV2Mission80Title,
            desc: t.upsellV2Mission80Desc,
            highlight: true
          })}
          ${missionButton({
            href: url100,
            title: t.upsellV2Mission100Title,
            desc: t.upsellV2Mission100Desc,
            highlight: false
          })}
        </td>
      </tr>
      <tr>
        <td class="px-mob" style="padding:8px 40px 24px;">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;color:#94a3b8;font-size:12px;line-height:1.6;font-style:italic;">
            ${t.upsellV2Footnote}
          </p>
        </td>
      </tr>
      <tr>
        <td class="px-mob" style="padding:0 40px 32px;">
          <div style="border-top:1px solid #e2e8f0;padding-top:20px;font-family:Arial,Helvetica,sans-serif;color:#475569;font-size:14px;line-height:1.6;">
            ${t.upsellV2Signoff}<br>
            <strong style="color:#0f172a;">${t.teamName}</strong>
          </div>
        </td>
      </tr>
    </table>
  `;

  return shell(locale, t.upsellV2Preview, body);
}

// ─────────────────────────────────────────────────────────────────────
// Template 4 — Recovery (7 dias apos compra; pra quem ignorou o upsell-v2)
// ─────────────────────────────────────────────────────────────────────

const RECOVERY_DONATE_URL = `${SITE_URL}/donate?utm_source=email&utm_medium=recovery&utm_campaign=7d`;

export function recoverySubject(locale?: Locale): string {
  return STR[resolveLocale(locale)].recoverySubject;
}

export function recoveryPreview(locale?: Locale): string {
  return STR[resolveLocale(locale)].recoveryPreview;
}

export function recoveryHtml(vars: RecoveryVars): string {
  const locale = resolveLocale(vars.locale);
  const t = STR[locale];
  const name = vars.firstName ? escape(vars.firstName) : t.fallbackName;
  // Fallback se contagem real for muito baixa (recem-deployado) — mantem copy plausivel
  const rawCount = vars.recentDonorsCount ?? 0;
  const countStr = rawCount >= 10 ? String(rawCount) : (locale === 'pt' ? 'dezenas de' : 'tientallen');

  const body = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td>
          <img src="${UPSELL_HERO_IMAGE}" alt="${t.recoveryHeroAlt}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;">
        </td>
      </tr>
      <tr>
        <td class="px-mob" style="padding:32px 40px 8px;">
          <h1 class="h1-mob" style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;font-size:24px;font-weight:700;line-height:1.3;">
            ${t.recoveryH1(name)}
          </h1>
          <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;color:#334155;font-size:16px;line-height:1.65;">
            ${t.recoveryP1(countStr)}
          </p>
          <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;color:#334155;font-size:16px;line-height:1.65;">
            ${t.recoveryP2}
          </p>
          <p style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;color:#334155;font-size:16px;line-height:1.65;">
            ${t.recoveryP3}
          </p>
        </td>
      </tr>
      <tr>
        <td class="px-mob" align="center" style="padding:8px 40px 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
            <tr>
              <td bgcolor="${BRAND_COLOR}" style="border-radius:8px;">
                <a href="${RECOVERY_DONATE_URL}" target="_blank" style="display:inline-block;padding:14px 36px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;color:#ffffff !important;text-decoration:none !important;border-radius:8px;">
                  <font color="#ffffff">${t.recoveryCta}</font>
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td class="px-mob" style="padding:0 40px 16px;">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;color:#94a3b8;font-size:12px;line-height:1.6;font-style:italic;text-align:center;">
            ${t.recoveryFootnote}
          </p>
        </td>
      </tr>
      <tr>
        <td class="px-mob" style="padding:0 40px 32px;">
          <div style="border-top:1px solid #e2e8f0;padding-top:20px;font-family:Arial,Helvetica,sans-serif;color:#475569;font-size:14px;line-height:1.6;">
            ${t.recoverySignoff}<br>
            <strong style="color:#0f172a;">${t.teamName}</strong>
          </div>
        </td>
      </tr>
    </table>
  `;

  return shell(locale, t.recoveryPreview, body);
}

// ─────────────────────────────────────────────────────────────────────
// Template 5 — Abandoned popup (1h apos popup do /donate sem compra)
// ─────────────────────────────────────────────────────────────────────

export function abandonedSubject(locale?: Locale): string {
  return STR[resolveLocale(locale)].abandonedSubject;
}

export function abandonedPreview(locale?: Locale): string {
  return STR[resolveLocale(locale)].abandonedPreview;
}

export function abandonedHtml(vars: AbandonedPopupVars): string {
  const locale = resolveLocale(vars.locale);
  const t = STR[locale];
  const name = vars.firstName ? escape(vars.firstName) : t.fallbackName;
  const amount = formatAmount(vars.amount, 'EUR', locale);

  // Link direto pro /donate com valor pre-selecionado + email pre-preenchido
  const params = new URLSearchParams({
    utm_source: 'email',
    utm_medium: 'abandoned-popup',
    utm_campaign: 'recovery-1h',
    amount: String(vars.amount)
  });
  if (vars.recipientEmail && /\S+@\S+\.\S+/.test(vars.recipientEmail)) {
    params.set('email', vars.recipientEmail);
  }
  const url = `${SITE_URL}/donate?${params.toString()}`;

  const body = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td>
          <img src="${UPSELL_HERO_IMAGE}" alt="${t.abandonedHeroAlt}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;">
        </td>
      </tr>
      <tr>
        <td class="px-mob" style="padding:32px 40px 8px;">
          <h1 class="h1-mob" style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;font-size:24px;font-weight:700;line-height:1.3;">
            ${t.abandonedH1(name)}
          </h1>
          <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;color:#334155;font-size:16px;line-height:1.65;">
            ${t.abandonedP1(amount)}
          </p>
          <p style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;color:#334155;font-size:16px;line-height:1.65;">
            ${t.abandonedP2}
          </p>
        </td>
      </tr>
      <tr>
        <td class="px-mob" align="center" style="padding:8px 40px 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
            <tr>
              <td bgcolor="${BRAND_COLOR}" style="border-radius:8px;">
                <a href="${url}" target="_blank" style="display:inline-block;padding:14px 36px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;color:#ffffff !important;text-decoration:none !important;border-radius:8px;">
                  <font color="#ffffff">${t.abandonedCta}</font>
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td class="px-mob" style="padding:0 40px 16px;">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;color:#94a3b8;font-size:12px;line-height:1.6;font-style:italic;text-align:center;">
            ${t.abandonedFootnote}
          </p>
        </td>
      </tr>
      <tr>
        <td class="px-mob" style="padding:0 40px 32px;">
          <div style="border-top:1px solid #e2e8f0;padding-top:20px;font-family:Arial,Helvetica,sans-serif;color:#475569;font-size:14px;line-height:1.6;">
            ${t.abandonedSignoff}<br>
            <strong style="color:#0f172a;">${t.teamName}</strong>
          </div>
        </td>
      </tr>
    </table>
  `;

  return shell(locale, t.abandonedPreview, body);
}

// ─────────────────────────────────────────────────────────────────────
// Template 6 — Abandoned Shopify Checkout (10min apos abandono — webhook Shopify)
// ─────────────────────────────────────────────────────────────────────

export function abandonedCheckoutSubject(locale?: Locale): string {
  return STR[resolveLocale(locale)].abandonedCoSubject;
}

export function abandonedCheckoutPreview(locale?: Locale): string {
  return STR[resolveLocale(locale)].abandonedCoPreview;
}

export function abandonedCheckoutHtml(vars: AbandonedCheckoutVars): string {
  const locale = resolveLocale(vars.locale);
  const t = STR[locale];
  const name = vars.firstName ? escape(vars.firstName) : t.fallbackName;
  const amount = formatAmount(vars.amount, vars.currency || 'EUR', locale);

  // Adiciona UTM ao link de recuperacao Shopify pra rastrear conversao deste email
  let recoverUrl = vars.recoverUrl;
  try {
    const u = new URL(vars.recoverUrl);
    u.searchParams.set('utm_source', 'email');
    u.searchParams.set('utm_medium', 'abandoned-checkout');
    u.searchParams.set('utm_campaign', 'recovery-10min');
    recoverUrl = u.toString();
  } catch {
    // se url invalida, usa raw mesmo
  }

  const itemRow = vars.itemTitle
    ? `
      <tr>
        <td class="px-mob" style="padding:0 40px 16px;">
          <div style="background:#f8fafc;border-left:4px solid ${BRAND_COLOR};padding:14px 18px;border-radius:6px;">
            <div style="font-family:Arial,Helvetica,sans-serif;color:#64748b;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:4px;">
              ${t.abandonedCoItemLabel}
            </div>
            <div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;font-size:15px;font-weight:600;line-height:1.4;">
              ${escape(vars.itemTitle)}
            </div>
          </div>
        </td>
      </tr>
    `
    : '';

  const body = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td>
          <img src="${ABANDONED_CHECKOUT_HERO_IMAGE}" alt="${t.abandonedCoHeroAlt}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;">
        </td>
      </tr>
      <tr>
        <td class="px-mob" style="padding:24px 40px 0;">
          <div style="display:inline-block;background:#fef2f2;color:#b91c1c;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.04em;padding:6px 12px;border-radius:999px;">
            ${t.abandonedCoUrgencyTag}
          </div>
        </td>
      </tr>
      <tr>
        <td class="px-mob" style="padding:16px 40px 8px;">
          <h1 class="h1-mob" style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;font-size:26px;font-weight:800;line-height:1.25;">
            ${t.abandonedCoH1(name)}
          </h1>
          <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;color:#334155;font-size:16px;line-height:1.65;">
            ${t.abandonedCoP1(amount)}
          </p>
          <p style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;color:#334155;font-size:16px;line-height:1.65;">
            ${t.abandonedCoP2}
          </p>
        </td>
      </tr>
      ${itemRow}
      <tr>
        <td class="px-mob" style="padding:8px 40px 16px;">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;color:#334155;font-size:16px;line-height:1.65;">
            ${t.abandonedCoP3}
          </p>
        </td>
      </tr>
      <tr>
        <td class="px-mob" align="center" style="padding:8px 40px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
            <tr>
              <td bgcolor="${BRAND_COLOR}" style="border-radius:10px;box-shadow:0 4px 12px rgba(22,163,74,0.3);">
                <a href="${recoverUrl}" target="_blank" style="display:inline-block;padding:18px 44px;font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:800;color:#ffffff !important;text-decoration:none !important;border-radius:10px;letter-spacing:0.01em;">
                  <font color="#ffffff">${t.abandonedCoCta}</font>
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td class="px-mob" align="center" style="padding:0 40px 8px;">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;color:#b91c1c;font-size:13px;font-weight:600;line-height:1.5;text-align:center;">
            ${t.abandonedCoUrgencyNote}
          </p>
        </td>
      </tr>
      <tr>
        <td class="px-mob" style="padding:8px 40px 16px;">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;color:#94a3b8;font-size:12px;line-height:1.6;font-style:italic;text-align:center;">
            ${t.abandonedCoFootnote}
          </p>
        </td>
      </tr>
      <tr>
        <td class="px-mob" style="padding:0 40px 32px;">
          <div style="border-top:1px solid #e2e8f0;padding-top:20px;font-family:Arial,Helvetica,sans-serif;color:#475569;font-size:14px;line-height:1.6;">
            ${t.abandonedCoSignoff}<br>
            <strong style="color:#0f172a;">${t.teamName}</strong>
          </div>
        </td>
      </tr>
    </table>
  `;

  return shell(locale, t.abandonedCoPreview, body);
}
