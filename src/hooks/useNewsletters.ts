import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface Newsletter {
  id: string;
  user_id: string;
  subject: string;
  html_content: string;
  recipient_type: string;
  recipient_filter: Record<string, unknown> | null;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  status: string;
  sent_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface NewsletterRecipient {
  id: string;
  newsletter_id: string;
  email: string;
  name: string | null;
  status: string;
  error_message: string | null;
  sent_at: string | null;
}

export function useNewsletters() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNewsletters = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('newsletters')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    } else {
      setNewsletters(data as unknown as Newsletter[]);
    }
    setLoading(false);
  }, [user, toast]);

  useEffect(() => { fetchNewsletters(); }, [fetchNewsletters]);

  const createNewsletter = async (subject: string, htmlContent: string, recipientType: string, recipientFilter?: Record<string, unknown>) => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('newsletters')
      .insert({
        user_id: user.id,
        subject,
        html_content: htmlContent,
        recipient_type: recipientType,
        recipient_filter: (recipientFilter || {}) as any,
        status: 'draft',
      } as any)
      .select()
      .single();
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      return null;
    }
    await fetchNewsletters();
    return data as unknown as Newsletter;
  };

  const updateNewsletter = async (id: string, updates: Partial<Newsletter>) => {
    const { error } = await supabase.from('newsletters').update(updates as any).eq('id', id);
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      return false;
    }
    await fetchNewsletters();
    return true;
  };

  const deleteNewsletter = async (id: string) => {
    const { error } = await supabase.from('newsletters').delete().eq('id', id);
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      return false;
    }
    toast({ title: 'Newsletter gelöscht' });
    await fetchNewsletters();
    return true;
  };

  const sendNewsletter = async (newsletterId: string) => {
    if (!user) return false;
    try {
      const { data, error } = await supabase.functions.invoke('send-newsletter', {
        body: { newsletter_id: newsletterId },
      });
      if (error) throw error;
      toast({ title: 'Newsletter wird versendet', description: 'Der Versand wurde gestartet.' });
      await fetchNewsletters();
      return true;
    } catch (err: any) {
      toast({ title: 'Fehler beim Versand', description: err.message, variant: 'destructive' });
      return false;
    }
  };

  const fetchRecipients = async (newsletterId: string) => {
    const { data, error } = await supabase
      .from('newsletter_recipients')
      .select('*')
      .eq('newsletter_id', newsletterId)
      .order('sent_at', { ascending: false });
    if (error) return [];
    return data as unknown as NewsletterRecipient[];
  };

  return { newsletters, loading, fetchNewsletters, createNewsletter, updateNewsletter, deleteNewsletter, sendNewsletter, fetchRecipients };
}
