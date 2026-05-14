import * as React from "react";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  allowClear?: boolean;
  clearLabel?: string;
  onCreate?: (label: string) => Promise<void> | void;
  createLabel?: (query: string) => string;
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Auswählen...",
  searchPlaceholder = "Suchen...",
  emptyText = "Keine Ergebnisse.",
  disabled = false,
  className,
  allowClear = false,
  clearLabel = "— Keine Auswahl —",
  onCreate,
  createLabel = (q) => `„${q}" als neue Option anlegen`,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  const selectedLabel = React.useMemo(
    () => options.find((o) => o.value === value)?.label || value,
    [options, value]
  );

  const trimmed = search.trim();
  const hasExactMatch = options.some(
    (o) => o.label.toLowerCase() === trimmed.toLowerCase()
  );
  const showCreate = !!onCreate && trimmed.length > 0 && !hasExactMatch;

  const handleCreate = async () => {
    if (!onCreate || !trimmed) return;
    try {
      setCreating(true);
      await onCreate(trimmed);
      setOpen(false);
      setSearch("");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(""); }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">{value ? selectedLabel : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={true}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {showCreate ? (
                <button
                  type="button"
                  className="w-full px-2 py-1.5 text-left text-sm hover:bg-accent rounded-sm flex items-center gap-2 text-primary"
                  onClick={handleCreate}
                  disabled={creating}
                >
                  <Plus className="h-4 w-4" />
                  {createLabel(trimmed)}
                </button>
              ) : (
                emptyText
              )}
            </CommandEmpty>

            {allowClear && value && (
              <CommandGroup>
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  className="text-muted-foreground"
                >
                  <X className="mr-2 h-4 w-4" />
                  <span>{clearLabel}</span>
                </CommandItem>
              </CommandGroup>
            )}

            {options.length > 0 && (
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => {
                      onChange(option.value === value ? "" : option.value);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="truncate">{option.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {showCreate && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    value={`__create__${trimmed}`}
                    onSelect={handleCreate}
                    disabled={creating}
                    className="text-primary"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    <span className="truncate">{createLabel(trimmed)}</span>
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
