import { requireLogin } from '@/lib/auth';
import { Tabs } from '@/components/Tabs';
import { AudioProvider } from '@/components/Audio';
import { UpdateWatcher } from '@/components/UpdateWatcher';

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  await requireLogin();
  return (
    <AudioProvider>
      <UpdateWatcher />
      <main className="wrap">{children}</main>
      <Tabs />
    </AudioProvider>
  );
}
