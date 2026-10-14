'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/', icon: '🎧', label: 'Écouter' },
  { href: '/avis', icon: '💬', label: 'Mon avis' },
  { href: '/themes', icon: '🧩', label: 'Thèmes' },
  { href: '/reglages', icon: '⚙️', label: 'Réglages' },
];

export function Tabs() {
  const path = usePathname();
  return (
    <nav className="tabs" aria-label="Navigation principale">
      {TABS.map(t => (
        <Link key={t.href} href={t.href} aria-current={path === t.href ? 'page' : undefined}>
          <span aria-hidden>{t.icon}</span>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
