import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Scissors, FileText, ChevronRight } from 'lucide-react';
import { SplitSuggestionDialog } from './SplitSuggestionDialog';

interface Receipt {
  id: string;
  file_name: string;
  file_url: string;
  page_count: number | null;
  split_suggestion: any;
}

interface NeedsSplittingBannerProps {
  receipt: Receipt;
  onSplitComplete?: () => void;
}

export function NeedsSplittingBanner({ receipt, onSplitComplete }: NeedsSplittingBannerProps) {
  const [showDialog, setShowDialog] = useState(false);

  const handleClose = () => {
    setShowDialog(false);
    onSplitComplete?.();
  };

  return (
    <>
      <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50 overflow-hidden">
        <div className="flex items-center p-4 gap-4">
          {/* Icon */}
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
            <Scissors className="h-6 w-6 text-purple-600" />
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-purple-900">
                Mehrere Rechnungen erkannt
              </span>
              <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-300">
                {receipt.split_suggestion?.invoice_count || '?'} Rechnungen
              </Badge>
            </div>
            
            <p className="text-sm text-muted-foreground truncate">
              {receipt.file_name}
            </p>

            {/* Vorschau der erkannten Rechnungen */}
            {receipt.split_suggestion?.invoices?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {receipt.split_suggestion.invoices.slice(0, 4).map((inv: any, i: number) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    <FileText className="h-3 w-3 mr-1" />
                    {inv.vendor_name || `Teil ${i + 1}`}
                    {inv.total_amount && ` • €${inv.total_amount}`}
                  </Badge>
                ))}
                {receipt.split_suggestion.invoices.length > 4 && (
                  <Badge variant="secondary" className="text-xs">
                    +{receipt.split_suggestion.invoices.length - 4} weitere
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Action Button */}
          <Button
            onClick={() => setShowDialog(true)}
            className="bg-purple-600 hover:bg-purple-700 flex-shrink-0"
          >
            <Scissors className="h-4 w-4 mr-2" />
            Aufteilen
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </Card>

      {showDialog && (
        <SplitSuggestionDialog
          open={showDialog}
          onClose={handleClose}
          receipt={{
            ...receipt,
            page_count: receipt.page_count || 1,
          }}
        />
      )}
    </>
  );
}
