'use client';
/**
 * Page Thèmes : le conducteur de l'épisode.
 * Tout s'enregistre sur place (pas de rechargement) : la saisie en cours n'est jamais perdue,
 * chaque écriture est confirmée en bas d'écran, et une suppression peut être annulée.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  DndContext, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from '@/components/Icon';
import {
  deleteTheme, reorderRubriques, restoreTheme, saveTheme, setThemeEnabled, type ThemeResult,
} from '@/app/(prive)/actions';
import type { Rubrique } from '@/lib/config';

const PINNED = 'meteo';
const MAX_DOMAINS = 25;
const DOMAIN_RE = /^[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?$/i;
const EXAMPLES: Record<string, string> = {
  foot: 'lequipe.fr', politique: 'letemps.ch', ia: 'anthropic.com', jeux: 'gamekult.com',
  cinema: 'allocine.fr', culture: 'nationalgeographic.fr', meteo: 'meteosuisse.admin.ch',
};
// Zones où un appui ne démarre jamais un déplacement.
const NO_DRAG = 'input, textarea, select, button:not(.row-main), a, label, .editor';

const fmtMin = (m: number) => m.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
const cueLabel = (m: number) => {
  const s = Math.round(m * 60);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
/** « https://www.lequipe.fr/Football/ » → « lequipe.fr/football » */
function cleanDomain(raw: string): string {
  return raw.trim().toLowerCase()
    .replace(/^[a-z]+:\/\//, '').replace(/^www\./, '')
    .replace(/[?#].*$/, '').replace(/\/+$/, '');
}

type Snack = { message: string; ok: boolean; undo?: () => void };
type Draft = { minutes: number; dirty: boolean };

/* ---------------------------------------------------------------- */

export function ThemesEditor({ initial, target }: { initial: Rubrique[]; target: number }) {
  const [list, setList] = useState(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [snack, setSnack] = useState<Snack | null>(null);
  const [busy, setBusy] = useState(0);

  // Les écritures passent une par une : chacune relit la version la plus récente du fichier.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const send = useCallback((fn: () => Promise<ThemeResult>, undo?: (res: ThemeResult) => (() => void) | undefined) => {
    setBusy(b => b + 1);
    const p = queue.current.then(fn).catch((e: unknown) => ({ ok: false, message: e instanceof Error ? e.message : String(e) }) as ThemeResult);
    queue.current = p;
    return p.then(res => {
      setBusy(b => b - 1);
      if (res.ok && res.rubriques) setList(res.rubriques);
      setSnack({ message: res.message, ok: res.ok, undo: res.ok ? undo?.(res) : undefined });
      return res;
    });
  }, []);

  const closeSnack = useCallback(() => setSnack(null), []);
  const setDraft = useCallback((id: string, d: Draft) => {
    setDrafts(prev => (prev[id]?.minutes === d.minutes && prev[id]?.dirty === d.dirty ? prev : { ...prev, [id]: d }));
  }, []);

  /* Conducteur : heure de départ de chaque thème, durées en cours de saisie comprises. */
  const minutesOf = useCallback((r: Rubrique) => drafts[r.id]?.minutes ?? r.minutes, [drafts]);
  const active = list.filter(r => r.enabled !== false);
  const total = active.reduce((s, r) => s + minutesOf(r), 0);
  const scale = total > target ? target / total : 1;
  const cues = useMemo(() => {
    const out: Record<string, number> = {};
    let t = 0;
    for (const r of list) {
      if (r.enabled === false) continue;
      out[r.id] = t;
      t += minutesOf(r) * scale;
    }
    return out;
  }, [list, minutesOf, scale]);
  const over = total > target * 1.15;
  const cut = Math.round((1 - target / total) * 100);

  const sortable = list.filter(r => r.id !== PINNED);
  const pinned = list.find(r => r.id === PINNED);

  /* Glisser-déposer */
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const justDragged = useRef(false);
  const onDragEnd = ({ active: a, over: o }: DragEndEvent) => {
    justDragged.current = true;
    setTimeout(() => { justDragged.current = false; }, 60);
    if (!o || a.id === o.id) return;
    const before = list;
    const moved = arrayMove(sortable, sortable.findIndex(r => r.id === a.id), sortable.findIndex(r => r.id === o.id));
    const next = pinned ? [...moved, pinned] : moved;
    setList(next);
    send(() => reorderRubriques(next.map(r => r.id))).then(res => { if (!res.ok) setList(before); });
  };

  const toggle = (r: Rubrique, enabled: boolean) => {
    const before = list;
    setList(list.map(x => (x.id === r.id ? { ...x, enabled } : x)));
    send(() => setThemeEnabled(r.id, enabled)).then(res => { if (!res.ok) setList(before); });
  };

  const remove = (r: Rubrique) => {
    const index = list.findIndex(x => x.id === r.id);
    setOpen(null);
    send(() => deleteTheme(r.id), () => () => send(() => restoreTheme(r, index)));
  };

  const rowProps = (r: Rubrique) => ({
    r,
    cue: cues[r.id],
    minutes: minutesOf(r),
    dirty: drafts[r.id]?.dirty ?? false,
    expanded: open === r.id,
    onExpand: () => { if (!justDragged.current) setOpen(o => (o === r.id ? null : r.id)); },
    onToggle: (v: boolean) => toggle(r, v),
    editor: (
      <ThemeForm
        key={formKey(r)} r={r} busy={busy > 0} onDraft={setDraft}
        onSave={input => send(() => saveTheme({ ...input, id: r.id })).then(res => { if (res.ok) setOpen(null); return res; })}
        onDelete={r.id === PINNED ? undefined : () => remove(r)}
      />
    ),
  });

  return (
    <>
      <div className="group pad run-card">
        <div className="run-head">
          <span className="run-total num">{fmtMin(total)} <small>/ {target} min visées</small></span>
          <span className="muted small">{active.length} thème{active.length > 1 ? 's' : ''} actif{active.length > 1 ? 's' : ''}</span>
        </div>
        <div className={`meter${over ? ' over' : ''}`} aria-hidden><i style={{ width: `${Math.min(100, (total / target) * 100)}%` }} /></div>
        {over
          ? <p className="run-note over">C&apos;est {fmtMin(total - target)} min de trop : la rédaction raccourcira chaque thème d&apos;environ {cut} %. Les heures ci-dessous en tiennent compte.</p>
          : <p className="run-note">Heures de départ indicatives pour une édition de semaine.</p>}
      </div>

      <div className="group" style={{ marginTop: 16 }} onClickCapture={e => { if (justDragged.current) { e.preventDefault(); e.stopPropagation(); } }}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} modifiers={[restrictToVerticalAxis, restrictToParentElement]}>
          <SortableContext items={sortable.map(r => r.id)} strategy={verticalListSortingStrategy}>
            <div>{sortable.map(r => <SortableRow key={r.id} {...rowProps(r)} locked={busy > 0} />)}</div>
          </SortableContext>
        </DndContext>
        {pinned && <Row {...rowProps(pinned)} pinned />}
      </div>
      <p className="field-hint">Pour changer l&apos;ordre, maintiens un thème appuyé puis glisse-le. La météo reste toujours en dernier.</p>

      <NewTheme busy={busy > 0} onCreate={input => send(() => saveTheme(input))} />

      <div aria-live="polite" aria-atomic="true">{snack && <SnackBar snack={snack} onClose={closeSnack} />}</div>
    </>
  );
}

/** Clé du formulaire : il repart des valeurs enregistrées quand le contenu change, pas sur une simple pause. */
const formKey = (r: Rubrique) => JSON.stringify([r.id, r.title, r.minutes, r.brief, r.domains]);

/* ---------------------------------------------------------------- */

type RowProps = {
  r: Rubrique; cue?: number; minutes: number; dirty: boolean; expanded: boolean;
  onExpand: () => void; onToggle: (v: boolean) => void; editor: React.ReactNode;
};

function SortableRow(props: RowProps & { locked: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.r.id, disabled: props.locked });
  const rowListeners = Object.fromEntries(
    Object.entries(listeners ?? {}).map(([name, fn]) => [name, (e: React.SyntheticEvent) => {
      if ((e.target as Element).closest(NO_DRAG)) return;
      (fn as (ev: React.SyntheticEvent) => void)(e);
    }]),
  );
  return (
    <Row
      {...props}
      rootRef={setNodeRef}
      rootProps={{ ...rowListeners, style: { transform: CSS.Transform.toString(transform), transition } }}
      dragging={isDragging}
      keyboardHandle={
        <button type="button" className="sr" aria-label={`Déplacer ${props.r.title} (Espace, puis flèches)`} {...attributes} onKeyDown={listeners?.onKeyDown as React.KeyboardEventHandler} />
      }
    />
  );
}

