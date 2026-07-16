import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export const handle: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;

	// Apple Pay domain verification file — servido via hook porque SvelteKit
	// ignora pastas comecando com "." nas rotas.
	if (path === '/.well-known/apple-developer-merchantid-domain-association') {
		const contents = env.APPLE_PAY_DOMAIN_ASSOCIATION;
		if (!contents) {
			return new Response('Apple Pay domain association not configured', { status: 404 });
		}
		return new Response(contents, {
			status: 200,
			headers: {
				'Content-Type': 'text/plain; charset=utf-8',
				'Cache-Control': 'public, max-age=3600'
			}
		});
	}

	return resolve(event);
};
