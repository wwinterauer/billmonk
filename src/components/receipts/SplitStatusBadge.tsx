import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Scissors, FileText, Layers } from 'lucide-react';

interface SplitStatusBadgeProps {
  status: string;
  splitFromReceiptId?: string | null;
  originalPages?: number[] | null;
  onShowParts?: () => void;
  variant?: 'badge' | 'inline';
}

export function SplitStatusBadge({ 
  status, 
  splitFromReceiptId, 
  originalPages,
  onShowParts,
  variant = 'badge'
}: SplitStatusBadgeProps) {
  // Aufgeteiltes Original-PDF
  if (status === 'split') {
    if (variant === 'inline') {
      return (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
            <Scissors className="h-3 w-3 mr-1" />
            Aufgeteilt
          </Badge>
          {onShowParts && (
            <Button
              variant="link"
              size="sm"
              onClick={onShowParts}
              className="text-purple-600 h-auto p-0 text-xs"
            >
              Teile anzeigen →
            </Button>
          )}
        </div>
      );
    }

    return (
      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
        <Scissors className="h-3 w-3 mr-1" />
        Aufgeteilt
      </Badge>
    );
  }

  // Teil-Receipt (aus Splitting entstanden)
  if (splitFromReceiptId) {
    return (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
        <Layers className="h-3 w-3 mr-1" />
        Teil
        {originalPages && originalPages.length > 0 && (
          <span className="ml-1 opacity-75">
            (S. {originalPages.join(', ')})
          </span>
        )}
      </Badge>
    );
  }

  // Needs splitting
  if (status === 'needs_splitting') {
    return (
      <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
        <FileText className="h-3 w-3 mr-1" />
        Mehrere Rechnungen
      </Badge>
    );
  }

  return null;
}
