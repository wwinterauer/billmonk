import { useState } from 'react';
import { Plus, HelpCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { VendorSuggestion, MatchedVendor } from '@/services/vendorMatchingService';

interface VendorSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detectedName: string;
  suggestions: VendorSuggestion[];
  onSelectExisting: (vendor: MatchedVendor) => void;
  onCreateNew: () => void;
  onSkip: () => void;
  isLoading?: boolean;
}

export function VendorSelectionDialog({
  open,
  onOpenChange,
  detectedName,
  suggestions,
  onSelectExisting,
  onCreateNew,
  onSkip,
  isLoading = false,
}: VendorSelectionDialogProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelect = (vendor: MatchedVendor) => {
    setSelectedId(vendor.id);
    onSelectExisting(vendor);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-primary" />
            Lieferant zuordnen
          </DialogTitle>
          <DialogDescription>
            Der erkannte Lieferant "{detectedName}" ist ähnlich zu bestehenden Einträgen.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-3">
          {/* Detected Name */}
          <div className="p-3 bg-primary/10 border border-primary/30 rounded-lg">
            <p className="text-sm">
              <span className="font-medium">KI erkannt:</span> {detectedName}
            </p>
          </div>

          {/* Suggestions */}
          <div className="space-y-2">
            <Label>Meintest du einen dieser Lieferanten?</Label>

            {suggestions.map((suggestion) => (
              <button
                key={suggestion.vendor.id}
                className={cn(
                  'w-full p-3 border rounded-lg text-left transition-colors',
                  'hover:bg-primary/5 hover:border-primary/30',
                  selectedId === suggestion.vendor.id && 'bg-primary/10 border-primary/50',
                  isLoading && 'opacity-50 pointer-events-none'
                )}
                onClick={() => handleSelect(suggestion.vendor)}
                disabled={isLoading}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{suggestion.vendor.display_name}</p>
                    {suggestion.vendor.legal_names?.length > 0 && (
                      <p className="text-sm text-muted-foreground">{suggestion.vendor.legal_names.join(', ')}</p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {suggestion.reasons.map((reason, j) => (
                        <Badge key={j} variant="outline" className="text-xs">
                          {reason}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Badge
                    className={cn(
                      'ml-2',
                      suggestion.score >= 80
                        ? 'bg-success/10 text-success border-success/30'
                        : suggestion.score >= 70
                        ? 'bg-warning/10 text-warning border-warning/30'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {suggestion.score}%
                  </Badge>
                </div>
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">oder</span>
            </div>
          </div>

          {/* Create New */}
          <Button
            variant="outline"
            className="w-full"
            onClick={onCreateNew}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            "{detectedName}" als neuen Lieferanten anlegen
          </Button>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={onSkip}
            disabled={isLoading}
          >
            Überspringen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
