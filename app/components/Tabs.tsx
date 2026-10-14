'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from './Icon';

const TABS: { href: string; icon: IconName; label: string }[] = [
  { href: '/', icon: 'headphones', label: 'Écouter' },
  { href: '/avis', icon: 'message', label: 'Mon avis' },
  { href: '/themes', icon: 'layers', label: 'Thèmes' },
  { href: '/reglages', icon: 'settings', label: 'Réglages' },
];

export function Tabs() {
  const path = usePathname();
  return (
    <nav className="tabs" aria-label="Navigation principale">
      {TABS.map(t => (
        <Link key={t.href} href={t.href} aria-current={path === t.href ? 'page' : undefined}>
          <Icon name={t.icon} size={24} />
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
