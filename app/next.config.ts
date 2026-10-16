import type { NextConfig } from 'next';

/**
 * En-têtes de sécurité pour toutes les réponses. L'audio et la pochette viennent du stockage (https),
 * tout le reste de l'appli elle-même ; personne ne peut l'afficher dans un cadre (clic détourné).
 */
const storage = (() => { try { return new URL(process.env.PUBLIC_BASE_URL ?? '').origin; } catch { return ''; } })();
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https: ${storage}`,
  `media-src 'self' https: ${storage}`,
  "font-src 'self' data:",
  // Séance avec Nora : connexion directe du téléphone à Gemini Live (jeton à usage unique).
  "connect-src 'self' wss://generativelanguage.googleapis.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CSP },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'same-origin' },
  // Micro : « Dis-le » et la séance avec Nora, sur l'appli elle-même seulement.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=(), payment=(), usb=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
  experimental: {
    // Les onglets déjà vus (ou préchargés) s'affichent sans repasser par le serveur pendant 2 min.
    // Chaque action qui enregistre (revalidatePath / updateTag) et le retour sur l'appli (router.refresh) vident ce cache.
    staleTimes: { dynamic: 120, static: 300 },
    // Réseau coupé pendant un changement d'onglet : attendre qu'il revienne au lieu de recharger la page
    // (un rechargement couperait l'épisode et, dans un tunnel, finirait sur la page d'erreur du navigateur).
    useOffline: true,
  },
};

export default nextConfig;
