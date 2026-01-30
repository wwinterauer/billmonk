import { useState, useEffect, useMemo, useRef } from 'react';
import { Check, Minus, MoreHorizontal, Settings } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useTags } from '@/hooks/useTags';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import type { Tag, TagWithAssignment } from '@/types/tags';

interface TagSelectorProps {
  receiptId?: string;              // Einzelner Beleg
  receiptIds?: string[];           // Mehrere Belege (Bulk-Modus)
  onChange?: () => void;           // Callback nach Änderung
  maxVisibleTags?: number;         // Default: 6
  size?: 'sm' | 'md';              // Default: 'md'
  disabled?: boolean;
}

interface TagState extends Tag {
  isAssigned: boolean;
  assignmentCount?: number;
  totalCount?: number;
}

export function TagSelector({
  receiptId,
  receiptIds,
  onChange,
  maxVisibleTags = 6,
  size = 'md',
  disabled = false,
}: TagSelectorProps) {
  const {
    activeTags,
    loading,
    assignTag,
    removeTag,
    bulkAssignTag,
    bulkRemoveTag,
    isAssigning,
    isRemoving,
  } = useTags();

  const [tagStates, setTagStates] = useState<TagState[]>([]);
  const [loadingTags, setLoadingTags] = useState(true);
  const [popoverOpen, setPopoverOpen] = useState(false);
  
  // Track if we've done initial load to prevent unnecessary re-fetches
  const loadedRef = useRef<string>('');

  const isBulkMode = !!receiptIds && receiptIds.length > 0;
  const targetReceiptIds = isBulkMode ? receiptIds : receiptId ? [receiptId] : [];

  // Stable string key for effect dependency
  const receiptIdsKey = [...targetReceiptIds].sort().join(',');
  
  // Stable key for activeTags to prevent infinite loops
  const activeTagsKey = activeTags.map(t => t.id).join(',');
  
  // Combined key for caching
  const cacheKey = `${activeTagsKey}|${receiptId || ''}|${receiptIdsKey}`;

  // Load tag assignment states
  useEffect(() => {
    // Avoid re-fetching if nothing changed
    if (loadedRef.current === cacheKey) {
      return;
    }
    
    const loadTagStates = async () => {
      if (activeTags.length === 0 || targetReceiptIds.length === 0) {
        setTagStates([]);
        setLoadingTags(false);
        loadedRef.current = cacheKey;
        return;
      }

      setLoadingTags(true);

      try {
        if (isBulkMode && targetReceiptIds.length > 0) {
          // Bulk mode: Get tags with assignment counts directly from supabase
          const { data, error } = await supabase
            .from('receipt_tags')
            .select('receipt_id, tag_id')
            .in('receipt_id', targetReceiptIds);
          
          if (error) throw error;
          
          // Count how many receipts have each tag
          const tagCounts = new Map<string, number>();
          (data || []).forEach(item => {
            const count = tagCounts.get(item.tag_id) || 0;
            tagCounts.set(item.tag_id, count + 1);
          });

          const states: TagState[] = activeTags.map(tag => ({
            ...tag,
            isAssigned: tagCounts.get(tag.id) === targetReceiptIds.length,
            assignmentCount: tagCounts.get(tag.id) || 0,
            totalCount: targetReceiptIds.length,
          }));
          setTagStates(states);
        } else if (receiptId) {
          // Single mode: Get assigned tags directly from supabase
          const { data, error } = await supabase
            .from('receipt_tags')
            .select('tag_id')
            .eq('receipt_id', receiptId);
          
          if (error) throw error;
          
          const assignedIds = new Set((data || []).map(item => item.tag_id));
          const states: TagState[] = activeTags.map(tag => ({
            ...tag,
            isAssigned: assignedIds.has(tag.id),
          }));
          setTagStates(states);
        }
        
        loadedRef.current = cacheKey;
      } catch (error) {
        console.error('Error loading tag states:', error);
      } finally {
        setLoadingTags(false);
      }
    };

    loadTagStates();
  }, [cacheKey, activeTags, isBulkMode, receiptId, targetReceiptIds]);

  // Handle tag click
  const handleTagClick = async (tag: TagState) => {
    if (disabled || isAssigning || isRemoving) return;

    // Optimistic update
    setTagStates(prev => prev.map(t => {
      if (t.id !== tag.id) return t;

      if (isBulkMode) {
        // In bulk mode: toggle between all assigned and none assigned
        const newIsAssigned = t.assignmentCount !== t.totalCount;
        return {
          ...t,
          isAssigned: newIsAssigned,
          assignmentCount: newIsAssigned ? t.totalCount : 0,
        };
      } else {
        // Single mode: simple toggle
        return { ...t, isAssigned: !t.isAssigned };
      }
    }));

    try {
      if (isBulkMode) {
        // Bulk mode actions
        if (tag.assignmentCount !== tag.totalCount) {
          // Not all have tag -> add to all
          await bulkAssignTag(targetReceiptIds, tag.id);
        } else {
          // All have tag -> remove from all
          await bulkRemoveTag(targetReceiptIds, tag.id);
        }
      } else if (receiptId) {
        // Single mode actions
        if (tag.isAssigned) {
          await removeTag(receiptId, tag.id);
        } else {
          await assignTag(receiptId, tag.id);
        }
      }

      onChange?.();
    } catch (error) {
      // Revert optimistic update on error
      setTagStates(prev => prev.map(t => {
        if (t.id !== tag.id) return t;
        return { ...t, isAssigned: tag.isAssigned, assignmentCount: tag.assignmentCount };
      }));
    }
  };

  // Split tags for overflow display
  const { visibleTags, overflowTags } = useMemo(() => {
    if (tagStates.length <= maxVisibleTags) {
      return { visibleTags: tagStates, overflowTags: [] };
    }
    return {
      visibleTags: tagStates.slice(0, maxVisibleTags - 1),
      overflowTags: tagStates.slice(maxVisibleTags - 1),
    };
  }, [tagStates, maxVisibleTags]);

  // Size classes
  const sizeClasses = {
    sm: {
      badge: 'text-xs px-2 py-0.5 gap-1',
      icon: 'h-3 w-3',
      container: 'gap-1',
    },
    md: {
      badge: 'text-sm px-2.5 py-1 gap-1.5',
      icon: 'h-3.5 w-3.5',
      container: 'gap-1.5',
    },
  };

  const classes = sizeClasses[size];

  // Render a tag chip
  const renderTagChip = (tag: TagState) => {
    const isPartial = isBulkMode && tag.assignmentCount! > 0 && tag.assignmentCount !== tag.totalCount;
    const isFullyAssigned = isBulkMode ? tag.assignmentCount === tag.totalCount : tag.isAssigned;

    return (
      <button
        key={tag.id}
        type="button"
        onClick={() => handleTagClick(tag)}
        disabled={disabled || isAssigning || isRemoving}
        className={cn(
          'inline-flex items-center rounded-full font-medium transition-all duration-150',
          'cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50',
          classes.badge,
          disabled && 'opacity-50 cursor-not-allowed',
          // Assigned state
          isFullyAssigned && 'text-white',
          // Partial state (bulk mode)
          isPartial && 'text-white',
          // Not assigned state
          !isFullyAssigned && !isPartial && 'border bg-transparent hover:bg-opacity-10',
        )}
        style={{
          backgroundColor: isFullyAssigned
            ? tag.color
            : isPartial
              ? `${tag.color}99` // 60% opacity
              : 'transparent',
          borderColor: !isFullyAssigned && !isPartial ? tag.color : 'transparent',
          color: !isFullyAssigned && !isPartial ? tag.color : 'white',
        }}
        title={
          isBulkMode
            ? `${tag.assignmentCount} von ${tag.totalCount} Belegen`
            : tag.isAssigned
              ? 'Klicken zum Entfernen'
              : 'Klicken zum Hinzufügen'
        }
      >
        {/* Icon */}
        {isFullyAssigned && (
          <Check className={cn(classes.icon, 'flex-shrink-0')} />
        )}
        {isPartial && (
          <Minus className={cn(classes.icon, 'flex-shrink-0')} />
        )}

        {/* Name */}
        <span className="truncate max-w-[120px]">{tag.name}</span>
      </button>
    );
  };

  // Loading state
  if (loading || loadingTags) {
    return (
      <div className={cn('flex flex-wrap', classes.container)}>
        {[1, 2, 3].map(i => (
          <div
            key={i}
            className={cn(
              'rounded-full bg-muted animate-pulse',
              size === 'sm' ? 'h-5 w-16' : 'h-7 w-20'
            )}
          />
        ))}
      </div>
    );
  }

  // No active tags
  if (activeTags.length === 0) {
    return (
      <div className="text-sm text-muted-foreground flex items-center gap-2">
        <span>Keine Tags verfügbar</span>
        <Link
          to="/settings?tab=tags"
          className="text-primary hover:underline inline-flex items-center gap-1"
        >
          <Settings className="h-3.5 w-3.5" />
          Erstellen
        </Link>
      </div>
    );
  }

  // No receipt selected
  if (targetReceiptIds.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex flex-wrap items-center', classes.container)}>
      {/* Visible tags */}
      {visibleTags.map(tag => renderTagChip(tag))}

      {/* Overflow popover */}
      {overflowTags.length > 0 && (
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'rounded-full',
                size === 'sm' ? 'h-5 px-2 text-xs' : 'h-7 px-2.5 text-sm'
              )}
            >
              <MoreHorizontal className={classes.icon} />
              <span className="ml-1">+{overflowTags.length}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto p-2"
            align="start"
          >
            <div className={cn('flex flex-wrap max-w-xs', classes.container)}>
              {overflowTags.map(tag => renderTagChip(tag))}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
