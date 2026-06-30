import { redirect, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { env } from '$env/dynamic/private';
import { vitrackMakeCookie } from '../../hooks.server';

const VITRACK_MODE = env.VITRACK_MODE === 'true';
const VITRACK_PASSWORD = env.VITRACK_PASSWORD || '';
const VITRACK_AUTH_COOKIE = 'vitrack_auth';
const VITRACK_AUTH_TTL_SEC = 48 * 60 * 60;

export const load: PageServerLoad = async ({ url }) => {
	return {
		vitrackMode: VITRACK_MODE,
		next: url.searchParams.get('next') || '/dashboard'
	};
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		if (!VITRACK_MODE || !VITRACK_PASSWORD) {
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
