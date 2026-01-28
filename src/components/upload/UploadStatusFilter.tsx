import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  Loader2, 
  Clock, 
  Copy, 
  XCircle, 
  Ban,
  FileText 
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type UploadFilterStatus = 'all' | 'success' | 'processing' | 'pending' | 'duplicate' | 'error' | 'skipped';

export interface UploadStatusCounts {
  all: number;
  success: number;
  processing: number;
  pending: number;
  duplicate: number;
  error: number;
  skipped: number;
}

interface UploadStatusFilterProps {
  counts: UploadStatusCounts;
  activeFilter: UploadFilterStatus;
  onFilterChange: (filter: UploadFilterStatus) => void;
}

interface StatusConfig {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  activeColor: string;
}

const statusConfig: Record<UploadFilterStatus, StatusConfig> = {
  all: { 
    label: 'Alle', 
    icon: FileText, 
    color: 'text-foreground',
    bgColor: 'bg-muted/50 hover:bg-muted border-transparent',
    activeColor: 'bg-primary text-primary-foreground hover:bg-primary/90',
  },
  success: { 
    label: 'Erfolgreich', 
    icon: CheckCircle, 
    color: 'text-green-700 dark:text-green-400',
    bgColor: 'bg-green-50 hover:bg-green-100 border-green-200 dark:bg-green-950/30 dark:hover:bg-green-950/50 dark:border-green-800',
    activeColor: 'bg-green-600 text-white hover:bg-green-700 dark:bg-green-600',
  },
  processing: { 
    label: 'Verarbeitung', 
    icon: Loader2, 
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-50 hover:bg-blue-100 border-blue-200 dark:bg-blue-950/30 dark:hover:bg-blue-950/50 dark:border-blue-800',
    activeColor: 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600',
  },
  pending: { 
    label: 'Wartend', 
    icon: Clock, 
    color: 'text-yellow-700 dark:text-yellow-400',
    bgColor: 'bg-yellow-50 hover:bg-yellow-100 border-yellow-200 dark:bg-yellow-950/30 dark:hover:bg-yellow-950/50 dark:border-yellow-800',
    activeColor: 'bg-yellow-600 text-white hover:bg-yellow-700 dark:bg-yellow-600',
  },
  duplicate: { 
    label: 'Duplikate', 
    icon: Copy, 
    color: 'text-orange-700 dark:text-orange-400',
    bgColor: 'bg-orange-50 hover:bg-orange-100 border-orange-200 dark:bg-orange-950/30 dark:hover:bg-orange-950/50 dark:border-orange-800',
    activeColor: 'bg-orange-600 text-white hover:bg-orange-700 dark:bg-orange-600',
  },
  error: { 
    label: 'Fehler', 
    icon: XCircle, 
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-50 hover:bg-red-100 border-red-200 dark:bg-red-950/30 dark:hover:bg-red-950/50 dark:border-red-800',
    activeColor: 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-600',
  },
  skipped: { 
    label: 'Übersprungen', 
    icon: Ban, 
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-100 hover:bg-gray-200 border-gray-200 dark:bg-gray-800/50 dark:hover:bg-gray-800 dark:border-gray-700',
    activeColor: 'bg-gray-600 text-white hover:bg-gray-700 dark:bg-gray-600',
  },
};

export function UploadStatusFilter({ counts, activeFilter, onFilterChange }: UploadStatusFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(statusConfig) as UploadFilterStatus[]).map((status) => {
        const config = statusConfig[status];
        const Icon = config.icon;
        const count = counts[status];
        const isActive = activeFilter === status;

        // Hide empty filters (except "all")
        if (count === 0 && status !== 'all') return null;

        return (
          <Button
            key={status}
            variant="outline"
            size="sm"
            onClick={() => onFilterChange(status)}
            className={cn(
              "gap-1.5 transition-all border",
              isActive ? config.activeColor : config.bgColor,
              !isActive && config.color
            )}
          >
            <Icon className={cn(
              "h-3.5 w-3.5",
              status === 'processing' && !isActive && "animate-spin"
            )} />
            <span className="hidden sm:inline">{config.label}</span>
            <Badge 
              variant="secondary" 
              className={cn(
                "ml-1 h-5 min-w-5 px-1.5 text-xs font-medium",
                isActive 
                  ? "bg-white/20 text-inherit border-white/30" 
                  : "bg-background/80 text-inherit"
              )}
            >
              {count}
            </Badge>
          </Button>
        );
      })}
    </div>
  );
}
