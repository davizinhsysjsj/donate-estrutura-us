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
    upsellHeroAlt: 'Tien uitgehongerde honden net gered door Dog Paws Shelter'
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
    upsellHeroAlt: 'Dez cães faminto recém resgatados pela Dog Paws Shelter'
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
  <title>Belgian Paws</title>
  <style>
    body, table, td { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    img { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; }
    a { color:${BRAND_DARK}; }
    @media (max-width:600px) {
      .container { width:100% !important; }
      .px-mob { padding-left:20px !important; padding-right:20px !important; }
      .h1-mob { font-size:22px !important; line-height:1.3 !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
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
