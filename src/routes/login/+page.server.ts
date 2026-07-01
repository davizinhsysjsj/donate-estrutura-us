import { redirect, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { env } from '$env/dynamic/private';
import { vitrackMakeCookie } from '../../hooks.server';

const VITRACK_MODE_ENV = env.VITRACK_MODE === 'true';
const VITRACK_PASSWORD = env.VITRACK_PASSWORD || '';
const VITRACK_HOSTS = new Set<string>(['vitrack.online', 'www.vitrack.online']);
const VITRACK_AUTH_COOKIE = 'vitrack_auth';
const VITRACK_AUTH_TTL_SEC = 48 * 60 * 60;

function isVitrackHost(request: Request, urlHostname: string): boolean {
	const forwardedHost = request.headers.get('x-forwarded-host');
	const host = (forwardedHost || request.headers.get('host') || urlHostname).toLowerCase();
	return VITRACK_HOSTS.has(host);
}

export const load: PageServerLoad = async ({ url, request }) => {
	return {
		vitrackMode: VITRACK_MODE_ENV || isVitrackHost(request, url.hostname),
		next: url.searchParams.get('next') || '/dashboard'
	};
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const active = VITRACK_MODE_ENV || isVitrackHost(request, url.hostname);
		if (!active || !VITRACK_PASSWORD) {
			return fail(503, { error: 'Login não disponível.' });
		}
		const form = await request.formData();
		const password = String(form.get('password') ?? '');

		if (password !== VITRACK_PASSWORD) {
			return fail(401, { error: 'Senha incorreta.' });
		}

		cookies.set(VITRACK_AUTH_COOKIE, vitrackMakeCookie(), {
			path: '/',
			maxAge: VITRACK_AUTH_TTL_SEC,
			sameSite: 'lax',
			httpOnly: true,
			secure: true
		});

		const next = url.searchParams.get('next') || '/dashboard';
		const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
		throw redirect(303, safeNext);
	}
};
