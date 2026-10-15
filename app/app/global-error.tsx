'use client';
/** Dernier filet : même la mise en page n'a pas pu se charger. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '18vh 24px', maxWidth: 420, margin: '0 auto', background: '#f4f3f0', color: '#1b1a17' }}>
        <h1 style={{ fontSize: 24 }}>La Matinale n&apos;a pas pu s&apos;ouvrir</h1>
        <p style={{ color: '#5f5c55', lineHeight: 1.5 }}>Vérifie le réseau, puis réessaie.</p>
        <button
          type="button" onClick={() => reset()}
          style={{ marginTop: 16, font: 'inherit', fontWeight: 600, padding: '12px 18px', minHeight: 44, borderRadius: 12, border: 0, background: '#c2410c', color: '#fff' }}
        >
          Réessayer
        </button>
      </body>
    </html>
  );
}
