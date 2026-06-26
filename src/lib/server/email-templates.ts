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
const HERO_IMAGE = `${SITE_URL}/email/shadow-thank-you.jpg`;
const UPSELL_HERO_IMAGE = `${SITE_URL}/email/shadow-urgent.jpg`;
const ABANDONED_CHECKOUT_HERO_IMAGE = `${SITE_URL}/email/shadow-cart.jpg`;
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
    tagline: 'Shadow en geredde katten in België',
    footerBrand: 'Belgian Paws Helper · Shadow & geredde katten, België',
    footerSupport: (mail: string) => `Heb je een vraag? Antwoord direct op deze e-mail of mail naar <a href="mailto:${mail}" style="color:${BRAND_DARK};text-decoration:none;">${mail}</a>.`,
    // Thank you — 1u na donatie. Bevestiging dat de donatie direct naar Shadow gaat.
    thankSubject: 'Shadow heeft uw donatie ontvangen 🐾',
    thankPreview: 'Hij ligt nu rustig, met een infuus. Hier is een foto van vandaag.',
    thankH1: (name: string) => `Bedankt, ${name}. Shadow ademt vandaag dankzij u.`,
    thankP1: (amount: string) =>
      `Uw donatie van <strong style="color:${BRAND_DARK};">${amount}</strong> is rechtstreeks naar Shadow gegaan: pijnstilling, infuus en monitoring. Vandaag rust hij zonder pijn — en dat is uw verdienste.`,
    thankP2: 'De operatie van €890 staat gepland binnen 8 dagen. We sturen u updates zodra hij op de operatietafel ligt. Tot dan houdt uw bijdrage hem in leven.',
    thankCta: 'Bekijk Shadow\'s voortgang',
    thankSignoff: 'Met warme groet,',
    teamName: 'Het Belgian Paws team',
    heroAlt: 'Shadow rust met infuus na uw donatie',
    // Upsell legacy (simples) — Shadow
    upsellSubject: 'Shadow vraagt vandaag opnieuw om u 🐾',
    upsellPreview: 'De tumor groeit elke dag. We hebben nog niet genoeg.',
    upsellH1: (name: string) => `${name}, Shadow heeft u opnieuw nodig.`,
    upsellP1: (amount: string) =>
      `Uw donatie van <strong style="color:${BRAND_DARK};">${amount}</strong> hield Shadow 2 dagen geleden in leven. Maar zijn tumor van 24mm blijft groeien — en de operatie van €890 is nog niet gefinancierd.`,
    upsellP2: 'Elke dag uitstel maakt de operatie risikevoller. De dierenartsen geven hem nog 6 dagen voordat de tumor inoperabel wordt.',
    upsellP3: 'Als u opnieuw kunt — al is het €5 — komen we dichter bij zijn redding. Zonder dat geld sterft hij vrijdag.',
    upsellCta: 'Ja, ik help Shadow opnieuw',
    upsellSignoff: 'Uit de grond van ons hart, bedankt.',
    upsellHeroAlt: 'Shadow wacht op zijn operatie',
    // Upsell V2 (48u, AGRESSIEF) — loss aversion + countdown + 3 missoes brutaal duidelijk
    upsellV2Subject: 'Shadow heeft nog 6 dagen. Zonder u: de spuit.',
    upsellV2Preview: 'Uw donatie hield hem 48u in leven. Vanavond beslist u of hij vrijdag opereert — of sterft.',
    upsellV2H1: (name: string) => `${name}, zonder uw 2de donatie sterft Shadow vrijdag.`,
    upsellV2P1: (amount: string) =>
      `48 uur geleden gaf u <strong style="color:${BRAND_DARK};">${amount}</strong> om Shadow's leven te kopen. Het werkte: hij ademt nog, hij eet via een sonde, hij wacht. Maar de operatie kost €890 — en we zijn er nog niet.`,
    upsellV2P2: 'Zijn tumor groeit elke dag 0,3mm. Over <strong>6 dagen</strong> is hij inoperabel. Daarna komt de spuit. Dat wordt niet ons besluit — dat is uw besluit, vanavond. Uw eerdere donatie verdwijnt in het niets als u nu stopt.',
    upsellV2MissionsTitle: 'Wat redt u vanavond?',
    upsellV2Mission50Title: '€25 — Houd hem 1 dag in leven',
    upsellV2Mission50Desc: 'Pijnstilling + sondevoeding + monitoring voor 24u. Hij ademt morgen. Eén dag dichter bij de operatietafel.',
    upsellV2Mission80Badge: 'BESLISSEND',
    upsellV2Mission80Title: '€50 — Garandeer zijn weekend',
    upsellV2Mission80Desc: '3 dagen IC-zorg met intraveneus infuus. Brengt hem zonder achteruitgang tot maandagochtend — operatiedag.',
    upsellV2Mission100Title: '€100 — Sluit het tekort, hij wordt geopereerd',
    upsellV2Mission100Desc: 'Met €100 nu sluit u de laatste kloof. Shadow ligt maandagochtend op de operatietafel. Uw naam staat naast zijn redding.',
    upsellV2Footnote: 'Elke knop brengt u direct naar betalen. Bancontact, 30 seconden, klaar. Geen formulieren.',
    upsellV2Signoff: 'Hij rekent op u. Letterlijk.',
    upsellV2HeroAlt: 'Shadow op de bank van het opvangcentrum, wachtend op zijn operatie',
    // Recovery — 7 dias. Mostra resultado (Shadow operou) + apresenta proximo gato (Luna).
    recoverySubject: 'Shadow is geopereerd. Hij overleefde.',
    recoveryPreview: 'Dankzij donateurs zoals u. Maar er staat een nieuwe kat voor onze deur.',
    recoveryH1: (name: string) => `${name}, Shadow overleefde — dankzij u.`,
    recoveryP1: (count: string) =>
      `Shadow werd gisteren geopereerd. De tumor is weg. Hij eet weer zelf. Dat is dankzij <strong style="color:${BRAND_DARK};">${count} donateurs</strong> zoals u die de laatste 7 dagen genoeg ophalden voor de €890.`,
    recoveryP2: 'Maar nu staat Luna voor onze deur — 9 jaar, hartruis, geen eigenaar. Haar operatie kost €620. We beginnen weer bij nul.',
    recoveryP3: 'Als u ons weer kunt helpen — al is het €5 — geeft u Luna dezelfde kans die u Shadow gaf. Zonder donateurs sterven katten als zij stilletjes.',
    recoveryCta: 'Help Luna zoals u Shadow hielp',
    recoveryFootnote: 'Geen abonnementen, geen verplichtingen. Elke donatie is eenmalig en gaat naar één concrete kat.',
    recoverySignoff: 'Met diepe dank dat u nog hier bent.',
    recoveryHeroAlt: 'Luna wacht bij Belgian Paws Shelter na de redding van Shadow',
    // Abandoned popup (1u na popup zonder afronding)
    abandonedSubject: 'U was bijna Shadow\'s redder 🐾',
    abandonedPreview: 'U had het bedrag al gekozen. Eén klik en Shadow is een stap dichter bij de operatie.',
    abandonedH1: (name: string) => `${name}, u was er bijna.`,
    abandonedP1: (amount: string) =>
      `U koos een donatie van <strong style="color:${BRAND_DARK};">${amount}</strong> voor Shadow's operatie, maar de betaling werd niet afgerond. Geen zorgen — alles is bewaard. Eén klik en u sluit het af.`,
    abandonedP2: 'Zijn tumor groeit elke dag. €890 staat tussen hem en de operatietafel. Uw donatie maakt dat verschil — vandaag, niet morgen.',
    abandonedCta: 'Mijn donatie voor Shadow afronden',
    abandonedFootnote: 'Bancontact, klaar. Geen extra formulieren.',
    abandonedSignoff: 'Hij rekent op u.',
    abandonedHeroAlt: 'Shadow op de bank wachtend op redding',
    // Abandoned Shopify checkout (10min)
    abandonedCoSubject: 'Shadow zit nog in uw winkelwagen 🐾',
    abandonedCoPreview: 'U was klaar om hem te redden. Hij wacht nog steeds. Eén klik en de operatie komt dichterbij.',
    abandonedCoUrgencyTag: '⚠️ Uw winkelwagen verloopt binnenkort',
    abandonedCoH1: (name: string) => `${name}, Shadow wacht nog steeds op u.`,
    abandonedCoP1: (amount: string) =>
      `U was klaar om <strong style="color:${BRAND_DARK};">${amount}</strong> te doneren voor Shadow's operatie. Maar de betaling werd niet voltooid. Geen zorgen — alles wat u heeft gekozen is nog opgeslagen.`,
    abandonedCoP2: 'In de tijd dat u afhaakte hebben <strong>andere donateurs verder geholpen</strong>. Maar er is nog steeds een tekort om de €890 te halen — en de tumor groeit elke dag. U was bijna degene die het verschil maakte.',
    abandonedCoItemLabel: 'In uw winkelwagen:',
    abandonedCoP3: 'Eén klik op de knop hieronder en uw donatie is rond. Geen formulieren, geen nieuwe gegevens — alles staat klaar.',
    abandonedCoCta: 'Mijn donatie voor Shadow afronden →',
    abandonedCoUrgencyNote: '⏰ Deze link is 24 uur geldig. Daarna moet u opnieuw beginnen.',
    abandonedCoFootnote: 'Bancontact, klaar in 30 seconden. Veilige betaling via Shopify.',
    abandonedCoSignoff: 'Hij rekent op u. Wij ook.',
    abandonedCoHeroAlt: 'Shadow wacht op zijn tweede kans'
  },
  pt: {
    htmlLang: 'pt-BR',
    fallbackName: 'amigo',
    tagline: 'Shadow e gatos resgatados na Bélgica',
    footerBrand: 'Belgian Paws Helper · Shadow & gatos resgatados, Bélgica',
    footerSupport: (mail: string) => `Alguma dúvida? Responda direto este e-mail ou escreva para <a href="mailto:${mail}" style="color:${BRAND_DARK};text-decoration:none;">${mail}</a>.`,
    // Thank you
    thankSubject: 'Shadow recebeu sua doação 🐾',
    thankPreview: 'Ele está descansando com soro agora. Veja a foto de hoje.',
    thankH1: (name: string) => `Obrigado, ${name}. Shadow respira hoje graças a você.`,
    thankP1: (amount: string) =>
      `Sua doação de <strong style="color:${BRAND_DARK};">${amount}</strong> foi direto pra Shadow: analgésico, soro e monitoramento. Hoje ele descansa sem dor — e isso é mérito seu.`,
    thankP2: 'A cirurgia de €890 está agendada nos próximos 8 dias. Avisamos quando ele subir na mesa. Até lá, sua doação está mantendo ele vivo.',
    thankCta: 'Ver o progresso do Shadow',
    thankSignoff: 'Com carinho,',
    teamName: 'Equipe Belgian Paws',
    heroAlt: 'Shadow descansando com soro após sua doação',
    // Upsell legacy — Shadow
    upsellSubject: 'Shadow precisa de você de novo hoje 🐾',
    upsellPreview: 'O tumor cresce. Ainda falta pra cirurgia.',
    upsellH1: (name: string) => `${name}, Shadow precisa de você de novo.`,
    upsellP1: (amount: string) =>
      `Sua doação de <strong style="color:${BRAND_DARK};">${amount}</strong> manteve Shadow vivo nos últimos 2 dias. Mas o tumor de 24mm continua crescendo — e a cirurgia de €890 ainda não foi paga.`,
    upsellP2: 'Cada dia de atraso aumenta o risco da cirurgia. Os veterinários dão a ele mais 6 dias antes do tumor virar inoperável.',
    upsellP3: 'Se você puder ajudar de novo — nem que seja €5 — a gente chega mais perto da salvação dele. Sem esse dinheiro, ele morre na sexta.',
    upsellCta: 'Sim, quero ajudar Shadow de novo',
    upsellSignoff: 'Do fundo do coração, obrigado.',
    upsellHeroAlt: 'Shadow esperando pela cirurgia',
    // Upsell V2 (48h, AGRESSIVO)
    upsellV2Subject: 'Shadow tem 6 dias. Sem você: a injeção.',
    upsellV2Preview: 'Sua doação o manteve vivo 48h. Hoje à noite você decide se ele opera — ou morre.',
    upsellV2H1: (name: string) => `${name}, sem sua 2ª doação Shadow morre na sexta.`,
    upsellV2P1: (amount: string) =>
      `48 horas atrás você deu <strong style="color:${BRAND_DARK};">${amount}</strong> pra comprar a vida do Shadow. Funcionou: ele ainda respira, come pela sonda, espera. Mas a cirurgia custa €890 — e ainda não chegamos lá.`,
    upsellV2P2: 'O tumor dele cresce 0,3mm por dia. Em <strong>6 dias</strong> vira inoperável. Depois disso vem a injeção. Não é decisão nossa — é sua, hoje à noite. Sua doação anterior vira pó se você parar agora.',
    upsellV2MissionsTitle: 'O que você salva hoje?',
    upsellV2Mission50Title: '€25 — Mantenha ele vivo por 1 dia',
    upsellV2Mission50Desc: 'Analgésico + alimentação por sonda + monitoramento por 24h. Ele respira amanhã. 1 dia mais perto da cirurgia.',
    upsellV2Mission80Badge: 'DECISIVA',
    upsellV2Mission80Title: '€50 — Garanta o fim de semana dele',
    upsellV2Mission80Desc: '3 dias de UTI com soro intravenoso. Leva ele sem piora até segunda — dia da cirurgia.',
    upsellV2Mission100Title: '€100 — Feche o gap, ele opera',
    upsellV2Mission100Desc: 'Com €100 agora você fecha a última lacuna. Shadow sobe na mesa segunda de manhã. Seu nome ao lado da salvação dele.',
    upsellV2Footnote: 'Cada botão te leva direto pro pagamento. Bancontact, 30 segundos, pronto. Sem formulário.',
    upsellV2Signoff: 'Ele conta com você. Literalmente.',
    upsellV2HeroAlt: 'Shadow no banco do abrigo esperando pela cirurgia',
    // Recovery
    recoverySubject: 'Shadow operou. E sobreviveu.',
    recoveryPreview: 'Graças a doadores como você. Mas tem um gato novo na nossa porta.',
    recoveryH1: (name: string) => `${name}, Shadow sobreviveu — graças a você.`,
    recoveryP1: (count: string) =>
      `Shadow operou ontem. O tumor foi removido. Ele já está comendo sozinho. Isso é graças a <strong style="color:${BRAND_DARK};">${count} doadores</strong> como você que nos últimos 7 dias completaram os €890.`,
    recoveryP2: 'Mas agora Luna está na nossa porta — 9 anos, sopro no coração, sem dono. A cirurgia dela custa €620. A gente começa do zero de novo.',
    recoveryP3: 'Se você puder ajudar de novo — nem que seja €5 — você dá a Luna a mesma chance que deu pro Shadow. Sem doadores, gatos como ela morrem em silêncio.',
    recoveryCta: 'Ajude Luna como ajudou Shadow',
    recoveryFootnote: 'Sem assinatura, sem amarra. Cada doação é única e vai pra um gato específico.',
    recoverySignoff: 'Com profunda gratidão por ainda estar aqui.',
    recoveryHeroAlt: 'Luna esperando no Belgian Paws Shelter depois do resgate do Shadow',
    // Abandoned popup
    abandonedSubject: 'Você estava quase salvando Shadow 🐾',
    abandonedPreview: 'Você já escolheu o valor. Um clique e Shadow está mais perto da cirurgia.',
    abandonedH1: (name: string) => `${name}, você estava quase lá.`,
    abandonedP1: (amount: string) =>
      `Você escolheu doar <strong style="color:${BRAND_DARK};">${amount}</strong> pra cirurgia do Shadow, mas o pagamento não foi concluído. Sem stress — tá tudo salvo. Um clique e finaliza.`,
    abandonedP2: 'O tumor dele cresce todo dia. €890 estão entre ele e a mesa de cirurgia. Sua doação faz essa diferença — hoje, não amanhã.',
    abandonedCta: 'Finalizar minha doação pra Shadow',
    abandonedFootnote: 'Bancontact, pronto. Sem formulário extra.',
    abandonedSignoff: 'Ele conta com você.',
    abandonedHeroAlt: 'Shadow no banco esperando ser salvo',
    // Abandoned checkout
    abandonedCoSubject: 'Shadow ainda está no seu carrinho 🐾',
    abandonedCoPreview: 'Você estava pronto pra salvá-lo. Ele ainda espera. Um clique e a cirurgia fica mais perto.',
    abandonedCoUrgencyTag: '⚠️ Seu carrinho expira em breve',
    abandonedCoH1: (name: string) => `${name}, Shadow ainda está esperando por você.`,
    abandonedCoP1: (amount: string) =>
      `Você estava pronto pra doar <strong style="color:${BRAND_DARK};">${amount}</strong> pra cirurgia do Shadow. Mas o pagamento não foi concluído. Sem problema — tudo que você escolheu ainda está salvo.`,
    abandonedCoP2: 'Enquanto você ficou em dúvida, <strong>outros doadores continuaram ajudando</strong>. Mas ainda falta pra fechar os €890 — e o tumor cresce todo dia. Você estava quase sendo a pessoa que faz a diferença.',
    abandonedCoItemLabel: 'No seu carrinho:',
    abandonedCoP3: 'Um clique no botão abaixo e sua doação tá finalizada. Sem formulários, sem dados novos — tá tudo pronto.',
    abandonedCoCta: 'Finalizar minha doação pra Shadow agora →',
    abandonedCoUrgencyNote: '⏰ Esse link é válido por 24h. Depois disso, vai precisar começar do zero.',
    abandonedCoFootnote: 'Bancontact, pronto em 30 segundos. Pagamento seguro via Shopify.',
    abandonedCoSignoff: 'Ele conta com você. A gente também.',
    abandonedCoHeroAlt: 'Shadow esperando por uma segunda chance'
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
