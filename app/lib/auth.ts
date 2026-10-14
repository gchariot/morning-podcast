import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
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

export async function openSession() {
  const expires = Date.now() + MAX_AGE * 1000;
  const payload = `v1.${expires}`;
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: MAX_AGE,
  });
}

export async function closeSession() {
  (await cookies()).delete(COOKIE);
}

export async function isLoggedIn(): Promise<boolean> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return false;
  const i = raw.lastIndexOf('.');
  if (i < 0) return false;
  const payload = raw.slice(0, i), mac = raw.slice(i + 1);
  if (!safeEqual(mac, sign(payload))) return false;
  const expires = Number(payload.split('.')[1]);
  return Number.isFinite(expires) && expires > Date.now();
}

/** À appeler en tête de chaque page privée et de chaque action serveur. */
export async function requireLogin() {
  if (!(await isLoggedIn())) redirect('/login');
}
