export function Flash({ ok, err }: { ok?: string; err?: string }) {
  if (err) return <p className="flash err" role="alert">{err}</p>;
  if (ok) return <p className="flash ok" role="status">{ok}</p>;
  return null;
}

export type FlashParams = Promise<{ ok?: string; err?: string }>;
