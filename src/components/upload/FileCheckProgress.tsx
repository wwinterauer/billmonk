import { Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface FileCheckProgressProps {
  current: number;
  total: number;
}

export function FileCheckProgress({ current, total }: FileCheckProgressProps) {
  const percentage = total > 0 ? (current / total) * 100 : 0;

  return (
    <Card className="p-6 mb-6">
      <div className="flex items-center gap-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary flex-shrink-0" />
        <div className="flex-1">
          <p className="font-medium text-foreground">Dateien werden geprüft...</p>
          <p className="text-sm text-muted-foreground">
            {current} von {total}
          </p>
          <Progress value={percentage} className="mt-2 h-2" />
        </div>
      </div>
    </Card>
  );
}
