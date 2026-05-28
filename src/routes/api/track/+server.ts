import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { ingest, parseDevice, getClientIp, initStore, type EventName } from '$lib/server/analytics';
import { lookupGeo } from '$lib/server/geo';

initStore();

const VALID_EVENTS = new Set<EventName>([
  'pageview',
  'heartbeat',
  'scroll_depth',
  'cta_click',
  'amount_select',
  'bancontact_click',
  'vsl_play_with_sound',
  'vsl_quartile',
  'vsl_rewatch',
  'vsl_complete',
  'web_vital',
  'js_error',
  'section_view',
  'click_heatmap',
  'rage_click',
  'dead_click',
  'scroll_back',
  'purchase'
]);

export const POST: RequestHandler = async (event) => {
  let body: any;
  try {
    body = await event.request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  // Suporta batch: { events: [...] } ou single { ev, ... }
  const items: any[] = Array.isArray(body.events) ? body.events : [body];
  if (items.length > 50) return json({ ok: false, error: 'too_many' }, { status: 400 });

  const ua = event.request.headers.get('user-agent') || '';
  const device = parseDevice(ua);
  const ip = getClientIp(event);

  // Geo: best-effort, nao bloqueia se demorar
  let geo: any = {};
  try {
    geo = await Promise.race([
      lookupGeo(ip),
      new Promise((r) => setTimeout(() => r({}), 800))
    ]);
  } catch {
    geo = {};
  }

  let accepted = 0;
  for (const b of items) {
    const ev = b.ev as EventName;
    if (!VALID_EVENTS.has(ev)) continue;
    const sid = typeof b.sid === 'string' ? b.sid.slice(0, 64) : '';
    if (!sid) continue;
    const pth = typeof b.path === 'string' ? b.path.slice(0, 200) : '/';
    const ref = typeof b.ref === 'string' ? b.ref.slice(0, 500) : undefined;
    const utm = b.utm || {};
    ingest({
      ts: typeof b.ts === 'number' ? b.ts : Date.now(),
      sid,
      ev,
      path: pth,
      ref,
      ua,
      ip,
      device,
      utm_source: typeof utm.utm_source === 'string' ? utm.utm_source.slice(0, 100) : undefined,
      utm_medium: typeof utm.utm_medium === 'string' ? utm.utm_medium.slice(0, 100) : undefined,
      utm_campaign: typeof utm.utm_campaign === 'string' ? utm.utm_campaign.slice(0, 100) : undefined,
      utm_content: typeof utm.utm_content === 'string' ? utm.utm_content.slice(0, 100) : undefined,
      utm_term: typeof utm.utm_term === 'string' ? utm.utm_term.slice(0, 100) : undefined,
      fbclid: typeof b.fbclid === 'string' ? b.fbclid.slice(0, 200) : undefined,
      data: typeof b.data === 'object' && b.data ? b.data : undefined,
      geo
    });
    accepted++;
  }

  return json({ ok: true, accepted });
};
