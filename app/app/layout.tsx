import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'La Matinale',
  description: 'Mon podcast quotidien : écouter, donner mon avis, régler les thèmes.',
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: 'La Matinale', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = { themeColor: '#0e1630', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
