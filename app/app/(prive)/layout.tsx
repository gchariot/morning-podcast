import { requireLogin } from '@/lib/auth';
import { Tabs } from '@/components/Tabs';
import { AudioProvider } from '@/components/Audio';
import { UpdateWatcher } from '@/components/UpdateWatcher';
import { currentVersion } from '@/lib/version';
import { SnackProvider } from '@/components/Snack';
import { Connectivity } from '@/components/Connectivity';

// Toujours rendu à la demande : les pages lisent le dépôt, avec ou sans mot de passe.
export const dynamic = 'force-dynamic';

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  await requireLogin();
  return (
    <SnackProvider>
      <AudioProvider>
        <UpdateWatcher version={currentVersion()} />
        <Connectivity />
        <a className="skip-link" href="#contenu">Aller au contenu</a>
        <main className="wrap" id="contenu">{children}</main>
        <Tabs />
      </AudioProvider>
    </SnackProvider>
  );
}
