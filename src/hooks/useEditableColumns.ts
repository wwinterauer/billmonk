import { useState, useEffect, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';

export interface ColumnDef<K extends string> {
  key: K;
  label: string;
  defaultWidth: number;
  sortable?: boolean;
  align?: 'left' | 'right';
}

export function useEditableColumns<K extends string>(
  storageKey: string,
  defaults: ColumnDef<K>[],
) {
  const defaultOrder = useMemo(() => defaults.map(d => d.key), [defaults]);
  const defaultWidths = useMemo(
    () => Object.fromEntries(defaults.map(d => [d.key, d.defaultWidth])) as Record<K, number>,
    [defaults],
  );

  const [order, setOrder] = useState<K[]>(() => {
    try {
      const raw = localStorage.getItem(`${storageKey}-order`);
      if (raw) {
        const parsed = JSON.parse(raw) as K[];
        // keep only known keys, append any missing
        const known = parsed.filter(k => defaultOrder.includes(k));
        const missing = defaultOrder.filter(k => !known.includes(k));
        return [...known, ...missing];
      }
    } catch {}
    return defaultOrder;
  });

  const [widths, setWidths] = useState<Record<K, number>>(() => {
    try {
      const raw = localStorage.getItem(`${storageKey}-widths`);
      if (raw) {
        return { ...defaultWidths, ...(JSON.parse(raw) as Record<K, number>) };
      }
    } catch {}
    return defaultWidths;
  });

  useEffect(() => {
    localStorage.setItem(`${storageKey}-order`, JSON.stringify(order));
  }, [storageKey, order]);

  useEffect(() => {
    localStorage.setItem(`${storageKey}-widths`, JSON.stringify(widths));
  }, [storageKey, widths]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = order.indexOf(active.id as K);
    const newIdx = order.indexOf(over.id as K);
    if (oldIdx < 0 || newIdx < 0) return;
    setOrder(arrayMove(order, oldIdx, newIdx));
  };

  const setWidth = (key: K, w: number) => {
    setWidths(prev => ({ ...prev, [key]: w }));
  };

  const defByKey = useMemo(() => {
    const m = {} as Record<K, ColumnDef<K>>;
    defaults.forEach(d => { m[d.key] = d; });
    return m;
  }, [defaults]);

  return { order, widths, setWidth, sensors, handleDragEnd, defByKey, DndContext, closestCenter };
}
