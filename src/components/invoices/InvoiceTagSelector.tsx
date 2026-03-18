import { useState, useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { useTags } from '@/hooks/useTags';
import { useInvoiceTags } from '@/hooks/useInvoiceTags';
import { cn } from '@/lib/utils';

interface InvoiceTagSelectorProps {
  invoiceId?: string;
  onChange?: () => void;
  size?: 'sm' | 'md';
  disabled?: boolean;
}

interface TagState {
  id: string;
  name: string;
  color: string;
  isAssigned: boolean;
}

export function InvoiceTagSelector({
  invoiceId,
  onChange,
  size = 'md',
  disabled = false,
}: InvoiceTagSelectorProps) {
  const { activeTags, loading } = useTags();
  const { fetchTagsForInvoice, assignTag, removeTag } = useInvoiceTags();
  const [tagStates, setTagStates] = useState<TagState[]>([]);
  const [loadingTags, setLoadingTags] = useState(true);
  const [busy, setBusy] = useState(false);
  const loadedRef = useRef('');

  useEffect(() => {
    const key = `${activeTags.map(t => t.id).join(',')}|${invoiceId || ''}`;
    if (loadedRef.current === key || !invoiceId) return;

    const load = async () => {
      setLoadingTags(true);
      try {
        const assigned = await fetchTagsForInvoice(invoiceId);
        const assignedIds = new Set(assigned.map(t => t.id));
        setTagStates(activeTags.map(t => ({ ...t, isAssigned: assignedIds.has(t.id) })));
        loadedRef.current = key;
      } catch {
      } finally {
        setLoadingTags(false);
      }
    };
    load();
  }, [activeTags, invoiceId, fetchTagsForInvoice]);

  const handleClick = async (tag: TagState) => {
    if (disabled || busy || !invoiceId) return;
    setBusy(true);

    // Optimistic
    setTagStates(prev => prev.map(t => t.id === tag.id ? { ...t, isAssigned: !t.isAssigned } : t));

    try {
      if (tag.isAssigned) {
        await removeTag(invoiceId, tag.id);
      } else {
        await assignTag(invoiceId, tag.id);
      }
      onChange?.();
    } catch {
      setTagStates(prev => prev.map(t => t.id === tag.id ? { ...t, isAssigned: tag.isAssigned } : t));
    } finally {
      setBusy(false);
    }
  };

  if (loading || loadingTags) {
    return (
      <div className="flex flex-wrap gap-1">
        {[1, 2, 3].map(i => (
          <div key={i} className={cn('rounded-full bg-muted animate-pulse', size === 'sm' ? 'h-5 w-16' : 'h-7 w-20')} />
        ))}
      </div>
    );
  }

  if (activeTags.length === 0 || !invoiceId) return null;

  return (
    <div className={cn('flex flex-wrap items-center', size === 'sm' ? 'gap-1' : 'gap-1.5')}>
      {tagStates.map(tag => (
        <button
          key={tag.id}
          type="button"
          onClick={() => handleClick(tag)}
          disabled={disabled || busy}
          className={cn(
            'inline-flex items-center rounded-full font-medium transition-all duration-150 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50',
            size === 'sm' ? 'text-xs px-2 py-0.5 gap-1' : 'text-sm px-2.5 py-1 gap-1.5',
            disabled && 'opacity-50 cursor-not-allowed',
            !tag.isAssigned && 'border bg-transparent hover:bg-opacity-10',
          )}
          style={{
            backgroundColor: tag.isAssigned ? tag.color : 'transparent',
            borderColor: !tag.isAssigned ? tag.color : 'transparent',
            color: tag.isAssigned ? 'white' : tag.color,
          }}
        >
          {tag.isAssigned && <Check className={cn(size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5', 'flex-shrink-0')} />}
          <span className="truncate max-w-[120px]">{tag.name}</span>
        </button>
      ))}
    </div>
  );
}
