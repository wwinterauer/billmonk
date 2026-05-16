import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ChevronUp, ChevronDown } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { CSSProperties } from 'react';

interface EditableTableHeadProps {
  id: string;
  label: string;
  width: number;
  sortable: boolean;
  isSorted: 'asc' | 'desc' | false;
  align?: 'left' | 'right';
  onSort?: () => void;
  onResize: (newWidth: number) => void;
}

export function EditableTableHead({
  id,
  label,
  width,
  sortable,
  isSorted,
  align = 'left',
  onSort,
  onResize,
}: EditableTableHeadProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style: CSSProperties = {
    width,
    minWidth: width,
    maxWidth: width,
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
  };

  const handleResizeDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = width;
    const onMove = (ev: PointerEvent) => {
      const delta = ev.clientX - startX;
      const next = Math.min(800, Math.max(60, startWidth + delta));
      onResize(next);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <TableHead
      ref={setNodeRef}
      style={style}
      className={cn(
        'group select-none',
        align === 'right' && 'text-right',
      )}
    >
      <div
        className={cn(
          'flex items-center gap-1',
          align === 'right' && 'justify-end',
        )}
      >
        <button
          type="button"
          className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
          aria-label="Spalte verschieben"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <span
          className={cn(
            'flex-1 truncate',
            sortable && 'cursor-pointer hover:text-foreground',
            align === 'right' && 'text-right',
          )}
          onClick={sortable ? onSort : undefined}
        >
          {label}
          {isSorted === 'asc' && <ChevronUp className="h-4 w-4 inline ml-1" />}
          {isSorted === 'desc' && <ChevronDown className="h-4 w-4 inline ml-1" />}
        </span>
      </div>
      <div
        onPointerDown={handleResizeDown}
        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40"
      />
    </TableHead>
  );
}