function Row({
  r, cue, minutes, dirty, expanded, onExpand, onToggle, editor, pinned, rootRef, rootProps, dragging, keyboardHandle,
}: RowProps & {
  pinned?: boolean; rootRef?: (el: HTMLElement | null) => void; rootProps?: React.HTMLAttributes<HTMLDivElement>;
  dragging?: boolean; keyboardHandle?: React.ReactNode;
}) {
  const id = useId();
  const on = r.enabled !== false;
  const meta = pinned ? `${fmtMin(minutes)} min · toujours en dernier` : `${fmtMin(minutes)} min · ${r.brief}`;
  return (
    <div ref={rootRef} {...rootProps} className={`theme${pinned ? '' : ' sortable-theme'}${on ? '' : ' off'}${dragging ? ' dragging' : ''}`}>
      <div className="theme-line">
        {pinned
          ? <span className="lock" title="Toujours en dernier"><Icon name="lock" size={16} /></span>
          : <span className="handle" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
                <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
                <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
              </svg>
            </span>}
        <span className="cue" aria-hidden>{on && cue !== undefined ? cueLabel(cue) : '—'}</span>
        <button type="button" className="row-main" aria-expanded={expanded} aria-controls={id} onClick={onExpand}>
          <span className="row-title">
            <strong>{r.title}</strong>
            {dirty && <span className="pill">Non enregistré</span>}
            <Icon name="chevron-right" size={18} className="chev" />
          </span>
          <span className="row-meta">
            {on ? meta : 'En pause : absent des prochains épisodes'}
            {on && cue !== undefined && <span className="sr">, commence vers {cueLabel(cue)}</span>}
          </span>
        </button>
        <label className="switch-hit">
          <input type="checkbox" className="switch" checked={on} onChange={e => onToggle(e.target.checked)} aria-label={`Diffuser ${r.title}`} />
        </label>
        {keyboardHandle}
      </div>
      <div className="editor" id={id} hidden={!expanded}>{editor}</div>
    </div>
  );
}

