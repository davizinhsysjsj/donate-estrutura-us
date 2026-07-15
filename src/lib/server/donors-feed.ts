/**
 * Feed de doadores reais — alimentado pelo webhook shopify-purchase.
 *
 * Estrategia:
 * - Cada compra paga no Shopify vira um registro com {firstName, lastInitial, amount, ts}
 * - Persiste em .data/recent-donors.json (mesmo padrao do email-scheduler)
 * - getRecentRealDonors() retorna so os das ultimas 24h (filtra por ts)
 * - Limpa arquivo automaticamente quando passa de MAX_STORED
 *
 * Privacy: salva so primeiro nome + inicial do sobrenome (ex: "Pieter D.")
 * Anonimo se o pedido nao tiver nome.
 */

import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.SCHEDULER_DATA_DIR || path.join(process.cwd(), '.data');
const FILE = path.join(DATA_DIR, 'recent-donors.json');
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h
const MAX_STORED = 100;

interface StoredDonor {
	ts: number;
	firstName: string; // "Anoniem" se nao tiver
	lastInitial?: string; // sem ponto, soh letra (ex: "D")
	amount: number;
	currency: string;
	funnel?: 'ellie' | 'lina' | 'ellie-nl'; // qual funil originou a doação — filtra na LP correta
}

export interface FeedDonor {
	name: string;
	amount: number;
	ago: string;
	initials: string;
	color: string;
	anonymous: boolean;
	ts: number;
	real: true;
	funnel?: 'ellie' | 'lina' | 'ellie-nl';
}

const COLORS = [
	'av-green', 'av-teal', 'av-coral', 'av-amber',
	'av-skyblue', 'av-rose', 'av-purple', 'av-blue'
];

function ensureDir() {
	try {
		if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
	} catch (e) {
		console.error('[donors-feed] cant create data dir', e);
	}
}

function load(): StoredDonor[] {
	try {
		if (!fs.existsSync(FILE)) return [];
		const raw = fs.readFileSync(FILE, 'utf-8');
		const arr = JSON.parse(raw);
		return Array.isArray(arr) ? arr : [];
	} catch (e) {
		console.error('[donors-feed] failed to load', e);
		return [];
	}
}

function save(arr: StoredDonor[]) {
	try {
		ensureDir();
		fs.writeFileSync(FILE, JSON.stringify(arr, null, 2), 'utf-8');
	} catch (e) {
		console.error('[donors-feed] failed to save', e);
	}
}

/**
 * Adiciona um doador real ao feed. Chamado pelo webhook shopify-purchase.
 */
export function addRealDonor(input: {
	firstName?: string | null;
	lastName?: string | null;
	amount: number;
	currency?: string;
	funnel?: 'ellie' | 'lina' | 'ellie-nl';
}) {
	if (!input.amount || input.amount <= 0) return;

	const rawFirst = (input.firstName || '').trim();
	const rawLast = (input.lastName || '').trim();

	// Nome default: "Anonymous" pra Ellie (EN), "Anoniem" pra Lina (NL)
	// Ellie (UK) usa "Anonymous"; ellie-nl (BE) e lina (NL/BE) usam "Anoniem"
	const anonName = input.funnel === 'ellie' ? 'Anonymous' : 'Anoniem';
	const firstName = rawFirst || anonName;
	const lastInitial = rawLast ? rawLast.charAt(0).toUpperCase() : undefined;

	const arr = load();
	arr.unshift({
		ts: Date.now(),
		firstName,
		lastInitial,
		amount: Math.round(input.amount),
		currency: (input.currency || 'EUR').toUpperCase(),
		funnel: input.funnel
	});

	// trim: so as MAX_STORED mais recentes (arquivo nao cresce indefinidamente)
	const trimmed = arr.slice(0, MAX_STORED);
	save(trimmed);
}

function formatAgo(diffMs: number, locale: 'nl' | 'pt' | 'en' = 'nl'): string {
	const sec = Math.floor(diffMs / 1000);
	if (sec < 60) {
		if (locale === 'en') return 'just now';
		if (locale === 'pt') return 'agora';
		return 'zojuist';
	}
	const min = Math.floor(sec / 60);
	if (min < 60) {
		if (locale === 'en') return `${min} min ago`;
		if (locale === 'pt') return `${min} min`;
		return `${min} min geleden`;
	}
	const hr = Math.floor(min / 60);
	if (hr < 24) {
		if (locale === 'en') return `${hr} h ago`;
		if (locale === 'pt') return `${hr}h`;
		return `${hr} u geleden`;
	}
	const day = Math.floor(hr / 24);
	if (locale === 'en') return `${day} d ago`;
	if (locale === 'pt') return `${day}d`;
	return `${day} d geleden`;
}

/**
 * Conta quantos doadores reais existem nos ultimos N dias.
 * Limitado a MAX_STORED (100) — se houver mais, subestima.
 * Usado em social proof de emails (ex: recovery 7d).
 */
export function getDonorsCountLastDays(days: number): number {
	const arr = load();
	const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
	return arr.filter((d) => d.ts >= cutoff).length;
}

/**
 * Retorna doadores reais das ultimas 24h, ja formatados pra UI.
 * @param opts.funnel - filtra apenas doadores desse funil (opcional; sem filtro traz todos)
 * @param opts.locale - idioma do "ago" (default 'nl'). Ellie usa 'en'.
 */
export function getRecentRealDonors(opts?: {
	funnel?: 'ellie' | 'lina' | 'ellie-nl';
	locale?: 'nl' | 'pt' | 'en';
}): FeedDonor[] {
	const arr = load();
	const cutoff = Date.now() - MAX_AGE_MS;
	const now = Date.now();
	const targetFunnel = opts?.funnel;
	const targetLocale = opts?.locale || 'nl';
	const anonLabel = targetLocale === 'en' ? 'Anonymous' : 'Anoniem';

	return arr
		.filter((d) => d.ts >= cutoff)
		.filter((d) => {
			if (!targetFunnel) return true;
			if (targetFunnel === 'ellie') {
				// Bate direto quando gravado como 'ellie'
				if (d.funnel === 'ellie') return true;
				// Fallback pra compras legado (pré-fix do funnel attribute):
				// currency GBP indica funil UK / Ellie
				if (!d.funnel && d.currency === 'GBP') return true;
				return false;
			}
			if (targetFunnel === 'ellie-nl') {
				return d.funnel === 'ellie-nl';
			}
			// Lina: aceita 'lina' ou legacy sem funnel em currency não-GBP
			if (d.funnel === 'lina') return true;
			if (!d.funnel && d.currency !== 'GBP') return true;
			return false;
		})
		.sort((a, b) => b.ts - a.ts)
		.map((d, i) => {
			const isAnon = d.firstName === 'Anoniem' || d.firstName === 'Anonymous';
			const name = isAnon
				? anonLabel
				: d.lastInitial
					? `${d.firstName} ${d.lastInitial}.`
					: d.firstName;
			const initials = isAnon
				? ''
				: `${d.firstName.charAt(0).toUpperCase()}${d.lastInitial || ''}`;
			return {
				name,
				amount: d.amount,
				ago: formatAgo(now - d.ts, targetLocale),
				initials,
				color: COLORS[i % COLORS.length],
				anonymous: isAnon,
				ts: d.ts,
				real: true as const,
				funnel: d.funnel
			};
		});
}
