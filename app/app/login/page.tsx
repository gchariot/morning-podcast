import { redirect } from 'next/navigation';
import { checkPassword, isLoggedIn, openSession, passwordEnabled } from '@/lib/auth';

async function login(formData: FormData) {
  'use server';
  if (!passwordEnabled()) redirect('/');
  const password = String(formData.get('password') ?? '');
  if (!checkPassword(password)) redirect('/login?erreur=1');
  await openSession();
  redirect('/');
}

export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  if (await isLoggedIn()) redirect('/');
  const { erreur } = await searchParams;
  return (
    <main className="login">
      <img className="mark" src="/cover.jpg" alt="" width={72} height={72} />
      <h1>La Matinale</h1>
      <p>L&apos;émission du matin, réglée par ceux qui l&apos;écoutent.</p>
      <form action={login}>
        <div className="field">
          <label htmlFor="password">Mot de passe</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus />
        </div>
        {erreur && <div className="flash err" role="alert" style={{ marginTop: 12 }}><p>Mot de passe incorrect. Réessaie.</p></div>}
        <button className="btn primary block" type="submit" style={{ marginTop: 16 }}>Se connecter</button>
      </form>
    </main>
  );
}