/* ---------------------------------------------------------------- */

type Input = { title: string; minutes: number; brief: string; domains: string[] };

function ThemeForm({
  r, busy, onDraft, onSave, onDelete, submitLabel = 'Enregistrer',
}: {
  r?: Rubrique; busy: boolean; onDraft?: (id: string, d: Draft) => void;
  onSave: (input: Input) => Promise<ThemeResult>; onDelete?: () => void; submitLabel?: string;
}) {
  const uid = useId();
  const [title, setTitle] = useState(r?.title ?? '');
  const [minutes, setMinutes] = useState(r?.minutes ?? 3);
  const [brief, setBrief] = useState(r?.brief ?? '');
  const [domains, setDomains] = useState<string[]>(r?.domains ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dirty = !r
    ? Boolean(title || brief || domains.length)
    : title !== r.title || minutes !== r.minutes || brief !== r.brief || domains.join() !== r.domains.join();

  useEffect(() => { if (r) onDraft?.(r.id, { minutes, dirty }); }, [r, minutes, dirty, onDraft]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await onSave({ title, minutes, brief, domains });
    setSaving(false);
    if (!res.ok) setError(res.message);
  };

  const step = (d: number) => setMinutes(m => Math.min(10, Math.max(0.5, Math.round((m + d) * 2) / 2)));

  return (
    <form onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor={`${uid}t`}>Nom du thème</label>
        <input id={`${uid}t`} type="text" value={title} onChange={e => setTitle(e.target.value)} maxLength={60} placeholder="Ex. : Formule 1" autoComplete="off" />
      </div>

      <div className="field">
        <span className="label" id={`${uid}m`}>Durée</span>
        <div className="stepper" role="group" aria-labelledby={`${uid}m`}>
          <button type="button" onClick={() => step(-0.5)} disabled={minutes <= 0.5} aria-label="Une demi-minute de moins"><Icon name="minus" size={18} /></button>
          <output aria-live="polite">{fmtMin(minutes)} min</output>
          <button type="button" onClick={() => step(0.5)} disabled={minutes >= 10} aria-label="Une demi-minute de plus"><Icon name="plus" size={18} /></button>
        </div>
      </div>

      <div className="field">
        <label htmlFor={`${uid}b`}>Consigne pour la rédaction</label>
        <textarea
          id={`${uid}b`} value={brief} onChange={e => setBrief(e.target.value)} maxLength={1200}
          placeholder="Ce qui t'intéresse, ce qu'il faut éviter, ce qui passe en premier…"
        />
        <div className="field-row">
          <span className="field-hint">{brief.trim().length < 10 ? '10 caractères minimum.' : 'Lue chaque nuit par la rédaction.'}</span>
          <span className="field-hint num">{brief.length} / 1200</span>
        </div>
      </div>

      <DomainInput value={domains} onChange={setDomains} example={EXAMPLES[r?.id ?? ''] ?? 'formula1.com'} />

      {error && <p className="editor-err" role="alert">{error}</p>}
      <div className="editor-foot">
        <button className="btn primary" type="submit" disabled={!dirty || saving || busy} aria-busy={saving}>
          {saving ? 'Enregistrement…' : submitLabel}
        </button>
      </div>

      {onDelete && (
        <div className="editor-del">
          <button type="button" className="btn small danger" onClick={onDelete} disabled={busy}>
            <Icon name="trash" size={16} /> Supprimer ce thème
          </button>
        </div>
      )}
    </form>
  );
}

/* ---------------------------------------------------------------- */

function DomainInput({ value, onChange, example }: { value: string[]; onChange: (v: string[]) => void; example: string }) {
  const uid = useId();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = (raw: string) => {
    const parts = raw.split(/[\s,;]+/).map(cleanDomain).filter(Boolean);
    if (!parts.length) return;
    const next = [...value];
    const bad: string[] = [];
    for (const d of parts) {
      if (!DOMAIN_RE.test(d)) bad.push(d);
      else if (!next.includes(d) && next.length < MAX_DOMAINS) next.push(d);
    }
    onChange(next);
    if (bad.length) {
      setText(bad.join(' '));
      setError(`« ${bad[0]} » n’est pas une adresse de site. Exemple : ${example}`);
    } else if (parts.length > 0 && next.length >= MAX_DOMAINS && parts.some(d => !next.includes(d))) {
      setText('');
      setError(`${MAX_DOMAINS} sites maximum.`);
    } else {
      setText('');
      setError(null);
    }
  };

  return (
    <div className="field">
      <label htmlFor={`${uid}d`}>Sites de référence</label>
      <div className={`domains${error ? ' invalid' : ''}`}>
        {value.map(d => (
          <span className="domain" key={d}>
            <span>{d}</span>
            <button type="button" onClick={() => onChange(value.filter(x => x !== d))} aria-label={`Retirer ${d}`}><Icon name="x" size={14} /></button>
          </span>
        ))}
        {value.length < MAX_DOMAINS && (
          <input
            id={`${uid}d`} type="text" value={text} placeholder={value.length ? 'Ajouter un site' : `Ex. : ${example}`}
            inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" enterKeyHint="done"
            aria-describedby={`${uid}h`} aria-invalid={Boolean(error)}
            onChange={e => { setText(e.target.value); if (error) setError(null); }}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ',' || e.key === ' ') { e.preventDefault(); add(text); }
              if (e.key === 'Backspace' && !text && value.length) { e.preventDefault(); setText(value[value.length - 1]); onChange(value.slice(0, -1)); }
            }}
            onPaste={e => { e.preventDefault(); add(`${text} ${e.clipboardData.getData('text')}`); }}
            onBlur={() => add(text)}
          />
        )}
      </div>
      <div className="field-row" id={`${uid}h`}>
        {error
          ? <span className="field-error" role="alert">{error}</span>
          : <span className="field-hint">La rédaction les privilégie sans s&apos;y limiter. Colle une adresse, elle sera nettoyée.</span>}
        <span className="field-hint num">{value.length} / {MAX_DOMAINS}</span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */

