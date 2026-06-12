import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getTokenStatus } from '$lib/server/fb-token';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async () => {
  const status = getTokenStatus();
  const oauthConfigured = Boolean(env.FB_APP_ID && env.FB_APP_SECRET);

  return json({
    ...status,
    oauthConfigured,
    authorizeUrl: oauthConfigured ? '/api/fb-ads/oauth/start' : null,
  });
};
