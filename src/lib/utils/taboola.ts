/**
 * Taboola Universal Pixel — helpers client-side + persistência do click-id (tblci).
 *
 * Fluxo idêntico ao Meta:
 *  1. Usuário clica ad Taboola → chega com ?tblci=... na URL
 *  2. Capturamos tblci e persistimos em localStorage (30 dias)
 *  3. No click do valor → dispara evento "IC" via pixel JS
 *  4. URL Shopify leva attributes[tblci] → webhook lê e dispara "Compra" server-side
 */

export const TABOOLA_PIXEL_ID = 2057325;

/**
 * Captura e persiste o tblci (Taboola click-id) da URL.
 * O pixel e o page_view já são disparados globalmente via app.html.
 * Chama no onMount das páginas que recebem tráfego Taboola.
 */
export function initTaboola() {
	if (typeof window === 'undefined') return;
	const tblci = new URLSearchParams(window.location.search).get('tblci');
	if (tblci) localStorage.setItem('tblci', tblci);
}

/** Dispara evento Taboola client-side (ex: IC, Compra). */
export function trackTaboola(name: string, revenue?: number) {
	if (typeof window === 'undefined') return;
	(window as any)._tfa = (window as any)._tfa || [];
	(window as any)._tfa.push({
		notify: 'event',
		name,
		id: TABOOLA_PIXEL_ID,
		...(revenue ? { revenue, currency: 'EUR' } : {})
	});
}

/** Retorna tblci persistido (URL atual ou localStorage). */
export function getTblci(): string | null {
	if (typeof window === 'undefined') return null;
	const fromUrl = new URLSearchParams(window.location.search).get('tblci');
	return fromUrl || localStorage.getItem('tblci');
}
