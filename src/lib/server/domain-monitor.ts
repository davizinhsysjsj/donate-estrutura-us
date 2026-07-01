/**
 * Monitor de domínios com notificação Pushcut nas transições UP↔DOWN.
 *
 * - Checa a cada CHECK_INTERVAL_MS via HTTPS GET + timeout 10s
 * - Considera DOWN após 2 falhas consecutivas (evita alerta por hiccup)
 * - Considera UP após 1 sucesso
 * - Persistência em .data/domain-status.json (sobrevive a restart)
 *
 * Env vars:
 *   MONITORED_DOMAINS   — CSV. Ex: "belgianpawsfoundation.org,api.belgiancarestore.com"
 *                         Se vazio, usa DEFAULT_DOMAINS.
 *   DOMAIN_CHECK_INTERVAL_SEC — default 300 (5 min)
 *   PUSHCUT_DOMAIN_NOTIFICATION — nome da notification Pushcut (default "DOMAIN STATUS")
 */

import fs from 'node:fs';
import path from 'node:path';
import { notifyDomainDown, notifyDomainUp } from './notify';

const DEFAULT_DOMAINS = [
	'belgianpawsfoundation.org',
	'belgiancarestore.com',
	'api.belgiancarestore.com'
];

const DATA_DIR = process.env.DOMAIN_MONITOR_DATA_DIR
	|| process.env.SCHEDULER_DATA_DIR
	|| path.join(process.cwd(), '.data');
const STATE_FILE = path.join(DATA_DIR, 'domain-status.json');

const CHECK_INTERVAL_MS =
	Number(process.env.DOMAIN_CHECK_INTERVAL_SEC || '300') * 1000;
const FAILURES_BEFORE_DOWN = 2;
const REQUEST_TIMEOUT_MS = 10_000;

type Status = 'up' | 'down' | 'unknown';

interface DomainState {
	domain: string;
	status: Status;
	consecutiveFailures: number;
	lastCheckedAt: number;
	lastStatusChangeAt: number;
	lastHttpStatus?: number;
	lastError?: string;
	lastLatencyMs?: number;
}

let state: Record<string, DomainState> = {};
let timer: ReturnType<typeof setInterval> | null = null;
let started = false;

function ensureDataDir() {
	try {
		if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
	} catch (e) {
		console.error('[domain-monitor] cant create data dir', e);
	}
}

function loadState() {
	try {
		if (!fs.existsSync(STATE_FILE)) return;
		const raw = fs.readFileSync(STATE_FILE, 'utf-8');
		state = JSON.parse(raw);
	} catch (e) {
		console.warn('[domain-monitor] state load failed', e);
	}
}

function saveState() {
	try {
		ensureDataDir();
		fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
	} catch (e) {
		console.warn('[domain-monitor] state save failed', e);
	}
}

function getDomains(): string[] {
	const raw = process.env.MONITORED_DOMAINS || '';
	const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
	return list.length ? list : DEFAULT_DOMAINS;
}

async function checkOne(domain: string): Promise<{ ok: boolean; status?: number; error?: string; latencyMs: number }> {
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
	const started = Date.now();
	try {
		const res = await fetch(`https://${domain}/`, {
			method: 'GET',
			signal: ctrl.signal,
			redirect: 'manual',
			// Some upstreams retornam 4xx/5xx quando pedimos "/". Aceita qualquer
			// resposta com status HTTP como "up". Só falha em erro de rede/DNS/TLS.
			headers: { 'user-agent': 'DomainMonitor/1.0 (+belgianpawsfoundation.org)' }
		});
		clearTimeout(t);
		const latencyMs = Date.now() - started;
		// 5xx conta como down
		const ok = res.status < 500;
		return { ok, status: res.status, latencyMs };
	} catch (e: any) {
		clearTimeout(t);
		const latencyMs = Date.now() - started;
		const msg = e?.name === 'AbortError' ? 'timeout' : String(e?.message || e).slice(0, 200);
		return { ok: false, error: msg, latencyMs };
	}
}

function ensureEntry(domain: string): DomainState {
	if (!state[domain]) {
		state[domain] = {
			domain,
			status: 'unknown',
			consecutiveFailures: 0,
			lastCheckedAt: 0,
			lastStatusChangeAt: 0
		};
	}
	return state[domain];
}

async function checkAll() {
	const domains = getDomains();
	const now = Date.now();
	let anyChange = false;

	await Promise.all(
		domains.map(async (domain) => {
			const entry = ensureEntry(domain);
			const r = await checkOne(domain);
			entry.lastCheckedAt = now;
			entry.lastHttpStatus = r.status;
			entry.lastError = r.error;
			entry.lastLatencyMs = r.latencyMs;

			if (r.ok) {
				// Sucesso → zera contador
				if (entry.status === 'down') {
					// Transição DOWN → UP
					const downtimeMs = entry.lastStatusChangeAt
						? now - entry.lastStatusChangeAt
						: undefined;
					entry.status = 'up';
					entry.lastStatusChangeAt = now;
					entry.consecutiveFailures = 0;
					anyChange = true;
					notifyDomainUp({ domain, downtimeMs });
					console.log(`[domain-monitor] ${domain} UP (após ${downtimeMs}ms)`);
				} else if (entry.status === 'unknown') {
					// Primeira leitura → grava sem notificar
					entry.status = 'up';
					entry.lastStatusChangeAt = now;
					entry.consecutiveFailures = 0;
					anyChange = true;
				} else {
					// Já UP → nada a fazer
					if (entry.consecutiveFailures > 0) {
						entry.consecutiveFailures = 0;
						anyChange = true;
					}
				}
			} else {
				entry.consecutiveFailures += 1;
				if (entry.status !== 'down' && entry.consecutiveFailures >= FAILURES_BEFORE_DOWN) {
					// Transição UP → DOWN
					entry.status = 'down';
					entry.lastStatusChangeAt = now;
					anyChange = true;
					notifyDomainDown({
						domain,
						status: r.status,
						error: r.error,
						latencyMs: r.latencyMs
					});
					console.warn(`[domain-monitor] ${domain} DOWN`, r);
				} else {
					anyChange = true;
					console.warn(`[domain-monitor] ${domain} failure ${entry.consecutiveFailures}/${FAILURES_BEFORE_DOWN}`, r);
				}
			}
		})
	);

	if (anyChange) saveState();
}

export function initDomainMonitor() {
	if (started) return;
	started = true;
	loadState();
	// Roda 1x logo após boot pra pegar estado imediato, depois periódico
	setTimeout(() => { checkAll().catch((e) => console.error('[domain-monitor] check failed', e)); }, 5000);
	timer = setInterval(() => {
		checkAll().catch((e) => console.error('[domain-monitor] check failed', e));
	}, CHECK_INTERVAL_MS);
	console.log('[domain-monitor] started', {
		domains: getDomains(),
		intervalSec: CHECK_INTERVAL_MS / 1000
	});
}

export function getDomainStatus(): Array<DomainState> {
	return Object.values(state).sort((a, b) => a.domain.localeCompare(b.domain));
}

/**
 * Roda check imediato (usado por endpoint /api/admin/domain-status?force=1).
 */
export async function forceCheck() {
	await checkAll();
	return getDomainStatus();
}
