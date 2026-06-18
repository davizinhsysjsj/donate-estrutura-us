/**
 * TikTok Pixel — helpers client-side + persistência do click-id (ttclid).
 *
 * Fluxo idêntico ao Meta/Taboola:
 *  1. Usuário clica ad TikTok → chega com ?ttclid=... na URL
 *  2. Capturamos ttclid e persistimos em localStorage (30 dias)
 *  3. No click do valor → dispara evento "InitiateCheckout" via pixel JS
 *  4. URL Shopify leva attributes[ttclid] + attributes[ttp] → webhook lê e
 *     dispara "Purchase" server-side via Events API V2
 */

export const TIKTOK_PIXEL_ID = 'D8PI2QBC77U8IPSBIFU0';

/**
 * Carrega o pixel TikTok (idempotente — só carrega uma vez) e captura ttclid da URL.
 * Chama no onMount das páginas que recebem tráfego TikTok (LP e donate).
 */
export function initTikTok() {
	if (typeof window === 'undefined') return;

	const w = window as any;
	if (!w.ttq) {
		// Snippet oficial do TikTok Pixel
		w.TiktokAnalyticsObject = 'ttq';
		const ttq = (w.ttq = w.ttq || []);
		ttq.methods = [
			'page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once',
			'ready', 'alias', 'group', 'enableCookie', 'disableCookie',
			'holdConsent', 'revokeConsent', 'grantConsent'
		];
		ttq.setAndDefer = function (t: any, e: string) {
			t[e] = function () {
				t.push([e].concat(Array.prototype.slice.call(arguments, 0)));
			};
		};
		for (let i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
		ttq.instance = function (t: string) {
			const e = ttq._i[t] || [];
			for (let n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(e, ttq.methods[n]);
			return e;
		};
		ttq.load = function (e: string, n?: any) {
			const r = 'https://analytics.tiktok.com/i18n/pixel/events.js';
			ttq._i = ttq._i || {};
			ttq._i[e] = [];
			ttq._i[e]._u = r;
			ttq._t = ttq._t || {};
			ttq._t[e] = +new Date();
			ttq._o = ttq._o || {};
			ttq._o[e] = n || {};
			const s = document.createElement('script');
			s.type = 'text/javascript';
			s.async = true;
			s.src = r + '?sdkid=' + e + '&lib=ttq';
			const first = document.getElementsByTagName('script')[0];
			first.parentNode?.insertBefore(s, first);
		};
		ttq.load(TIKTOK_PIXEL_ID);
		ttq.page();
	}

	// Captura e persiste ttclid (TikTok click-id)
	const ttclid = new URLSearchParams(window.location.search).get('ttclid');
	if (ttclid) localStorage.setItem('ttclid', ttclid);
}

/** Dispara evento TikTok client-side (ex: InitiateCheckout, CompletePayment). */
export function trackTikTok(name: string, value?: number) {
	if (typeof window === 'undefined') return;
	const ttq = (window as any).ttq;
	if (!ttq || typeof ttq.track !== 'function') return;
	ttq.track(name, value ? { value, currency: 'EUR' } : {});
}

/** Retorna ttclid persistido (URL atual ou localStorage). */
export function getTtclid(): string | null {
	if (typeof window === 'undefined') return null;
	const fromUrl = new URLSearchParams(window.location.search).get('ttclid');
	return fromUrl || localStorage.getItem('ttclid');
}

/** Le cookie _ttp (TikTok browser id, equivalente ao _fbp). */
export function getTtp(): string | null {
	if (typeof document === 'undefined') return null;
	const m = document.cookie.match(/(?:^|;\s*)_ttp=([^;]+)/);
	return m ? decodeURIComponent(m[1]) : null;
}
