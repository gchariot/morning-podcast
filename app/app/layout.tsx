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
  // Toujours en sombre : la barre d'état prend la nuit de la pochette.
  themeColor: '#141a3a',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" style={{ colorScheme: 'dark' }}>
      <body>{children}</body>
    </html>
  );
}
