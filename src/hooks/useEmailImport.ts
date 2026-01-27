import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface EmailConnection {
  id: string;
  user_id: string;
  import_email: string;
  import_token: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_import_at: string | null;
  import_count: number;
}

export interface EmailImport {
  id: string;
  email_connection_id: string;
  user_id: string;
  from_address: string | null;
  subject: string | null;
  received_at: string;
  status: string;
  attachments_count: number;
  processed_receipts: number;
  error_message: string | null;
}

export type EmailProvider = 'gmail' | 'microsoft' | 'icloud' | 'imap';

export interface EmailAccount {
  id: string;
  user_id: string;
  email_address: string;
  display_name: string | null;
  provider: EmailProvider;
  imap_host: string;
  imap_port: number;
  imap_username: string;
  imap_use_ssl: boolean;
  inbox_folder: string;
  processed_folder: string;
  sync_interval: 'manual' | '5min' | '15min' | '30min' | '1hour';
  is_active: boolean;
  // Sync status fields
  last_sync_at: string | null;
  last_sync_status: 'pending' | 'idle' | 'running' | 'syncing' | 'success' | 'partial' | 'error';
  last_sync_error: string | null;
  last_synced_uid: string | null;
  last_sync_attempt: string | null;
  total_imported: number;
  // Filter fields
  sender_filter: string[] | null;
  subject_keywords: string[] | null;
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface EmailAttachment {
  id: string;
  email_connection_id: string;
  email_import_id: string | null;
  user_id: string;
  email_message_id: string | null;
  email_subject: string | null;
  email_from: string | null;
  email_received_at: string | null;
  attachment_filename: string;
  attachment_content_type: string | null;
  attachment_size: number | null;
  status: 'pending' | 'processing' | 'imported' | 'skipped' | 'error' | 'duplicate';
  error_message: string | null;
  receipt_id: string | null;
  file_hash: string | null;
  is_duplicate: boolean;
  duplicate_of: string | null;
  created_at: string;
  processed_at: string | null;
  storage_path: string | null;
}

// Generate a random token for email addresses
const generateToken = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 12; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
};

