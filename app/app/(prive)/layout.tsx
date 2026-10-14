import { requireLogin } from '@/lib/auth';
import { Tabs } from '@/components/Tabs';


export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  await requireLogin();
  return (
    <>
      <main className="wrap">{children}</main>
      <Tabs />
    </>
  );
}
