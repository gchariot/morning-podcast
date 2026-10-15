'use client';
/** − valeur + : réglage d'une durée au pouce, sans clavier. */
import { Icon } from './Icon';

const fmt = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });

export function Stepper({ value, min, max, step = 1, unit = 'min', onChange, label, labelledBy }: {
  value: number; min: number; max: number; step?: number; unit?: string;
  onChange: (v: number) => void; label?: string; labelledBy?: string;
}) {
  const move = (d: number) => onChange(Math.min(max, Math.max(min, Math.round((value + d) / step) * step)));
  return (
    <div className="stepper" role="group" aria-label={label} aria-labelledby={labelledBy}>
      <button type="button" onClick={() => move(-step)} disabled={value <= min} aria-label={`Moins (${fmt(step)} ${unit})`}>
        <Icon name="minus" size={18} />
      </button>
      <output aria-live="polite">{fmt(value)} {unit}</output>
      <button type="button" onClick={() => move(step)} disabled={value >= max} aria-label={`Plus (${fmt(step)} ${unit})`}>
        <Icon name="plus" size={18} />
      </button>
    </div>
  );
}
