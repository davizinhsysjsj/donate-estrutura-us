/**
 * Templates HTML dos emails transacionais (NL).
 *
 * Logo: header verde escuro (cor da camisa "Dog Paws Shelter" da foto)
 * com texto "BELGIAN PAWS" + patinha 🐾.
 *
 * Imagem: hospedada em https://belgianpawshelter.help/email/feeding-dogs.jpg
 */

const SITE_URL = 'https://belgianpawshelter.help';
const DONATE_URL = `${SITE_URL}/`;
const HERO_IMAGE = `${SITE_URL}/email/feeding-dogs.jpg`;
const SUPPORT_EMAIL = 'contact@belgianpaws.help';
const BRAND_COLOR = '#16A34A'; // verde camisa
const BRAND_DARK = '#15803D';

export interface ThankYouVars {
  firstName?: string;
  amount: number;
  currency: string;
}

export interface UpsellVars {
  firstName?: string;
  previousAmount: number;
  currency: string;
}

function escape(s: string | undefined | null): string {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatAmount(v: number, currency: string): string {
  return new Intl.NumberFormat('nl-BE', {
    style: 'currency',
    currency: currency || 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(v);
}

/**
 * Header com logo (inline HTML — funciona em todos os clientes de email).
 */
function header(): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND_COLOR};">
      <tr>
        <td align="center" style="padding:24px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="font-family:Arial,Helvetica,sans-serif;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:1px;line-height:1;">
                BELGIAN&nbsp;PAWS&nbsp;<span style="font-size:24px;">🐾</span>
              </td>
            </tr>
            <tr>
              <td style="font-family:Arial,Helvetica,sans-serif;color:#dcfce7;font-size:11px;font-weight:500;padding-top:4px;letter-spacing:2px;text-transform:uppercase;">
                Helping rescued dogs in Belgium
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

function footer(): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;">
      <tr>
        <td align="center" style="padding:24px 24px 32px;font-family:Arial,Helvetica,sans-serif;color:#64748b;font-size:12px;line-height:1.6;">
          <div style="margin-bottom:8px;">
            Belgian Paws Helper &middot; Rescued dog care, Belgium
          </div>
          <div>
            Heb je een vraag? Antwoord direct op deze e-mail of mail naar
            <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_DARK};text-decoration:none;">${SUPPORT_EMAIL}</a>.
          </div>
          <div style="margin-top:12px;color:#94a3b8;font-size:11px;">
            &copy; ${new Date().getFullYear()} Belgian Paws
          </div>
        </td>
      </tr>
    </table>
  `;
}

function shell(previewText: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="nl">
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
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;">
    <tr>
      <td align="center" style="padding:24px 0;">
        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(15,23,42,0.06);">
          <tr><td>${header()}</td></tr>
          <tr><td>${bodyHtml}</td></tr>
          <tr><td>${footer()}</td></tr>
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

export function thankYouSubject(): string {
  return 'Jouw donatie voedt onze honden vandaag 🐾';
}

export function thankYouPreview(): string {
  return 'Vandaag krijgen drie viervoeters een volle bak — dankzij jou.';
}

export function thankYouHtml(vars: ThankYouVars): string {
  const name = vars.firstName ? escape(vars.firstName) : 'vriend';
  const amount = formatAmount(vars.amount, vars.currency);

  const body = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td>
          <img src="${HERO_IMAGE}" alt="Onze vrijwilligers voeden geredde honden vandaag" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;">
        </td>
      </tr>
      <tr>
        <td class="px-mob" style="padding:32px 40px 8px;">
          <h1 class="h1-mob" style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;font-size:24px;font-weight:700;line-height:1.3;">
            Bedankt, ${name}. Jij hebt vandaag het verschil gemaakt.
          </h1>
          <p style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;color:#334155;font-size:16px;line-height:1.65;">
            Jouw donatie van <strong style="color:${BRAND_DARK};">${amount}</strong> is al onderweg
            naar de bakjes van enkele van onze geredde honden. Vandaag eten ze warm en veilig,
            en dat is dankzij jou.
          </p>
          <p style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;color:#334155;font-size:16px;line-height:1.65;">
            Je bent geweldig. Bedankt dat je ons helpt — we rekenen blijvend op jouw steun
            om meer viervoeters een tweede kans te geven.
          </p>
        </td>
      </tr>
      <tr>
        <td class="px-mob" align="center" style="padding:0 40px 32px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td bgcolor="${BRAND_COLOR}" style="border-radius:8px;">
                <a href="${DONATE_URL}" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">
                  Bekijk hoe je nog meer kan helpen
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td class="px-mob" style="padding:0 40px 32px;">
          <div style="border-top:1px solid #e2e8f0;padding-top:20px;font-family:Arial,Helvetica,sans-serif;color:#475569;font-size:14px;line-height:1.6;">
            Met warme groet,<br>
            <strong style="color:#0f172a;">Het Belgian Paws team</strong>
          </div>
        </td>
      </tr>
    </table>
  `;

  return shell(thankYouPreview(), body);
}

// ─────────────────────────────────────────────────────────────────────
// Template 2 — Upsell (48h apos compra)
// ─────────────────────────────────────────────────────────────────────

export function upsellSubject(): string {
  return 'Nog één hondje wacht op je hulp 🐾';
}

export function upsellPreview(): string {
  return 'Jouw vorige donatie maakte het verschil. Doe je opnieuw mee?';
}

export function upsellHtml(vars: UpsellVars): string {
  const name = vars.firstName ? escape(vars.firstName) : 'vriend';
  const previous = formatAmount(vars.previousAmount, vars.currency);

  const body = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td>
          <img src="${HERO_IMAGE}" alt="Geredde honden in ons opvangcentrum" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;">
        </td>
      </tr>
      <tr>
        <td class="px-mob" style="padding:32px 40px 8px;">
          <h1 class="h1-mob" style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;font-size:24px;font-weight:700;line-height:1.3;">
            ${name}, er wacht nog een vriend op je.
          </h1>
          <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;color:#334155;font-size:16px;line-height:1.65;">
            Twee dagen geleden hielp jouw donatie van <strong style="color:${BRAND_DARK};">${previous}</strong>
            honden in ons opvangcentrum aan voer en warmte. Bedankt — dat blijven we ons herinneren.
          </p>
          <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;color:#334155;font-size:16px;line-height:1.65;">
            Maar elke dag komen er nieuwe verlaten viervoeters bij. Met nog een kleine bijdrage
            help je een extra hond aan een veilige maaltijd vandaag.
          </p>
          <p style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;color:#334155;font-size:16px;line-height:1.65;">
            Wil je het opnieuw doen? Elke euro telt.
          </p>
        </td>
      </tr>
      <tr>
        <td class="px-mob" align="center" style="padding:0 40px 32px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td bgcolor="${BRAND_COLOR}" style="border-radius:8px;">
                <a href="${DONATE_URL}" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">
                  Help nog een hond
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td class="px-mob" style="padding:0 40px 32px;">
          <div style="border-top:1px solid #e2e8f0;padding-top:20px;font-family:Arial,Helvetica,sans-serif;color:#475569;font-size:14px;line-height:1.6;">
            Met dank,<br>
            <strong style="color:#0f172a;">Het Belgian Paws team</strong>
          </div>
        </td>
      </tr>
    </table>
  `;

  return shell(upsellPreview(), body);
}
