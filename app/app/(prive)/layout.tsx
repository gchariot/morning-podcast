import { requireLogin } from '@/lib/auth';
import { Tabs } from '@/components/Tabs';
import { AudioProvider } from '@/components/Audio';

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  await requireLogin();
  return (
    <AudioProvider>
      <main className="wrap">{children}</main>
      <Tabs />
    </AudioProvider>
  );
}
