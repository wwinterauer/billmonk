import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  Mail, 
  Upload, 
  Camera, 
  Share2, 
  Scissors, 
  Cloud, 
  Landmark,
  FileX,
  LucideIcon,
} from 'lucide-react';
import { EmailSourceBadge } from './EmailSourceBadge';

interface SourceBadgeProps {
  receipt: {
    source?: string | null;
    is_no_receipt_entry?: boolean | null;
  };
  emailData?: {
    email_from?: string | null;
    email_subject?: string | null;
    email_received_at?: string | null;
  } | null;
  compact?: boolean;
}

interface SourceConfig {
  icon: LucideIcon;
  label: string;
  className: string;
}

const sourceConfig: Record<string, SourceConfig> = {
  upload: { 
    icon: Upload, 
    label: 'Upload', 
    className: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700' 
  },
  camera: { 
    icon: Camera, 
    label: 'Kamera', 
    className: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800' 
  },
  share: { 
    icon: Share2, 
    label: 'Geteilt', 
    className: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800' 
  },
  split: { 
    icon: Scissors, 
    label: 'Aufgeteilt', 
    className: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800' 
  },
  cloud: { 
    icon: Cloud, 
    label: 'Cloud', 
    className: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800' 
  },
  bank_import: { 
    icon: Landmark, 
    label: 'Bank', 
    className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800' 
  },
};

export function SourceBadge({ receipt, emailData, compact = false }: SourceBadgeProps) {
  const source = receipt.source || 'upload';

  // E-Mail Sources haben eigene Komponente
  if (source.startsWith('email_')) {
    return (
      <EmailSourceBadge
        source={source}
        emailFrom={emailData?.email_from}
        emailSubject={emailData?.email_subject}
        emailReceivedAt={emailData?.email_received_at}
        compact={compact}
      />
    );
  }

  const config = sourceConfig[source];
  if (!config) return null;

  const Icon = config.icon;

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={config.className}>
              <Icon className="h-3 w-3" />
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{config.label}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Badge variant="outline" className={config.className}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}

// Separate Badge für "Keine Rechnung" Einträge
export function NoReceiptBadge({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800"
            >
              <FileX className="h-3 w-3" />
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Keine Rechnung vorhanden</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Badge 
      variant="outline" 
      className="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800"
    >
      <FileX className="h-3 w-3 mr-1" />
      Keine Rechnung
    </Badge>
  );
}
