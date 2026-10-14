import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'La Matinale',
  description: 'Mon podcast quotidien : écouter, donner mon avis, régler les thèmes.',
  robots: { index: false, follow: false },
  icons: { icon: '/cover.jpg', apple: '/cover.jpg' },
  appleWebApp: { capable: true, title: 'La Matinale', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f3f0' },
    { media: '(prefers-color-scheme: dark)', color: '#121110' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
