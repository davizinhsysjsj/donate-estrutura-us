/**
 * Templates HTML dos emails transacionais.
 *
 * Suporta locale 'nl' (producao, default) e 'pt' (testes/QA).
 *
 * Logo: header verde escuro (cor da camisa "Dog Paws Shelter" da foto)
 * com texto "BELGIAN PAWS" + patinha 🐾.
 *
 * Imagem: hospedada em https://belgianpawsfoundation.org/email/feeding-dogs.jpg
 */

const SITE_URL = 'https://belgianpawsfoundation.org';
const DONATE_URL = `${SITE_URL}/`;
const UPSELL_DONATE_URL = `${SITE_URL}/donate?utm_source=email&utm_medium=recompra&utm_campaign=48h`;
const HERO_IMAGE = `${SITE_URL}/lina/lina-mae-beijo.webp`;
const UPSELL_HERO_IMAGE = `${SITE_URL}/lina/lina-dormindo.webp`;
const ABANDONED_CHECKOUT_HERO_IMAGE = `${SITE_URL}/lina/lina-ursinho.webp`;
const LOGO_IMAGE = `${SITE_URL}/email/logo.png`;
const SUPPORT_EMAIL = 'contact@belgiancarestore.com';
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
    tagline: 'Steun Lina — 7 jaar, botkanker',
    footerBrand: 'Actie Lina · Steun voor Belgische kinderen met kanker',
    footerSupport: (mail: string) => `Heb je een vraag? Antwoord direct op deze e-mail of mail naar <a href="mailto:${mail}" style="color:${BRAND_DARK};text-decoration:none;">${mail}</a>.`,
    // Thank you — 1u na donatie. Bevestiging dat de donatie direct naar Lina's behandeling gaat.
    thankSubject: 'Lina heeft uw hulp ontvangen 🤍',
    thankPreview: 'Vandaag begon haar eerste chemo. Uw naam staat op haar dossier.',
    thankH1: (name: string) => `Bedankt, ${name}. Lina begon vandaag aan haar behandeling — dankzij u.`,
    thankP1: (amount: string) =>
      `Uw donatie van <strong style="color:${BRAND_DARK};">${amount}</strong> ging rechtstreeks naar Lina's eerste chemo-sessie: pijnstilling, anti-emetica, en het bed op de kinderoncologie-afdeling waar ze vannacht slaapt. Haar moeder huilde toen ze het nieuws hoorde.`,
    thankP2: 'De operatie aan haar rechterdijbeen staat gepland op 11 augustus. Tot dan moet ze 3 rondes chemo doorstaan om de tumor te verkleinen. Uw bijdrage betaalt letterlijk haar eerste ronde. We sturen u updates zodra ze op de operatietafel ligt.',
    thankCta: 'Volg Lina\'s voortgang',
    thankSignoff: 'Met warme groet,',
    teamName: 'Familie & Support-team Lina',
    heroAlt: 'Lina wordt gekust door haar moeder op de kinderoncologie',
    // Upsell legacy (simples) — Lina · infectie na chemo
    upsellSubject: 'Lina heeft koorts. De chemo heeft haar afweer gebroken 🤍',
    upsellPreview: 'Neutropene infectie sinds gisternacht. Zonder immunoglobuline wordt de operatie geannuleerd.',
    upsellH1: (name: string) => `${name}, Lina ligt op de ISO-kamer. Ze heeft u opnieuw nodig.`,
    upsellP1: (amount: string) =>
      `Uw donatie van <strong style="color:${BRAND_DARK};">${amount}</strong> betaalde 5 dagen geleden haar eerste chemo. Het werkte — de tumor kromp met 8%. Maar de chemo brak ook haar afweer: gisternacht 39,8°C koorts, bloedkweek positief. Neutropene sepsis in vroeg stadium.`,
    upsellP2: 'Haar behandelend kinderoncoloog heeft immunoglobuline IV voorgeschreven — €4.200 per behandeling, niet volledig terugbetaald door de ziekteverzekering. Zonder deze behandeling stopt de chemo en verplaatst de operatie van 11 augustus. Elke week uitstel verdubbelt het risico op longmetastase.',
    upsellP3: 'Als u opnieuw kunt — al is het €5 — komen we dichter bij haar redding. Haar ouders hebben letterlijk niets meer om te verkopen.',
    upsellCta: 'Ja, ik help Lina opnieuw',
    upsellSignoff: 'Uit de grond van ons hart, bedankt.',
    upsellHeroAlt: 'Lina slaapt op de ISO-kamer met infuus',
    // Upsell V2 (48u, AGRESSIEF) — loss aversion + countdown
    upsellV2Subject: 'Lina heeft 72 uur. Zonder immunoglobuline: operatie geannuleerd.',
    upsellV2Preview: 'Uw donatie kocht haar eerste chemo. Vanavond beslist u of ze de tweede haalt — of dat haar longen de tumor krijgen.',
    upsellV2H1: (name: string) => `${name}, zonder uw 2de donatie wordt Lina's operatie afgezegd.`,
    upsellV2P1: (amount: string) =>
      `48 uur geleden gaf u <strong style="color:${BRAND_DARK};">${amount}</strong> voor Lina's eerste chemo. Het werkte: de tumor kromp met 8%. Maar er is een tegenslag. Vanochtend 03:14 kreeg ze 40,1°C koorts. Bloedkweek: positief voor een agressieve bacteriële infectie. Ze is nu op de ISO-kamer met breedspectrum-antibiotica.`,
    upsellV2P2: 'Haar behandelend kinderoncoloog heeft <strong>immunoglobuline IV</strong> voorgeschreven — €4.200 per week, 3 weken lang. De ziekteverzekering dekt €900 per week. Er blijft <strong>€9.900</strong> over. Zonder deze behandeling stopt de chemo en wordt de operatie van 11 augustus geannuleerd. Daarna verspreidt de tumor zich naar haar longen. Dat is geen dreiging — dat staat op haar radiologisch verslag.',
    upsellV2MissionsTitle: 'Wat redt u vanavond?',
    upsellV2Mission25Title: '€25 — 1 dag pijnstilling + isolatie-zorg',
    upsellV2Mission25Desc: 'Paracetamol IV + hepafilter-masker + ISO-kamer voor 24u. Ze slaapt vannacht zonder pijn. Eén dag dichter bij de tweede chemo.',
    upsellV2Mission50Title: '€50 — 1 dag antibiotica breedspectrum',
    upsellV2Mission50Desc: 'Breedspectrum-antibiotica IV — de behandeling die de infectie aanpakt vóór het naar haar longen gaat. 24u dat haar koorts daalt.',
    upsellV2Mission100Badge: 'BESLISSEND',
    upsellV2Mission100Title: '€100 — Halve dosis immunoglobuline',
    upsellV2Mission100Desc: 'Met €100 dekt u de helft van 1 dagsdosis IVIG. Vermenigvuldigt met andere donateurs = de operatie blijft op 11 augustus staan. Uw naam staat in haar dossier.',
    upsellV2Mission300Title: '€300 — 1 volledige dag immunoglobuline IV',
    upsellV2Mission300Desc: 'U betaalt een volledige dagsdosis IVIG in één keer. Haar afweer herstelt zich binnen 24u. De chemo van maandag gaat door. De operatie blijft staan. Lina leeft door u. Letterlijk.',
    upsellV2Footnote: 'Elke knop brengt u direct naar betalen. Bancontact, 30 seconden, klaar. Geen formulieren. Alle donaties gaan rechtstreeks naar de behandelrekening op naam van Lina.',
    upsellV2Signoff: 'Ze rekent op u. Letterlijk.',
    upsellV2HeroAlt: 'Lina slaapt met infuus op de kinderoncologie-ISO-kamer',
    // Recovery — 7 dias. Lina overleeft de infectie + operatie is bevestigd.
    recoverySubject: 'Lina overleefde de sepsis. De operatie gaat door.',
    recoveryPreview: 'Dankzij donateurs zoals u. Maar ze heeft nog één laatste hindernis.',
    recoveryH1: (name: string) => `${name}, Lina overleefde — dankzij u.`,
    recoveryP1: (count: string) =>
      `Vanochtend werd haar bloed opnieuw afgenomen. De bacteriële infectie is negatief. Haar koorts is weg. Ze at vandaag zelf een bord soep. Dat is dankzij <strong style="color:${BRAND_DARK};">${count} donateurs</strong> zoals u die de laatste 7 dagen samen de immunoglobuline betaalden.`,
    recoveryP2: 'Maar er is één laatste hindernis: de operatie van 11 augustus kost €7.800 die nog steeds ontbreekt. Prothese, chirurgen-team, revalidatie. Haar vader werkt nu 60 uur per week in de garage. Haar moeder heeft haar zilveren communie-armband verkocht. Ze hebben letterlijk niets meer.',
    recoveryP3: 'Als u ons weer kunt helpen — al is het €5 — brengt u Lina op 11 augustus op de operatietafel. Zonder die operatie verspreidt de tumor zich alsnog. Uw eerdere donatie was geen einde — het was een begin.',
    recoveryCta: 'Breng Lina naar de operatietafel',
    recoveryFootnote: 'Geen abonnementen, geen verplichtingen. Elke donatie is eenmalig en gaat direct naar de behandelrekening op naam van Lina.',
    recoverySignoff: 'Met diepe dank dat u nog hier bent.',
    recoveryHeroAlt: 'Lina zit rechtop in bed met haar knuffel na de infectie',
    // Abandoned popup (1u na popup zonder afronding)
    abandonedSubject: 'U was bijna Lina\'s redder 🤍',
    abandonedPreview: 'U had het bedrag al gekozen. Eén klik en Lina krijgt haar immunoglobuline.',
    abandonedH1: (name: string) => `${name}, u was er bijna.`,
    abandonedP1: (amount: string) =>
      `U koos een donatie van <strong style="color:${BRAND_DARK};">${amount}</strong> voor Lina's immunoglobuline, maar de betaling werd niet afgerond. Geen zorgen — alles is bewaard. Eén klik en u sluit het af.`,
    abandonedP2: 'Haar koorts blijft schommelen tussen 39,4°C en 40,2°C. Elk uur zonder IVIG maakt de infectie moeilijker te behandelen. Uw donatie maakt dat verschil — vandaag, niet morgen.',
    abandonedCta: 'Mijn donatie voor Lina afronden',
    abandonedFootnote: 'Bancontact, klaar. Geen extra formulieren.',
    abandonedSignoff: 'Ze rekent op u.',
    abandonedHeroAlt: 'Lina op de ISO-kamer wachtend op immunoglobuline',
    // Abandoned Shopify checkout (10min)
    abandonedCoSubject: 'Lina\'s immunoglobuline zit nog in uw winkelwagen 🤍',
    abandonedCoPreview: 'U was klaar om haar te redden. De klok tikt. Eén klik en de infectie stopt.',
    abandonedCoUrgencyTag: '⚠️ Lina\'s koorts blijft stijgen',
    abandonedCoH1: (name: string) => `${name}, Lina wacht nog steeds op u.`,
    abandonedCoP1: (amount: string) =>
      `U was klaar om <strong style="color:${BRAND_DARK};">${amount}</strong> te doneren voor Lina's immunoglobuline. Maar de betaling werd niet voltooid. Geen zorgen — alles wat u heeft gekozen is nog opgeslagen.`,
    abandonedCoP2: 'In de tijd dat u afhaakte hebben <strong>andere donateurs verder geholpen</strong>. Maar er is nog steeds een tekort om de €4.200 IVIG-dosis van deze week rond te krijgen — en haar koorts schommelt nog steeds boven 39°C. U was bijna degene die het verschil maakte.',
    abandonedCoItemLabel: 'In uw winkelwagen:',
    abandonedCoP3: 'Eén klik op de knop hieronder en uw donatie is rond. Geen formulieren, geen nieuwe gegevens — alles staat klaar.',
    abandonedCoCta: 'Mijn donatie voor Lina afronden →',
    abandonedCoUrgencyNote: '⏰ Deze link is 24 uur geldig. Daarna moet u opnieuw beginnen.',
    abandonedCoFootnote: 'Bancontact, klaar in 30 seconden. Veilige betaling via Shopify.',
    abandonedCoSignoff: 'Ze rekent op u. Wij ook.',
    abandonedCoHeroAlt: 'Lina met haar knuffel op de kinderoncologie-afdeling'
  },
  pt: {
    htmlLang: 'pt-BR',
    fallbackName: 'amigo',
    tagline: 'Apoie Lina — 7 anos, câncer no osso',
    footerBrand: 'Ação Lina · Apoio a crianças belgas com câncer',
    footerSupport: (mail: string) => `Alguma dúvida? Responda direto este e-mail ou escreva para <a href="mailto:${mail}" style="color:${BRAND_DARK};text-decoration:none;">${mail}</a>.`,
    // Thank you
    thankSubject: 'Lina recebeu sua ajuda 🤍',
    thankPreview: 'Hoje começou a primeira quimio dela. Seu nome está no prontuário.',
    thankH1: (name: string) => `Obrigado, ${name}. Lina começou o tratamento hoje — graças a você.`,
    thankP1: (amount: string) =>
      `Sua doação de <strong style="color:${BRAND_DARK};">${amount}</strong> foi direto pra primeira sessão de quimio da Lina: analgésico, antiemético e a cama na oncologia pediátrica onde ela dorme essa noite. A mãe dela chorou quando soube da notícia.`,
    thankP2: 'A cirurgia no fêmur direito está marcada pra 11 de agosto. Até lá ela precisa fazer 3 rodadas de quimio pra diminuir o tumor. Sua doação paga literalmente a primeira rodada. Vamos te avisar quando ela subir na mesa.',
    thankCta: 'Acompanhar Lina',
    thankSignoff: 'Com carinho,',
    teamName: 'Família & Equipe de apoio da Lina',
    heroAlt: 'Lina sendo beijada pela mãe na oncologia pediátrica',
    // Upsell legacy — Lina infecção
    upsellSubject: 'Lina está com febre. A quimio derrubou a imunidade dela 🤍',
    upsellPreview: 'Infecção neutropênica desde ontem à noite. Sem imunoglobulina, a cirurgia é cancelada.',
    upsellH1: (name: string) => `${name}, Lina tá no isolamento. Ela precisa de você de novo.`,
    upsellP1: (amount: string) =>
      `Sua doação de <strong style="color:${BRAND_DARK};">${amount}</strong> pagou a primeira quimio dela 5 dias atrás. Funcionou — o tumor encolheu 8%. Mas a quimio também derrubou a imunidade: ontem à noite 39,8°C de febre, hemocultura positiva. Sepse neutropênica em fase inicial.`,
    upsellP2: 'O oncologista pediátrico dela prescreveu imunoglobulina IV — €4.200 por semana, sem cobertura total do plano de saúde. Sem esse tratamento, a quimio para e a cirurgia de 11 de agosto é adiada. Cada semana de atraso dobra o risco de metástase pulmonar.',
    upsellP3: 'Se você puder ajudar de novo — nem que seja €5 — a gente chega mais perto de salvá-la. Os pais dela literalmente já venderam tudo que tinham.',
    upsellCta: 'Sim, quero ajudar Lina de novo',
    upsellSignoff: 'Do fundo do coração, obrigado.',
    upsellHeroAlt: 'Lina dormindo no isolamento com soro',
    // Upsell V2 (48h, agressivo) — Lina · sepse
    upsellV2Subject: 'Lina tem 72 horas. Sem imunoglobulina: cirurgia cancelada.',
    upsellV2Preview: 'Sua doação pagou a 1ª quimio. Hoje à noite você decide se ela chega na 2ª — ou se o tumor vai pros pulmões.',
    upsellV2H1: (name: string) => `${name}, sem sua 2ª doação a cirurgia da Lina é cancelada.`,
    upsellV2P1: (amount: string) =>
      `48 horas atrás você deu <strong style="color:${BRAND_DARK};">${amount}</strong> pra primeira quimio da Lina. Funcionou: o tumor encolheu 8%. Mas veio um problema. Hoje às 03:14 ela chegou a 40,1°C. Hemocultura: positiva pra uma infecção bacteriana agressiva. Ela tá agora no quarto de isolamento com antibiótico de amplo espectro.`,
    upsellV2P2: 'O oncologista pediátrico dela prescreveu <strong>imunoglobulina IV</strong> — €4.200 por semana, por 3 semanas. O plano de saúde cobre €900 por semana. Sobra <strong>€9.900</strong>. Sem esse tratamento a quimio para e a cirurgia de 11 de agosto é cancelada. Depois disso o tumor se espalha pros pulmões dela. Não é ameaça — está no laudo radiológico.',
    upsellV2MissionsTitle: 'O que você salva hoje à noite?',
    upsellV2Mission25Title: '€25 — 1 dia de analgésico + isolamento',
    upsellV2Mission25Desc: 'Paracetamol IV + máscara HEPA + quarto de isolamento por 24h. Ela dorme sem dor essa noite. 1 dia mais perto da 2ª quimio.',
    upsellV2Mission50Title: '€50 — 1 dia de antibiótico amplo espectro',
    upsellV2Mission50Desc: 'Antibiótico de amplo espectro IV — o tratamento que ataca a infecção antes dela chegar nos pulmões. 24h de febre caindo.',
    upsellV2Mission100Badge: 'DECISIVA',
    upsellV2Mission100Title: '€100 — Meia dose de imunoglobulina',
    upsellV2Mission100Desc: 'Com €100 você cobre metade de 1 dose diária de IVIG. Somando com outros doadores = cirurgia mantida em 11 de agosto. Seu nome no prontuário dela.',
    upsellV2Mission300Title: '€300 — 1 dia inteiro de imunoglobulina IV',
    upsellV2Mission300Desc: 'Você paga uma dose diária inteira de IVIG. Imunidade dela se recupera em 24h. A quimio de segunda acontece. A cirurgia fica de pé. Lina vive por você. Literalmente.',
    upsellV2Footnote: 'Cada botão te leva direto pro pagamento. Bancontact, 30 segundos, pronto. Sem formulário. Todas as doações vão pra conta de tratamento no nome da Lina.',
    upsellV2Signoff: 'Ela conta com você. Literalmente.',
    upsellV2HeroAlt: 'Lina dormindo no isolamento da oncologia pediátrica',
    // Recovery
    recoverySubject: 'Lina venceu a sepse. A cirurgia vai acontecer.',
    recoveryPreview: 'Graças a doadores como você. Mas ainda falta um último obstáculo.',
    recoveryH1: (name: string) => `${name}, Lina sobreviveu — graças a você.`,
    recoveryP1: (count: string) =>
      `Hoje de manhã colheram o sangue dela de novo. A infecção bacteriana está negativa. A febre passou. Ela comeu uma tigela de sopa sozinha hoje. Isso é graças a <strong style="color:${BRAND_DARK};">${count} doadores</strong> como você que nos últimos 7 dias pagaram juntos a imunoglobulina.`,
    recoveryP2: 'Mas tem um último obstáculo: a cirurgia de 11 de agosto custa €7.800 que ainda faltam. Prótese, equipe cirúrgica, reabilitação. O pai dela agora trabalha 60h por semana na oficina. A mãe vendeu a pulseira de prata da primeira comunhão. Eles literalmente já não têm mais nada.',
    recoveryP3: 'Se você puder ajudar de novo — nem que seja €5 — você leva a Lina pra mesa de cirurgia no dia 11. Sem essa cirurgia, o tumor se espalha mesmo assim. Sua doação anterior não foi o fim — foi só o começo.',
    recoveryCta: 'Leve Lina pra mesa de cirurgia',
    recoveryFootnote: 'Sem assinatura, sem amarra. Cada doação é única e vai direto pra conta de tratamento no nome da Lina.',
    recoverySignoff: 'Com profunda gratidão por ainda estar aqui.',
    recoveryHeroAlt: 'Lina sentada na cama com o ursinho depois da infecção',
    // Abandoned popup
    abandonedSubject: 'Você estava quase salvando Lina 🤍',
    abandonedPreview: 'Você já escolheu o valor. Um clique e Lina recebe a imunoglobulina.',
    abandonedH1: (name: string) => `${name}, você estava quase lá.`,
    abandonedP1: (amount: string) =>
      `Você escolheu doar <strong style="color:${BRAND_DARK};">${amount}</strong> pra imunoglobulina da Lina, mas o pagamento não foi concluído. Sem stress — tá tudo salvo. Um clique e finaliza.`,
    abandonedP2: 'A febre dela continua oscilando entre 39,4°C e 40,2°C. Cada hora sem IVIG deixa a infecção mais difícil de tratar. Sua doação faz essa diferença — hoje, não amanhã.',
    abandonedCta: 'Finalizar minha doação pra Lina',
    abandonedFootnote: 'Bancontact, pronto. Sem formulário extra.',
    abandonedSignoff: 'Ela conta com você.',
    abandonedHeroAlt: 'Lina no isolamento esperando pela imunoglobulina',
    // Abandoned checkout
    abandonedCoSubject: 'A imunoglobulina da Lina ainda está no seu carrinho 🤍',
    abandonedCoPreview: 'Você estava pronto pra salvá-la. O relógio corre. Um clique e a infecção para.',
    abandonedCoUrgencyTag: '⚠️ A febre da Lina continua subindo',
    abandonedCoH1: (name: string) => `${name}, Lina ainda está esperando por você.`,
    abandonedCoP1: (amount: string) =>
      `Você estava pronto pra doar <strong style="color:${BRAND_DARK};">${amount}</strong> pra imunoglobulina da Lina. Mas o pagamento não foi concluído. Sem problema — tudo que você escolheu ainda está salvo.`,
    abandonedCoP2: 'Enquanto você ficou em dúvida, <strong>outros doadores continuaram ajudando</strong>. Mas ainda falta pra fechar a dose de €4.200 dessa semana — e a febre dela continua acima de 39°C. Você estava quase sendo a pessoa que faz a diferença.',
    abandonedCoItemLabel: 'No seu carrinho:',
    abandonedCoP3: 'Um clique no botão abaixo e sua doação tá finalizada. Sem formulários, sem dados novos — tá tudo pronto.',
    abandonedCoCta: 'Finalizar minha doação pra Lina agora →',
    abandonedCoUrgencyNote: '⏰ Esse link é válido por 24h. Depois disso, vai precisar começar do zero.',
    abandonedCoFootnote: 'Bancontact, pronto em 30 segundos. Pagamento seguro via Shopify.',
    abandonedCoSignoff: 'Ela conta com você. A gente também.',
    abandonedCoHeroAlt: 'Lina com o ursinho na oncologia pediátrica'
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
// Template 3 — Upsell V2 (4 botoes ancorados em 25/50/100/300, checkout direto)
// ─────────────────────────────────────────────────────────────────────

import { SHOPIFY_SHOP_DOMAIN, VARIANT_BY_AMOUNT } from '../data/variants';

const SHOPIFY_CART_DOMAIN = SHOPIFY_SHOP_DOMAIN;
const VARIANT_25 = VARIANT_BY_AMOUNT[25];   // Gold
const VARIANT_50 = VARIANT_BY_AMOUNT[50];   // Hero
const VARIANT_100 = VARIANT_BY_AMOUNT[100]; // Protector
const VARIANT_300 = VARIANT_BY_AMOUNT[300]; // Patron

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

  const url25 = checkoutUrl(VARIANT_25, 'mission-25', vars.recipientEmail);
  const url50 = checkoutUrl(VARIANT_50, 'mission-50', vars.recipientEmail);
  const url100 = checkoutUrl(VARIANT_100, 'mission-100', vars.recipientEmail);
  const url300 = checkoutUrl(VARIANT_300, 'mission-300', vars.recipientEmail);

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
            href: url25,
            title: t.upsellV2Mission25Title,
            desc: t.upsellV2Mission25Desc,
            highlight: false
          })}
          ${missionButton({
            href: url50,
            title: t.upsellV2Mission50Title,
            desc: t.upsellV2Mission50Desc,
            highlight: false
          })}
          ${missionButton({
            href: url100,
            badge: t.upsellV2Mission100Badge,
            title: t.upsellV2Mission100Title,
            desc: t.upsellV2Mission100Desc,
            highlight: true
          })}
          ${missionButton({
            href: url300,
            title: t.upsellV2Mission300Title,
            desc: t.upsellV2Mission300Desc,
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
