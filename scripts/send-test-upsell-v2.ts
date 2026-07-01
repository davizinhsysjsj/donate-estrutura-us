import { upsellV2Html, upsellV2Subject } from '../src/lib/server/email-templates';

async function main() {
  const to = process.env.TEST_TO || 'luscasimoni@gmail.com';
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_MAIL_FROM || 'Belgian Paws Helper <contact@belgiancarestore.com>';

  if (!apiKey) {
    console.error('RESEND_API_KEY missing');
    process.exit(1);
  }

  const html = upsellV2Html({
    firstName: 'Lucas',
    previousAmount: 25,
    currency: 'EUR',
    locale: 'nl'
  });

  const subject = `[TESTE] ${upsellV2Subject('nl')}`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      text: html.replace(/<[^>]+>/g, '')
    })
  });

  const data = await res.json().catch(() => ({}));
  console.log('status:', res.status);
  console.log('data:', data);
  if (!res.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
