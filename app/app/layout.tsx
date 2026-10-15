import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/figtree/wght.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'La Matinale',
  description: 'Mon podcast quotidien : écouter, donner mon avis, régler les thèmes.',
  robots: { index: false, follow: false },
  icons: { icon: '/cover.jpg', apple: '/cover.jpg' },
  appleWebApp: { capable: true, title: 'La Matinale', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    // La barre d'état prend la couleur du ciel nocturne de la pochette (haut du bandeau).
    { media: '(prefers-color-scheme: light)', color: '#141a3a' },
    { media: '(prefers-color-scheme: dark)', color: '#141a3a' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
