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
}) {
	if (!input.amount || input.amount <= 0) return;

	const rawFirst = (input.firstName || '').trim();
	const rawLast = (input.lastName || '').trim();

	const firstName = rawFirst || 'Anoniem';
	const lastInitial = rawLast ? rawLast.charAt(0).toUpperCase() : undefined;

	const arr = load();
	arr.unshift({
		ts: Date.now(),
		firstName,
		lastInitial,
		amount: Math.round(input.amount),
		currency: (input.currency || 'EUR').toUpperCase()
	});

	// trim: so as MAX_STORED mais recentes (arquivo nao cresce indefinidamente)
	const trimmed = arr.slice(0, MAX_STORED);
	save(trimmed);
}

function formatAgo(diffMs: number, locale: 'nl' | 'pt' = 'nl'): string {
	const sec = Math.floor(diffMs / 1000);
	if (sec < 60) return locale === 'nl' ? 'zojuist' : 'agora';
	const min = Math.floor(sec / 60);
	if (min < 60) return locale === 'nl' ? `${min} min geleden` : `${min} min`;
	const hr = Math.floor(min / 60);
	if (hr < 24) return locale === 'nl' ? `${hr} u geleden` : `${hr}h`;
	const day = Math.floor(hr / 24);
	return locale === 'nl' ? `${day} d geleden` : `${day}d`;
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
 */
export function getRecentRealDonors(): FeedDonor[] {
	const arr = load();
	const cutoff = Date.now() - MAX_AGE_MS;
	const now = Date.now();

	return arr
		.filter((d) => d.ts >= cutoff)
		.sort((a, b) => b.ts - a.ts)
		.map((d, i) => {
			const isAnon = d.firstName === 'Anoniem';
			const name = isAnon
				? 'Anoniem'
				: d.lastInitial
					? `${d.firstName} ${d.lastInitial}.`
					: d.firstName;
			const initials = isAnon
				? ''
				: `${d.firstName.charAt(0).toUpperCase()}${d.lastInitial || ''}`;
			return {
				name,
				amount: d.amount,
				ago: formatAgo(now - d.ts),
				initials,
				color: COLORS[i % COLORS.length],
				anonymous: isAnon,
				ts: d.ts,
				real: true as const
			};
		});
}
