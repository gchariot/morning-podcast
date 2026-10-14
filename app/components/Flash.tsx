export function Flash({ ok, err }: { ok?: string; err?: string }) {
  if (err) return <div className="flash err" role="alert"><p><strong>Pas enregistré.</strong> {err}</p></div>;
  if (ok) return <div className="flash ok" role="status"><p>{ok}</p></div>;
  return null;
}

export type FlashParams = Promise<{ ok?: string; err?: string }>;
