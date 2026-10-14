import type { NextConfig } from 'next';

// Version de ce déploiement, gravée dans le code envoyé au téléphone.
// Comparée à /api/version (toujours la dernière version en ligne) pour proposer la mise à jour.
const APP_VERSION = process.env.VERCEL_GIT_COMMIT_SHA || process.env.APP_VERSION || `local-${Date.now()}`;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  env: { APP_VERSION },
};

export default nextConfig;
