import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Les onglets déjà vus (ou préchargés) s'affichent sans repasser par le serveur pendant 2 min.
    // Chaque action qui enregistre (revalidatePath / updateTag) et le retour sur l'appli (router.refresh) vident ce cache.
    staleTimes: { dynamic: 120, static: 300 },
  },
};

export default nextConfig;
