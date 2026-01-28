import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Mail, Inbox } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface EmailSourceBadgeProps {
  source: string;
  emailFrom?: string | null;
  emailSubject?: string | null;
  emailReceivedAt?: string | null;
  compact?: boolean;
}

export function EmailSourceBadge({ 
  source, 
  emailFrom, 
  emailSubject,
  emailReceivedAt,
  compact = false 
}: EmailSourceBadgeProps) {
  // Nur für E-Mail-Quellen anzeigen
  if (!source?.startsWith('email_')) {
    return null;
  }

  const sourceLabel = source === 'email_imap' ? 'IMAP' : 
                      source === 'email_webhook' ? 'Webhook' : 'E-Mail';

  // Extrahiere E-Mail-Adresse aus "Name <email@example.com>" Format
  const extractEmail = (from: string): string => {
    const match = from.match(/<([^>]+)>/);
    return match ? match[1] : from;
  };

  // Extrahiere Name aus "Name <email@example.com>" Format
  const extractName = (from: string): string => {
    const match = from.match(/^([^<]+)</);
    return match ? match[1].trim() : from.split('@')[0];
  };

  const email = emailFrom ? extractEmail(emailFrom) : null;
  const senderName = emailFrom ? extractName(emailFrom) : null;

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800 cursor-help"
            >
              <Mail className="h-3 w-3" />
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="space-y-1">
              <p className="font-medium">Per E-Mail importiert ({sourceLabel})</p>
              {emailFrom && (
                <p className="text-xs text-muted-foreground">
                  Von: {emailFrom}
                </p>
              )}
              {emailSubject && (
                <p className="text-xs text-muted-foreground truncate">
                  Betreff: {emailSubject}
                </p>
              )}
              {emailReceivedAt && (
                <p className="text-xs text-muted-foreground">
                  Empfangen:{' '}
                  {format(new Date(emailReceivedAt), 'dd.MM.yyyy HH:mm', { locale: de })}
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="space-y-2">
      <Badge 
        variant="outline" 
        className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800"
      >
        <Inbox className="h-3 w-3 mr-1.5" />
        E-Mail Import ({sourceLabel})
      </Badge>
      
      {emailFrom && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 text-sm text-muted-foreground cursor-help">
                <Mail className="h-4 w-4 text-blue-500" />
                <span className="truncate max-w-[200px]">
                  von {senderName || email}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm">
              <div className="space-y-1">
                <p className="font-medium">{email}</p>
                {emailSubject && (
                  <p className="text-xs text-muted-foreground">
                    {emailSubject}
                  </p>
                )}
                {emailReceivedAt && (
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(emailReceivedAt), 'dd.MM.yyyy HH:mm', { locale: de })}
                  </p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
