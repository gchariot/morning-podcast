'use client';
/** Liste des thèmes réordonnable au doigt : on attrape la poignée à gauche et on glisse. */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { reorderRubriques } from '@/app/(prive)/actions';

type Item = { id: string; title: string; node: React.ReactNode };

function Row({ item, saving }: { item: Item; saving: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <div
      ref={setNodeRef}
      className={`sortable${isDragging ? ' dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        type="button" ref={setActivatorNodeRef} className="handle" disabled={saving}
        aria-label={`Déplacer ${item.title}`} {...attributes} {...listeners}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
          <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
          <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
        </svg>
      </button>
      <div className="sortable-body">{item.node}</div>
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
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
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
          <div className="group" style={{ marginTop: 16 }}>
            {items.map(item => <Row key={item.id} item={item} saving={saving} />)}
          </div>
        </SortableContext>
      </DndContext>
      <p className="field-hint" role="status" aria-live="polite" style={{ minHeight: 20, color: status && !status.ok ? 'var(--bad)' : undefined }}>
        {saving ? 'Enregistrement de l’ordre…' : status ? status.message : 'Pour changer l’ordre, maintiens la poignée à gauche d’un thème et glisse.'}
      </p>
    </>
  );
}
