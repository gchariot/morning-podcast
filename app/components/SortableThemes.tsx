'use client';
/** Liste des thèmes réordonnable au doigt : on attrape la poignée à gauche et on glisse. */
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { reorderRubriques } from '@/app/(prive)/actions';

type Item = { id: string; title: string; node: React.ReactNode };

// Zones où un appui ne doit jamais démarrer un déplacement (formulaire du thème ouvert).
const NO_DRAG = 'input, textarea, select, button:not(.handle), a, label, .pad';

function Row({ item, saving }: { item: Item; saving: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: saving });
  // Toute la ligne est attrapable, sauf les champs du formulaire.
  const rowListeners = Object.fromEntries(
    Object.entries(listeners ?? {}).map(([name, fn]) => [name, (e: React.SyntheticEvent) => {
      if ((e.target as Element).closest(NO_DRAG)) return;
      (fn as (ev: React.SyntheticEvent) => void)(e);
    }]),
  );
  return (
    <div
      ref={setNodeRef}
      className={`sortable${isDragging ? ' dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...rowListeners}
    >
      <span className="handle" aria-hidden>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
          <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
          <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
        </svg>
      </span>
      <div className="sortable-body">{item.node}</div>
      {/* Clavier : bouton dédié (Espace pour attraper, flèches pour déplacer). */}
      <button type="button" className="handle sr" aria-label={`Déplacer ${item.title}`} {...attributes} onKeyDown={listeners?.onKeyDown as React.KeyboardEventHandler} />
    </div>
  );
}

export function SortableThemes({ items: initial }: { items: Item[] }) {
  const [items, setItems] = useState(initial);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [saving, startSaving] = useTransition();
  const router = useRouter();
  // Les données serveur changent (ajout, suppression) : on se recale dessus.
  const key = initial.map(i => i.id).join();
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) { setLastKey(key); setItems(initial); }

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Au doigt : appui long pour attraper, sinon on fait défiler la page normalement.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const justDragged = useRef(false);
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    justDragged.current = true;
    setTimeout(() => { justDragged.current = false; }, 50);
    if (!over || active.id === over.id) return;
    const before = items;
    const next = arrayMove(items, items.findIndex(i => i.id === active.id), items.findIndex(i => i.id === over.id));
    setItems(next);
    setStatus(null);
    startSaving(async () => {
      const res = await reorderRubriques(next.map(i => i.id));
      setStatus(res);
      if (!res.ok) setItems(before);
      router.refresh();
    });
  };

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} modifiers={[restrictToVerticalAxis, restrictToParentElement]}>
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          <div className="group" style={{ marginTop: 16 }} onClickCapture={e => { if (justDragged.current) { e.preventDefault(); e.stopPropagation(); } }}>
            {items.map(item => <Row key={item.id} item={item} saving={saving} />)}
          </div>
        </SortableContext>
      </DndContext>
      <p className="field-hint" role="status" aria-live="polite" style={{ minHeight: 20, color: status && !status.ok ? 'var(--bad)' : undefined }}>
        {saving ? 'Enregistrement de l’ordre…' : status ? status.message : 'Pour changer l’ordre, maintiens un thème appuyé puis glisse-le.'}
      </p>
    </>
  );
}
