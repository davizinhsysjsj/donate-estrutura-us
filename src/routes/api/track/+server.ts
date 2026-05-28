import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { ingest, parseDevice, maskIp, getClientIp, type EventName } from '$lib/server/analytics';

const VALID_EVENTS = new Set<EventName>([
  'pageview',
  'heartbeat',
  'scroll_depth',
  'cta_click',
  'amount_select',
  'bancontact_click',
  'vsl_play_with_sound',
  'vsl_complete'
]);

export const POST: RequestHandler = async (event) => {
  let body: any;
  try {
    body = await event.request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const ev = body.ev as EventName;
  if (!VALID_EVENTS.has(ev)) {
    return json({ ok: false, error: 'invalid_event' }, { status: 400 });
  }

  const sid = typeof body.sid === 'string' ? body.sid.slice(0, 64) : '';
  if (!sid) return json({ ok: false, error: 'missing_sid' }, { status: 400 });

  const path = typeof body.path === 'string' ? body.path.slice(0, 200) : '/';
  const ref = typeof body.ref === 'string' ? body.ref.slice(0, 500) : undefined;
  const ua = event.request.headers.get('user-agent') || '';
  const device = parseDevice(ua);
  const ip = getClientIp(event);
  const ipMask = maskIp(ip);

  const utm = body.utm || {};
  ingest({
    ts: Date.now(),
    sid,
    ev,
    path,
    ref,
    ua: ua.slice(0, 200),
    device,
    ipMask,
    utm_source: typeof utm.utm_source === 'string' ? utm.utm_source.slice(0, 100) : undefined,
    utm_medium: typeof utm.utm_medium === 'string' ? utm.utm_medium.slice(0, 100) : undefined,
    utm_campaign: typeof utm.utm_campaign === 'string' ? utm.utm_campaign.slice(0, 100) : undefined,
    utm_content: typeof utm.utm_content === 'string' ? utm.utm_content.slice(0, 100) : undefined,
    utm_term: typeof utm.utm_term === 'string' ? utm.utm_term.slice(0, 100) : undefined,
    data: typeof body.data === 'object' && body.data ? body.data : undefined
  });

  return json({ ok: true });
};
