import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

const COOKIE = 'matinale_session';
const MAX_AGE = 60 * 60 * 24 * 90; // 90 jours

function secret(): string {
  const s = process.env.APP_SECRET;
  if (!s || s.length < 16) throw new Error('APP_SECRET manquant ou trop court (16 caractères minimum).');
  return s;
}

function sign(value: string): string {
  return createHmac('sha256', secret()).update(value).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a), bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function checkPassword(input: string): boolean {
  const expected = process.env.APP_PASSWORD;
  if (!expected) throw new Error('APP_PASSWORD manquant.');
  // Comparaison des empreintes : temps constant, quelle que soit la longueur saisie.
  return safeEqual(sign(`pw:${input}`), sign(`pw:${expected}`));
}

/**
 * Signature de session liée au mot de passe actuel : changer APP_PASSWORD (ou APP_SECRET)
 * déconnecte tous les appareils, sans base de données.
 */
function sessionMac(payload: string): string {
  return sign(`session:${payload}:${sign(`pw:${process.env.APP_PASSWORD ?? ''}`)}`);
}

/* ---------- Essais de mot de passe : freiner la force brute ---------- */
const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const fails = new Map<string, { n: number; since: number }>();

async function clientKey(): Promise<string> {
  const h = await headers();
  return (h.get('x-real-ip') || h.get('x-forwarded-for')?.split(',')[0] || 'inconnu').trim();
}

/** Minutes de blocage restantes pour cet appareil (0 = peut essayer). */
export async function lockedMinutes(): Promise<number> {
  const f = fails.get(await clientKey());
  if (!f || f.n < MAX_FAILS) return 0;
  const left = f.since + WINDOW_MS - Date.now();
  if (left <= 0) { fails.delete(await clientKey()); return 0; }
  return Math.ceil(left / 60000);
}

export async function noteFailure() {
  const k = await clientKey();
  const f = fails.get(k);
  const now = Date.now();
  if (!f || now - f.since > WINDOW_MS) fails.set(k, { n: 1, since: now });
  else f.n++;
  if (fails.size > 1000) fails.clear(); // garde-fou mémoire
  await new Promise(r => setTimeout(r, 800)); // chaque erreur coûte du temps
}

export async function clearFailures() {
  fails.delete(await clientKey());
}

export async function openSession() {
  const expires = Date.now() + MAX_AGE * 1000;
  const payload = `v2.${expires}`;
  (await cookies()).set(COOKIE, `${payload}.${sessionMac(payload)}`, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: MAX_AGE,
  });
}

export async function closeSession() {
  (await cookies()).delete(COOKIE);
}

/** Mot de passe facultatif : sans APP_PASSWORD, l'appli est ouverte (usage personnel). */
export function passwordEnabled(): boolean {
  return Boolean(process.env.APP_PASSWORD);
}

export async function isLoggedIn(): Promise<boolean> {
  if (!passwordEnabled()) return true;
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return false;
  const i = raw.lastIndexOf('.');
  if (i < 0) return false;
  const payload = raw.slice(0, i), mac = raw.slice(i + 1);
  if (!payload.startsWith('v2.') || !safeEqual(mac, sessionMac(payload))) return false;
  const expires = Number(payload.split('.')[1]);
  return Number.isFinite(expires) && expires > Date.now();
}

/** À appeler en tête de chaque page privée et de chaque action serveur. */
export async function requireLogin() {
  if (!(await isLoggedIn())) redirect('/login');
}
