/**
 * Abandoned popup tracking — /donate.
 *
 * Fluxo:
 *  1. Cliente abre popup do donate (escolheu valor mas nao foi pro Bancontact)
 *  2. POST /api/track/popup-open salva { sid, amount, fbp, fbclid, ts } aqui
 *  3. Worker do email-scheduler varre a cada 5min. Pra cada entry com >1h
 *     e sem purchase no mesmo sid:
 *       - Se sid mapeia pra email conhecido (via sid-email map), agenda
 *         um email de recovery (template 'abandoned-popup').
 *       - Se nao tem email mapeado, descarta silenciosamente (no spam).
 *  4. Webhook shopify-purchase atualiza sid-email map sempre que ha compra.
 *
 * Persistencia em .data/ — sobrevive a deploy. Limpa entries com >48h.
 */

import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.SCHEDULER_DATA_DIR || path.join(process.cwd(), '.data');
const POPUPS_FILE = path.join(DATA_DIR, 'abandoned-popups.json');
const SID_EMAIL_FILE = path.join(DATA_DIR, 'sid-email-map.json');
const MAX_AGE_MS = 48 * 60 * 60 * 1000; // descarta entries com >48h

export interface AbandonedPopup {
  sid: string;
  amount: number;
  ts: number;
  recoverySent?: boolean;
  // tracking pro Meta CAPI caso a gente queira disparar VC custom event
  fbp?: string | null;
  fbclid?: string | null;
}

function ensureDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.error('[abandoned-popups] cant create data dir', e);
  }
}

function loadPopups(): AbandonedPopup[] {
  try {
    if (!fs.existsSync(POPUPS_FILE)) return [];
    const raw = fs.readFileSync(POPUPS_FILE, 'utf-8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    console.error('[abandoned-popups] failed to load', e);
    return [];
  }
}

function savePopups(arr: AbandonedPopup[]) {
  try {
    ensureDir();
    fs.writeFileSync(POPUPS_FILE, JSON.stringify(arr, null, 2), 'utf-8');
  } catch (e) {
    console.error('[abandoned-popups] failed to save', e);
  }
}

function loadSidEmailMap(): Record<string, string> {
  try {
    if (!fs.existsSync(SID_EMAIL_FILE)) return {};
    const raw = fs.readFileSync(SID_EMAIL_FILE, 'utf-8');
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' ? obj : {};
  } catch (e) {
    console.error('[abandoned-popups] failed to load sid-email map', e);
    return {};
  }
}

function saveSidEmailMap(map: Record<string, string>) {
  try {
    ensureDir();
    fs.writeFileSync(SID_EMAIL_FILE, JSON.stringify(map, null, 2), 'utf-8');
  } catch (e) {
    console.error('[abandoned-popups] failed to save sid-email map', e);
  }
}

/**
 * Grava um popup_open. Se ja existe um pra mesmo sid (usuario abriu e fechou
 * varias vezes), atualiza o ts e amount (sempre o ultimo).
 */
export function trackPopupOpen(input: {
  sid: string;
  amount: number;
  fbp?: string | null;
  fbclid?: string | null;
}) {
  if (!input.sid || !input.amount) return;
  const arr = loadPopups();
  const cutoff = Date.now() - MAX_AGE_MS;
  // Limpa entries antigas no mesmo passe
  const fresh = arr.filter((p) => p.ts >= cutoff && p.sid !== input.sid);
  fresh.push({
    sid: input.sid,
    amount: input.amount,
    ts: Date.now(),
    fbp: input.fbp,
    fbclid: input.fbclid
  });
  savePopups(fresh);
}

/**
 * Marca recovery enviado pra um sid (apos worker disparar o email).
 */
export function markRecoverySent(sid: string) {
  const arr = loadPopups();
  const idx = arr.findIndex((p) => p.sid === sid);
  if (idx >= 0) {
    arr[idx].recoverySent = true;
    savePopups(arr);
  }
}

/**
 * Remove um sid da lista — chamado pelo webhook quando compra acontece
 * (evita disparar recovery pra quem ja converteu).
 */
export function removePopupBySid(sid: string) {
  const arr = loadPopups();
  const filtered = arr.filter((p) => p.sid !== sid);
  if (filtered.length !== arr.length) savePopups(filtered);
}

/**
 * Retorna abandoned popups que ja estao "estagnados" — abertos ha >minAgeMs
 * e sem recovery enviado. Worker usa pra processar.
 */
export function getStalePopups(minAgeMs: number): AbandonedPopup[] {
  const arr = loadPopups();
  const cutoff = Date.now() - minAgeMs;
  return arr.filter((p) => !p.recoverySent && p.ts <= cutoff);
}

/**
 * Atualiza sid → email mapping. Chamado pelo webhook shopify-purchase.
 * Mantem mapping pra futuros abandoned popups do mesmo browser session.
 */
export function setSidEmail(sid: string, email: string) {
  if (!sid || !email) return;
  const map = loadSidEmailMap();
  map[sid] = email.toLowerCase().trim();
  saveSidEmailMap(map);
}

export function getEmailForSid(sid: string): string | null {
  const map = loadSidEmailMap();
  return map[sid] || null;
}
