import type { Handle } from '@sveltejs/kit';

export const API_ONLY_HOSTS = new Set<string>(['api.belgianpaws.help']);

export const handle: Handle = async ({ event, resolve }) => {
	const host = (event.request.headers.get('host') ?? event.url.hostname).toLowerCase();
	if (API_ONLY_HOSTS.has(host) && !event.url.pathname.startsWith('/api/')) {
		return new Response('Not Found', { status: 404 });
	}
	return resolve(event);
};
