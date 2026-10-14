import { redirect } from 'next/navigation';
import { checkPassword, isLoggedIn, openSession } from '@/lib/auth';

async function login(formData: FormData) {
  'use server';
  const password = String(formData.get('password') ?? '');
  if (!checkPassword(password)) redirect('/login?erreur=1');
  await openSession();
  redirect('/');
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  if (await isLoggedIn()) redirect('/');
  const { erreur } = await searchParams;
  return (
    <main className="wrap" style={{ maxWidth: 420, paddingTop: '18vh' }}>
      <p className="kicker">Chaque matin · 20 min</p>
      <h1>La Matinale</h1>
      <p className="muted">Ton podcast, tes thèmes, tes retours.</p>
      <form action={login} className="stack" style={{ marginTop: 24 }}>
        <div>
          <label htmlFor="password">Mot de passe</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus />
        </div>
        {erreur && <p className="flash err">Mot de passe incorrect.</p>}
        <button className="btn primary" type="submit" style={{ width: '100%' }}>Entrer</button>
      </form>
    </main>
  );
}