export const useEmailImport = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch email connection for current user (webhook-based)
  const { data: emailConnection, isLoading: isLoadingConnection } = useQuery({
    queryKey: ['email-connection', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('email_connections')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as EmailConnection | null;
    },
    enabled: !!user?.id,
  });

  // Fetch IMAP email accounts
  const { data: emailAccounts = [], isLoading: isLoadingAccounts } = useQuery({
    queryKey: ['email-accounts', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('email_accounts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as EmailAccount[];
    },
    enabled: !!user?.id,
  });

  // Fetch import history
  const { data: importHistory = [], isLoading: isLoadingHistory } = useQuery({
    queryKey: ['email-imports', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('email_imports')
        .select('*')
        .eq('user_id', user.id)
        .order('received_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as EmailImport[];
    },
    enabled: !!user?.id,
  });

  // Fetch email attachments
  const { data: emailAttachments = [], isLoading: isLoadingAttachments } = useQuery({
    queryKey: ['email-attachments', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('email_attachments')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data as EmailAttachment[];
    },
    enabled: !!user?.id,
  });

  // Create webhook email connection
  const createConnectionMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Nicht angemeldet');

      const token = generateToken();
      const importEmail = `receipts+${token}@import.lovable.app`;

      const { data, error } = await supabase
        .from('email_connections')
        .insert({
          user_id: user.id,
          import_email: importEmail,
          import_token: token,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data as EmailConnection;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-connection'] });
      toast.success('E-Mail-Import aktiviert');
    },
    onError: (error: Error) => {
      console.error('Error creating email connection:', error);
      toast.error('Fehler beim Aktivieren des E-Mail-Imports');
    },
  });

  // Toggle webhook connection active state
  const toggleConnectionMutation = useMutation({
    mutationFn: async (isActive: boolean) => {
      if (!emailConnection?.id) throw new Error('Keine Verbindung vorhanden');

      const { error } = await supabase
        .from('email_connections')
        .update({ is_active: isActive })
        .eq('id', emailConnection.id);

      if (error) throw error;
    },
    onSuccess: (_, isActive) => {
      queryClient.invalidateQueries({ queryKey: ['email-connection'] });
      toast.success(isActive ? 'E-Mail-Import aktiviert' : 'E-Mail-Import pausiert');
    },
    onError: (error: Error) => {
      console.error('Error toggling email connection:', error);
      toast.error('Fehler beim Ändern des Status');
    },
  });

  // Regenerate webhook token
  const regenerateTokenMutation = useMutation({
    mutationFn: async () => {
      if (!emailConnection?.id || !user?.id) throw new Error('Keine Verbindung vorhanden');

      const newToken = generateToken();
      const newEmail = `receipts+${newToken}@import.lovable.app`;

      const { error } = await supabase
        .from('email_connections')
        .update({
          import_token: newToken,
          import_email: newEmail,
        })
        .eq('id', emailConnection.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-connection'] });
      toast.success('Neue Import-Adresse generiert');
    },
    onError: (error: Error) => {
      console.error('Error regenerating token:', error);
      toast.error('Fehler beim Generieren einer neuen Adresse');
    },
  });

  // Delete webhook connection
  const deleteConnectionMutation = useMutation({
    mutationFn: async () => {
      if (!emailConnection?.id) throw new Error('Keine Verbindung vorhanden');

      const { error } = await supabase
        .from('email_connections')
        .delete()
        .eq('id', emailConnection.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-connection'] });
      queryClient.invalidateQueries({ queryKey: ['email-imports'] });
      toast.success('E-Mail-Import deaktiviert');
    },
    onError: (error: Error) => {
      console.error('Error deleting email connection:', error);
      toast.error('Fehler beim Deaktivieren');
    },
  });

  // Add IMAP email account
  const addEmailAccountMutation = useMutation({
    mutationFn: async (account: {
      email_address: string;
      display_name?: string;
      imap_host: string;
      imap_port: number;
      imap_username: string;
      imap_password: string;
      imap_use_ssl?: boolean;
      inbox_folder?: string;
      processed_folder?: string;
      sync_interval?: string;
    }) => {
      if (!user?.id) throw new Error('Nicht angemeldet');

      // Simple encryption (in production, use Supabase Vault)
      const encryptedPassword = btoa(account.imap_password);

      const { data, error } = await supabase
        .from('email_accounts')
        .insert({
          user_id: user.id,
          email_address: account.email_address,
          display_name: account.display_name || null,
          imap_host: account.imap_host,
          imap_port: account.imap_port,
          imap_username: account.imap_username,
          imap_password_encrypted: encryptedPassword,
          imap_use_ssl: account.imap_use_ssl ?? true,
          inbox_folder: account.inbox_folder || 'INBOX',
          processed_folder: account.processed_folder || 'Processed',
          sync_interval: account.sync_interval || 'manual',
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data as EmailAccount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
      toast.success('E-Mail-Konto hinzugefügt');
    },
    onError: (error: Error) => {
      console.error('Error adding email account:', error);
      toast.error('Fehler beim Hinzufügen des E-Mail-Kontos');
    },
  });

  // Update IMAP email account
  const updateEmailAccountMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<EmailAccount> & { id: string; imap_password?: string }) => {
      const updateData: Record<string, unknown> = { ...updates };
      
      // Handle password update
      if ('imap_password' in updates && updates.imap_password) {
        updateData.imap_password_encrypted = btoa(updates.imap_password as string);
        delete updateData.imap_password;
      }

      const { error } = await supabase
        .from('email_accounts')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
      toast.success('E-Mail-Konto aktualisiert');
    },
    onError: (error: Error) => {
      console.error('Error updating email account:', error);
      toast.error('Fehler beim Aktualisieren des E-Mail-Kontos');
    },
  });

  // Delete IMAP email account
  const deleteEmailAccountMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('email_accounts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
      toast.success('E-Mail-Konto gelöscht');
    },
    onError: (error: Error) => {
      console.error('Error deleting email account:', error);
      toast.error('Fehler beim Löschen des E-Mail-Kontos');
    },
  });

  // Trigger manual sync for IMAP account with optimistic UI updates
  const syncEmailAccountMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const { data, error } = await supabase.functions.invoke('sync-imap-emails', {
        body: { accountId },
      });

      if (error) throw error;
      
      // Check if the response indicates an error
      if (data && !data.success) {
        throw new Error(data.error || 'Sync fehlgeschlagen');
      }
      
      return data;
    },
    onMutate: async (accountId: string) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['email-accounts', user?.id] });
      
      // Snapshot the previous value
      const previousAccounts = queryClient.getQueryData(['email-accounts', user?.id]);
      
      // Optimistically update to syncing status
      queryClient.setQueryData(['email-accounts', user?.id], (old: EmailAccount[] | undefined) => 
        old?.map(acc => 
          acc.id === accountId 
            ? { ...acc, last_sync_status: 'running' as const, last_sync_error: null } 
            : acc
        ) || []
      );
      
      return { previousAccounts };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['email-attachments'] });
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      
      const imported = data?.imported || 0;
      const message = data?.message || `${imported} Rechnungen importiert`;
      
      if (imported > 0) {
        toast.success('Sync erfolgreich', {
          description: message,
        });
      } else {
        toast.success('Sync abgeschlossen', {
          description: 'Keine neuen Rechnungen gefunden',
        });
      }
    },
    onError: (error: Error, accountId: string, context) => {
      console.error('Error syncing email account:', error);
      
      // Rollback to previous state but with error status
      queryClient.setQueryData(['email-accounts', user?.id], (old: EmailAccount[] | undefined) => 
        old?.map(acc => 
          acc.id === accountId 
            ? { ...acc, last_sync_status: 'error' as const, last_sync_error: error.message } 
            : acc
        ) || []
      );
      
      toast.error('Sync fehlgeschlagen', {
        description: error.message || 'E-Mails konnten nicht abgerufen werden',
      });
      
      // Refetch to get actual DB state
      queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
    },
  });

  // Retry processing failed attachment
  const retryAttachmentMutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      const { error } = await supabase
        .from('email_attachments')
        .update({ status: 'pending', error_message: null })
        .eq('id', attachmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-attachments'] });
      toast.success('Verarbeitung wird wiederholt');
    },
    onError: (error: Error) => {
      console.error('Error retrying attachment:', error);
      toast.error('Fehler beim Wiederholen');
    },
  });

  // Skip attachment
  const skipAttachmentMutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      const { error } = await supabase
        .from('email_attachments')
        .update({ status: 'skipped' })
        .eq('id', attachmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-attachments'] });
      toast.success('Anhang übersprungen');
    },
    onError: (error: Error) => {
      console.error('Error skipping attachment:', error);
      toast.error('Fehler beim Überspringen');
    },
  });

  return {
    // Webhook connection
    emailConnection,
    createConnection: createConnectionMutation.mutate,
    isCreating: createConnectionMutation.isPending,
    toggleConnection: toggleConnectionMutation.mutate,
    isToggling: toggleConnectionMutation.isPending,
    regenerateToken: regenerateTokenMutation.mutate,
    isRegenerating: regenerateTokenMutation.isPending,
    deleteConnection: deleteConnectionMutation.mutate,
    isDeleting: deleteConnectionMutation.isPending,
    
    // IMAP accounts
    emailAccounts,
    addEmailAccount: addEmailAccountMutation.mutate,
    isAddingAccount: addEmailAccountMutation.isPending,
    updateEmailAccount: updateEmailAccountMutation.mutate,
    isUpdatingAccount: updateEmailAccountMutation.isPending,
    deleteEmailAccount: deleteEmailAccountMutation.mutate,
    isDeletingAccount: deleteEmailAccountMutation.isPending,
    syncEmailAccount: syncEmailAccountMutation.mutate,
    isSyncing: syncEmailAccountMutation.isPending,
    
    // Import history & attachments
    importHistory,
    emailAttachments,
    retryAttachment: retryAttachmentMutation.mutate,
    skipAttachment: skipAttachmentMutation.mutate,
    
    // Loading states
    isLoading: isLoadingConnection || isLoadingAccounts || isLoadingHistory || isLoadingAttachments,
  };
};
