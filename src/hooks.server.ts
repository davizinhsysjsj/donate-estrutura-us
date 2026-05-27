import type { Handle } from '@sveltejs/kit';

export const API_ONLY_HOSTS = new Set<string>(['api.belgianpaws.help']);

export const handle: Handle = async ({ event, resolve }) => {
	const host = (event.request.headers.get('host') ?? event.url.hostname).toLowerCase();
	const path = event.url.pathname;
	if (API_ONLY_HOSTS.has(host) && !path.startsWith('/api/') && path !== '/bedankt') {
		return new Response('Not Found', { status: 404 });
	}
	return resolve(event);
};
