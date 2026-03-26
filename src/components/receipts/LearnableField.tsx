import { ReactNode } from 'react';
import { Brain, Pencil, RotateCcw } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { VendorLearning, FieldPattern } from '@/types/learning';

interface LearnableFieldProps {
  fieldName: string;
  label: ReactNode;
  value: unknown;
  originalValue: unknown;
  vendorLearning?: VendorLearning | null;
  onReset?: () => void;
  className?: string;
  labelExtra?: ReactNode;
  children: ReactNode;
  /** For vat_rate field: indicate if value comes from learning */
  vatRateSource?: 'ai' | 'learned' | 'manual' | null;
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

export function LearnableField({
  fieldName,
  label,
  value,
  originalValue,
  vendorLearning,
  onReset,
  className,
  labelExtra,
  children,
  vatRateSource,
}: LearnableFieldProps) {
  // Normalize values for comparison
  const normalizedValue = value === undefined ? null : value;
  const normalizedOriginal = originalValue === undefined ? null : originalValue;
  
  const hasChanged = String(normalizedValue || '') !== String(normalizedOriginal || '') && normalizedOriginal !== null;
  
  // Get field pattern from vendor learning
  const fieldPatterns = vendorLearning?.field_patterns as Record<string, FieldPattern> | undefined;
  const fieldPattern = fieldPatterns?.[fieldName];
  const hasLearning = fieldPattern && (fieldPattern.confidence || 0) > 70;
  
  // Special handling for vat_rate field: show learned indicator from VAT learning
  const isVatRateField = fieldName === 'vat_rate';
  const hasVatRateLearning = isVatRateField && vendorLearning && 
    vendorLearning.default_vat_rate !== null && 
    vendorLearning.default_vat_rate !== undefined &&
    ((vendorLearning.vat_rate_confidence ?? 0) >= 70 || (vendorLearning.vat_rate_corrections ?? 0) >= 3);
  const isVatFromLearning = vatRateSource === 'learned' || hasVatRateLearning;

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-1.5">
        <Label className="flex items-center gap-2">
          {label}
          {labelExtra}
        </Label>
        
        <div className="flex items-center gap-1.5">
          {/* VAT rate learned indicator (special, green) */}
          {isVatFromLearning && isVatRateField && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-green-50 text-green-700 border-green-200">
                  <Brain className="w-3 h-3 mr-1" />
                  Gelernt
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="font-medium">MwSt-Satz wurde für diesen Lieferanten gelernt</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Konfidenz: {vendorLearning?.vat_rate_confidence ?? 0}% • 
                  {vendorLearning?.vat_rate_corrections ?? 0} Korrekturen
                </p>
                <p className="text-xs text-muted-foreground">
                  Standard: {vendorLearning?.default_vat_rate}%
                </p>
              </TooltipContent>
            </Tooltip>
          )}
          
          {/* Learning indicator (for other fields) */}
          {hasLearning && !isVatRateField && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-primary/5 text-primary border-primary/20">
                  <Brain className="w-3 h-3 mr-1" />
                  Gelernt
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="font-medium">Dieses Feld wurde für diesen Lieferanten trainiert</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Konfidenz: {Math.round(fieldPattern?.confidence || 0)}%
                </p>
                {fieldPattern?.common_mistakes && fieldPattern.common_mistakes.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {fieldPattern.common_mistakes.length} Korrekturen gelernt
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
          )}
          
          {/* Change indicator */}
          {hasChanged && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-orange-50 text-orange-700 border-orange-200">
              <Pencil className="w-3 h-3 mr-1" />
              Geändert
            </Badge>
          )}
        </div>
      </div>
      
      {children}
      
      {/* Original value hint with reset option */}
      {hasChanged && (
        <div className="flex items-center justify-between mt-1.5 text-xs">
          <span className="text-muted-foreground">
            KI erkannt: <span className="line-through text-muted-foreground/70">{formatDisplayValue(normalizedOriginal)}</span>
          </span>
          {onReset && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-xs text-primary hover:text-primary"
              onClick={onReset}
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Zurücksetzen
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
