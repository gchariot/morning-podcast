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
import { Stepper } from '@/components/Stepper';
import { useSnack } from '@/components/Snack';
import { OFFLINE, safeCall } from '@/lib/safe';
import { useOnline } from '@/components/Connectivity';
import {
  deleteTheme, reorderRubriques, restoreTheme, saveSettings, saveTheme, setThemeEnabled, type ThemeResult,
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

type Draft = { minutes: number; dirty: boolean };

/* ---------------------------------------------------------------- */

export function ThemesEditor({ initial, target: targetInit }: { initial: Rubrique[]; target: number }) {
  const [list, setList] = useState(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [target, setTarget] = useState(targetInit);
  const { show } = useSnack();
  const [busy, setBusy] = useState(0);

  // Les écritures passent une par une : chacune relit la version la plus récente du fichier.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  // `quiet` : les erreurs restent dans le formulaire, sans doublon en bas d'écran.
  const send = useCallback((fn: () => Promise<ThemeResult>, opts: { undo?: () => void; quiet?: boolean } = {}) => {
    setBusy(b => b + 1);
    const p = queue.current.then(() => safeCall(fn));
    queue.current = p;
    return p.then(res => {
      setBusy(b => b - 1);
      if (res.ok && res.rubriques) setList(res.rubriques);
      if (res.ok || !opts.quiet) show({ message: res.message, ok: res.ok, undo: res.ok ? opts.undo : undefined });
      return res;
    });
  }, [show]);

  /* La durée visée se règle ici aussi : c'est là qu'on la compare. */
  const targetTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const targetSaved = useRef(targetInit);
  const changeTarget = (v: number) => {
    setTarget(v);
    clearTimeout(targetTimer.current);
    targetTimer.current = setTimeout(async () => {
      if (v === targetSaved.current) return;
      const res = await safeCall(() => saveSettings({ targetMinutes: v }));
      show({ ok: res.ok, message: res.message });
      if (res.ok) targetSaved.current = v; else setTarget(targetSaved.current);
    }, 700);
  };
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
  const over = total > target + 0.01;
  // Une petite marge est normale : rouge seulement quand ça déborde vraiment.
  const severe = total - target > Math.max(2, target * 0.1);
  const cut = Math.round((1 - target / total) * 100);
  const fit = Math.min(40, Math.ceil(total));

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
    send(() => deleteTheme(r.id), { undo: () => send(() => restoreTheme(r, index)) });
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
        onSave={input => send(() => saveTheme({ ...input, id: r.id }), { quiet: true }).then(res => { if (res.ok) setOpen(null); return res; })}
        onDelete={r.id === PINNED ? undefined : () => remove(r)}
      />
    ),
  });

  return (
    <>
      <div className="group pad run-card">
        <div className="run-head">
          <span className="run-total num">{fmtMin(total)} <small>min de thèmes · {active.length} actif{active.length > 1 ? 's' : ''}</small></span>
        </div>
        <div className={`meter${severe ? ' over' : over ? ' mild' : ''}`} aria-hidden>
          <i style={{ width: `${Math.min(100, (Math.min(total, target) / Math.max(total, target)) * 100)}%` }} />
          {over && <b style={{ width: `${((total - target) / total) * 100}%` }} />}
        </div>
        <div className="run-target">
          <span id="lbl-target" className="small">Durée visée en semaine</span>
          <Stepper value={target} min={3} max={40} onChange={changeTarget} labelledBy="lbl-target" />
        </div>
        {severe
          ? <div className="run-note over" role="status">
              <Icon name="alert" size={18} />
              <span>
                <strong>{fmtMin(total - target)} min de trop.</strong> La rédaction raccourcira chaque thème d&apos;environ {cut} % (les heures en tiennent compte).
                {fit > target && <> <button type="button" className="linkish" onClick={() => changeTarget(fit)}>Viser {fit} min</button></>}
              </span>
            </div>
          : over
          ? <p className="run-note">
              +{fmtMin(total - target)} min au-delà de la cible : la rédaction resserrera.
              {fit > target && <> <button type="button" className="linkish" onClick={() => changeTarget(fit)}>Viser {fit} min</button></>}
            </p>
          : total < target - 0.5 && <p className="run-note">Il reste {fmtMin(target - total)} min : la rédaction développera.</p>}
      </div>

      <div className="group" style={{ marginTop: 16 }} onClickCapture={e => { if (justDragged.current) { e.preventDefault(); e.stopPropagation(); } }}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} modifiers={[restrictToVerticalAxis, restrictToParentElement]}>
          <SortableContext items={sortable.map(r => r.id)} strategy={verticalListSortingStrategy}>
            <div className="theme-cols" aria-hidden><span>Départ</span><span>Thème</span><span>Diffusé</span></div>
            <div>{sortable.map(r => <SortableRow key={r.id} {...rowProps(r)} locked={busy > 0} />)}</div>
          </SortableContext>
        </DndContext>
        {pinned && <Row {...rowProps(pinned)} pinned />}
      </div>
      <p className="field-hint">Maintiens un thème appuyé puis glisse-le pour changer l&apos;ordre.</p>

      <NewTheme busy={busy > 0} onCreate={input => send(() => saveTheme(input), { quiet: true })} />

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
        <button type="button" className="sr" aria-label={`Déplacer ${props.r.title} (Espace, puis flèches)`} {...attributes} onKeyDown={listeners?.onKeyDown as React.KeyboardEventHandler}>Déplacer</button>
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
  const sites = r.domains.length ? r.domains.slice(0, 2).join(', ') + (r.domains.length > 2 ? ` +${r.domains.length - 2}` : '') : 'sans site imposé';
  const meta = pinned ? `${fmtMin(minutes)} min · toujours en dernier` : `${fmtMin(minutes)} min · ${sites}`;
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
            <strong className="row-name">{r.title}</strong>
          </span>
          <span className="row-meta">
            {dirty && <span className="pill">Non enregistré</span>}{dirty ? ' ' : ''}
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

  // Brouillon gardé sur le téléphone : une interruption (onglet, appel, tunnel) ne fait rien perdre.
  const draftKey = `matinale_theme_${r?.id ?? 'nouveau'}`;
  const base = r ? formKey(r) : '';
  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem(draftKey) ?? 'null') as (Input & { base: string }) | null;
      if (!d || d.base !== base) return;
      setTitle(d.title); setMinutes(d.minutes); setBrief(d.brief); setDomains(d.domains);
    } catch { /* stockage indisponible */ }
  }, [draftKey, base]);
  useEffect(() => {
    try {
      if (dirty) localStorage.setItem(draftKey, JSON.stringify({ base, title, minutes, brief, domains }));
      else localStorage.removeItem(draftKey);
    } catch { /* ignoré */ }
  }, [draftKey, base, dirty, title, minutes, brief, domains]);

  // La consigne s'affiche en entier : pas de défilement à l'intérieur du champ (jusqu'à la moitié de l'écran).
  const briefRef = useRef<HTMLTextAreaElement>(null);
  const fit = useCallback(() => {
    const el = briefRef.current;
    if (!el || !el.offsetWidth) return; // éditeur replié : on mesurera à l'ouverture
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight + 2, Math.round(window.innerHeight * 0.5))}px`;
  }, []);
  useEffect(fit, [brief, fit]);
  useEffect(() => {
    const el = briefRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let w = el.offsetWidth;
    const ro = new ResizeObserver(() => { if (el.offsetWidth !== w) { w = el.offsetWidth; fit(); } });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);

  const [fieldErr, setFieldErr] = useState<{ title?: string; brief?: string }>({});
  const online = useOnline();
  const shownError = error && !(online && error === OFFLINE) ? error : null;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    // Vérifié ici, près du champ : pas d'aller-retour serveur pour une consigne trop courte.
    const fe = {
      title: title.trim().length < 2 ? 'Donne un nom au thème (2 caractères minimum).' : undefined,
      brief: brief.trim().length < 10 ? 'Dis en une phrase ce que tu veux entendre (10 caractères minimum).' : undefined,
    };
    setFieldErr(fe);
    if (fe.title || fe.brief) return;
    setSaving(true);
    const res = await onSave({ title, minutes, brief, domains });
    setSaving(false);
    if (!res.ok) setError(res.message);
    else try { localStorage.removeItem(draftKey); } catch { /* ignoré */ }
  };

  return (
    <form onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor={`${uid}t`}>Nom du thème</label>
        <input id={`${uid}t`} type="text" value={title} onChange={e => { setTitle(e.target.value); setFieldErr(f => ({ ...f, title: undefined })); }}
          maxLength={60} placeholder="Ex. : Formule 1" autoComplete="off" aria-invalid={Boolean(fieldErr.title)} aria-describedby={fieldErr.title ? `${uid}te` : undefined} />
        {fieldErr.title && <p className="field-error" id={`${uid}te`} style={{ marginTop: 6 }}>{fieldErr.title}</p>}
      </div>

      <div className="field">
        <span className="label" id={`${uid}m`}>Durée</span>
        <Stepper value={minutes} min={0.5} max={10} step={0.5} onChange={setMinutes} labelledBy={`${uid}m`} />
      </div>

      <div className="field">
        <label htmlFor={`${uid}b`}>Consigne pour la rédaction</label>
        <textarea
          ref={briefRef} id={`${uid}b`} value={brief} onChange={e => { setBrief(e.target.value); setFieldErr(f => ({ ...f, brief: undefined })); }} maxLength={1200}
          aria-invalid={Boolean(fieldErr.brief)}
          placeholder="Ce qui t'intéresse, ce qu'il faut éviter, ce qui passe en premier…"
        />
        <div className="field-row">
          {fieldErr.brief
            ? <span className="field-error" role="alert">{fieldErr.brief}</span>
            : <span className="field-hint">Lue chaque nuit par la rédaction.</span>}
          <span className="field-hint num">{brief.length} / 1200</span>
        </div>
      </div>

      <DomainInput value={domains} onChange={setDomains} example={EXAMPLES[r?.id ?? ''] ?? 'formula1.com'} />

      {shownError && <p className="editor-err" role="alert">{shownError}</p>}
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

const FOLDED_DOMAINS = 6;

function DomainInput({ value, onChange, example }: { value: string[]; onChange: (v: string[]) => void; example: string }) {
  const uid = useId();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Une longue liste de sites se replie : « Enregistrer » reste à portée de pouce.
  const [all, setAll] = useState(false);
  const hidden = all ? 0 : Math.max(0, value.length - FOLDED_DOMAINS);

  const add = (raw: string) => {
    // Une saisie sans point n'est pas une adresse : on la signale telle quelle.
    if (raw.trim() && !raw.includes('.')) {
      setError(`« ${raw.trim()} » n’est pas une adresse de site. Exemple : ${example}`);
      return;
    }
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
        {(hidden ? value.slice(0, FOLDED_DOMAINS) : value).map(d => (
          <span className="domain" key={d}>
            <span>{d}</span>
            <button type="button" onClick={() => onChange(value.filter(x => x !== d))} aria-label={`Retirer ${d}`}><Icon name="x" size={14} /></button>
          </span>
        ))}
        {hidden > 0 && (
          <button type="button" className="domain more" onClick={() => setAll(true)} aria-label={`Afficher les ${hidden} autres sites`}>
            +{hidden} site{hidden > 1 ? 's' : ''}
          </button>
        )}
        {value.length < MAX_DOMAINS && (
          <input
            id={`${uid}d`} type="text" value={text} placeholder={value.length ? 'Ajouter un site' : `Ex. : ${example}`}
            inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" enterKeyHint="done"
            aria-describedby={`${uid}h`} aria-invalid={Boolean(error)}
            onChange={e => { setText(e.target.value); if (error) setError(null); }}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ',' || (e.key === ' ' && text.includes('.'))) { e.preventDefault(); add(text); }
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
        <span className="field-hint num nowrap">{value.length} / {MAX_DOMAINS}</span>
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
