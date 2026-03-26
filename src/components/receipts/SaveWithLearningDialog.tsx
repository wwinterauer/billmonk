import { ArrowRight, Brain } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { LEARNABLE_FIELDS } from '@/types/learning';

interface FieldChange {
  original: unknown;
  current: unknown;
}

interface SaveWithLearningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fieldChanges: Record<string, FieldChange>;
  vendorName: string;
  rememberCorrections: boolean;
  onRememberChange: (remember: boolean) => void;
  onConfirm: () => void;
}

// Helper to format display value
function formatDisplayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '(leer)';
  }
  if (typeof value === 'number') {
    return value.toLocaleString('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return String(value);
}

export function SaveWithLearningDialog({
  open,
  onOpenChange,
  fieldChanges,
  vendorName,
  rememberCorrections,
  onRememberChange,
  onConfirm,
}: SaveWithLearningDialogProps) {
  const changeCount = Object.keys(fieldChanges).length;
  
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="w-full max-w-2xl sm:max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            Änderungen speichern
          </AlertDialogTitle>
          <AlertDialogDescription>
            Du hast {changeCount} Feld{changeCount !== 1 ? 'er' : ''} korrigiert.
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="py-4 space-y-4">
          {/* Show changes */}
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {Object.entries(fieldChanges).map(([fieldName, change]) => {
              const field = LEARNABLE_FIELDS.find(f => f.id === fieldName);
              if (!field) return null;
              
              return (
                <div 
                  key={fieldName} 
                  className="flex flex-col gap-1 text-sm p-2 bg-muted/50 rounded-lg"
                >
                  <span className="font-medium text-foreground">
                    {field.label}:
                  </span>
                  <div className="flex items-start gap-2 flex-wrap">
                    <span className="text-muted-foreground line-through break-all">
                      {formatDisplayValue(change.original)}
                    </span>
                    <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    <span className="text-green-600 font-medium break-all">
                      {formatDisplayValue(change.current)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Learning option */}
          <div className="flex items-start gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <Checkbox
              id="remember-corrections"
              checked={rememberCorrections}
              onCheckedChange={(checked) => onRememberChange(checked === true)}
              className="mt-0.5"
            />
            <div className="flex-1">
              <Label 
                htmlFor="remember-corrections" 
                className="font-medium text-primary cursor-pointer"
              >
                Für "{vendorName}" merken
              </Label>
              <p className="text-sm text-primary/80 mt-0.5">
                Die KI lernt aus dieser Korrektur und erkennt zukünftige Belege 
                dieses Lieferanten besser.
              </p>
            </div>
          </div>
        </div>
        
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            className="bg-primary hover:bg-primary/90"
          >
            {rememberCorrections ? (
              <>
                <Brain className="w-4 h-4 mr-1.5" />
                Speichern & Lernen
              </>
            ) : (
              'Speichern'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export type { FieldChange };
