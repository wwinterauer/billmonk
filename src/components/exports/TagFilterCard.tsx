import { Check, X, Tag as TagIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useTags } from '@/hooks/useTags';
import { EMPTY_TAG_FILTER, type TagFilter } from '@/lib/exportFilters';
import { cn } from '@/lib/utils';

interface TagFilterCardProps {
  value?: TagFilter | null;
  onChange: (value: TagFilter) => void;
}

export function TagFilterCard({ value, onChange }: TagFilterCardProps) {
  const { activeTags } = useTags();
  const filter: TagFilter = { ...EMPTY_TAG_FILTER, ...(value || {}) };

  const toggle = (key: 'include' | 'exclude', tagId: string) => {
    const current = filter[key] || [];
    const other = key === 'include' ? 'exclude' : 'include';
    const next = current.includes(tagId)
      ? current.filter(id => id !== tagId)
      : [...current, tagId];
    onChange({
      ...filter,
      [key]: next,
      // A tag can't be included and excluded at the same time
      [other]: (filter[other] || []).filter(id => id !== tagId),
    } as TagFilter);
  };

  const renderPicker = (key: 'include' | 'exclude', placeholder: string) => {
    const selected = filter[key] || [];
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="w-full justify-start font-normal">
            <TagIcon className="h-3.5 w-3.5 mr-2" />
            {selected.length > 0 ? `${selected.length} Tag(s) gewählt` : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            <CommandInput placeholder="Tag suchen…" />
            <CommandList>
              <CommandEmpty>Keine Tags gefunden.</CommandEmpty>
              <CommandGroup>
                {activeTags.map(tag => (
                  <CommandItem key={tag.id} value={tag.name} onSelect={() => toggle(key, tag.id)}>
                    <Check className={cn('mr-2 h-4 w-4', selected.includes(tag.id) ? 'opacity-100' : 'opacity-0')} />
                    <span
                      className="h-2.5 w-2.5 rounded-full mr-2 shrink-0"
                      style={{ backgroundColor: tag.color || undefined }}
                    />
                    {tag.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  };

  const renderChips = (key: 'include' | 'exclude') => {
    const selected = filter[key] || [];
    if (selected.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1.5">
        {selected.map(id => {
          const tag = activeTags.find(t => t.id === id);
          return (
            <Badge key={id} variant="secondary" className="gap-1">
              {tag?.name || 'Unbekannt'}
              <button type="button" onClick={() => toggle(key, id)} aria-label="Tag entfernen">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          );
        })}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Tag-Filter</CardTitle>
        <CardDescription>Belege nach Tags ein- oder ausschließen</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Nur Belege mit diesen Tags</Label>
          {renderPicker('include', 'Alle Belege')}
          {renderChips('include')}
        </div>

        {(filter.include?.length || 0) > 1 && (
          <div className="flex items-center justify-between">
            <div>
              <Label>Alle gewählten Tags erforderlich</Label>
              <p className="text-xs text-muted-foreground">
                {filter.includeMode === 'all' ? 'UND-Verknüpfung' : 'ODER-Verknüpfung'}
              </p>
            </div>
            <Switch
              checked={filter.includeMode === 'all'}
              onCheckedChange={(checked) => onChange({ ...filter, includeMode: checked ? 'all' : 'any' })}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label>Belege mit diesen Tags ausschließen</Label>
          {renderPicker('exclude', 'Nichts ausschließen')}
          {renderChips('exclude')}
        </div>

        {((filter.include?.length || 0) > 0 || (filter.exclude?.length || 0) > 0) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange({ ...EMPTY_TAG_FILTER })}
          >
            Filter zurücksetzen
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
