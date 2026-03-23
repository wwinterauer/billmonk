import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { X, Info, AlertTriangle, Wrench } from 'lucide-react';

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: string;
}

export function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchAnnouncements = async () => {
      const { data } = await supabase
        .from('announcements')
        .select('id, title, message, type')
        .eq('is_active', true)
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());
      setAnnouncements((data as Announcement[]) || []);
    };

    // Load dismissed from sessionStorage
    const stored = sessionStorage.getItem('dismissed_announcements');
    if (stored) {
      setDismissed(new Set(JSON.parse(stored)));
    }

    fetchAnnouncements();
  }, []);

  const dismiss = (id: string) => {
    const newDismissed = new Set(dismissed);
    newDismissed.add(id);
    setDismissed(newDismissed);
    sessionStorage.setItem('dismissed_announcements', JSON.stringify([...newDismissed]));
  };

  const visible = announcements.filter((a) => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  const typeStyles: Record<string, string> = {
    info: 'bg-primary/10 border-primary/20 text-primary',
    warning: 'bg-destructive/10 border-destructive/20 text-destructive',
    maintenance: 'bg-secondary border-secondary text-secondary-foreground',
  };

  const typeIcons: Record<string, typeof Info> = {
    info: Info,
    warning: AlertTriangle,
    maintenance: Wrench,
  };

  return (
    <div className="space-y-2 mb-4">
      {visible.map((a) => {
        const Icon = typeIcons[a.type] || Info;
        return (
          <div
            key={a.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${typeStyles[a.type] || typeStyles.info}`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="font-medium text-sm">{a.title}</span>
              <span className="text-sm ml-2">{a.message}</span>
            </div>
            <button onClick={() => dismiss(a.id)} className="shrink-0 hover:opacity-70">
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
