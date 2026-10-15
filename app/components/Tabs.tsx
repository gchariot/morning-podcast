'use client';
import { useEffect } from 'react';
import Link, { useLinkStatus } from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from './Icon';
import { useSnack } from './Snack';
import { useAudio } from './Audio';

const TABS: { href: string; icon: IconName; label: string }[] = [
  { href: '/', icon: 'headphones', label: 'Écouter' },
  { href: '/avis', icon: 'message', label: 'Mon avis' },
  { href: '/themes', icon: 'layers', label: 'Thèmes' },
  { href: '/reglages', icon: 'settings', label: 'Réglages' },
];

/** Au-delà de ce délai sans réponse (tunnel où le réseau « fait semblant »), on le dit. */
const SLOW_MS = 4000;

/**
 * Onglets préchargés en entier : passer de l'un à l'autre ne doit pas attendre le réseau (train, tunnels).
 * Si le réseau ne répond pas, la page ne se recharge pas (experimental.useOffline) : l'onglet attend
 * le retour du réseau, le son continue, et un message l'explique.
 */
export function Tabs() {
  const path = usePathname();
  return (
    <nav className="tabs" aria-label="Navigation principale">
      {TABS.map(t => (
        <Link key={t.href} href={t.href} prefetch aria-current={path === t.href ? 'page' : undefined}>
          <Icon name={t.icon} size={24} />
          {t.label}
          <SlowWatch label={t.label} />
        </Link>
      ))}
    </nav>
  );
}

function SlowWatch({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  const { show, close } = useSnack();
  const { playing } = useAudio();
  useEffect(() => {
    if (!pending) return;
    let shown = false;
    const t = setTimeout(() => {
      shown = true;
      show({ ok: true, neutral: true, message: `Le réseau ne répond pas : « ${label} » s’ouvrira dès que ça capte.${playing ? ' L’écoute continue.' : ''}` });
    }, SLOW_MS);
    return () => { clearTimeout(t); if (shown) close(); };
    // `playing` lu au moment du délai suffit ; ne pas relancer le minuteur s'il change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, label, show, close]);
  return null;
}