function NewTheme({ busy, onCreate }: { busy: boolean; onCreate: (input: Input) => Promise<ThemeResult> }) {
  const [open, setOpen] = useState(false);
  const [n, setN] = useState(0); // remet le formulaire à zéro après une création
  const id = useId();
  return (
    <section className="section">
      <div className="group">
        <button type="button" className="add-row" aria-expanded={open} aria-controls={id} onClick={() => setOpen(o => !o)}>
          <Icon name="plus" /> Nouveau thème <Icon name="chevron-right" size={18} className="chev" />
        </button>
        <div className="editor" id={id} hidden={!open} style={{ paddingLeft: 16 }}>
          <ThemeForm
            key={n} busy={busy} submitLabel="Créer le thème"
            onSave={input => onCreate(input).then(res => { if (res.ok) { setOpen(false); setN(x => x + 1); } return res; })}
          />
          <p className="field-hint" style={{ marginTop: 12 }}>Il s&apos;ajoute juste avant la météo, qui clôt toujours l&apos;épisode. Tu pourras le déplacer ensuite.</p>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- */

function SnackBar({ snack, onClose }: { snack: Snack; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, snack.undo ? 8000 : snack.ok ? 4000 : 9000);
    return () => clearTimeout(t);
  }, [snack, onClose]);
  return (
    <div className={`snack${snack.ok ? '' : ' err'}`}>
      {snack.ok && <Icon name="check" size={18} />}
      <p>{snack.message}</p>
      {snack.undo
        ? <button type="button" className="btn small" onClick={() => { snack.undo?.(); onClose(); }}>Annuler</button>
        : <button type="button" className="btn small icon" onClick={onClose} aria-label="Fermer"><Icon name="x" size={16} /></button>}
    </div>
  );
}
