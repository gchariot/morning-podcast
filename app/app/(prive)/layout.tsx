import { requireLogin } from '@/lib/auth';
import { Tabs } from '@/components/Tabs';
import { AudioProvider } from '@/components/Audio';
import { UpdateWatcher } from '@/components/UpdateWatcher';
import { currentVersion } from '@/lib/version';

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  await requireLogin();
  return (
    <AudioProvider>
      <UpdateWatcher version={currentVersion()} />
      <main className="wrap">{children}</main>
      <Tabs />
    </AudioProvider>
  );
}
