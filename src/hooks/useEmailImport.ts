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
export type OAuthProvider = 'gmail' | 'microsoft';

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
  sync_interval: 'manual' | '5min' | '15min' | '30min' | '1hour' | '6hours' | '12hours' | 'daily';
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
  // OAuth fields
  oauth_provider: OAuthProvider | null;
  oauth_access_token: string | null;
  oauth_refresh_token: string | null;
  oauth_token_expires_at: string | null;
  oauth_scope: string | null;
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

// Generate a cryptographically secure random token for email addresses
// Uses 32 characters for better security against brute force attacks
const generateToken = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join('');
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
      const importEmail = `receipts+${token}@import.billmonk.ai`;

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
      const newEmail = `receipts+${newToken}@import.billmonk.ai`;

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

  // Helper function to encrypt password server-side using AES-GCM
  const encryptPasswordServerSide = async (password: string): Promise<string> => {
    const { data, error } = await supabase.functions.invoke('encrypt-password', {
      body: { password },
    });
    
    if (error || !data?.success) {
      throw new Error(data?.error || 'Passwort-Verschlüsselung fehlgeschlagen');
    }
    
    return data.encrypted;
  };

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

      // SECURITY: Encrypt password server-side using AES-GCM
      // This ensures passwords are never stored as plain Base64 which is trivially reversible
      // OAuth-based connections (Gmail, Microsoft) are still preferred as they don't require storing passwords
      const encryptedPassword = await encryptPasswordServerSide(account.imap_password);

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
      
      // Handle password update - encrypt server-side using AES-GCM
      if ('imap_password' in updates && updates.imap_password) {
        const encryptedPassword = await encryptPasswordServerSide(updates.imap_password as string);
        updateData.imap_password_encrypted = encryptedPassword;
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

  // Trigger manual sync for email account with optimistic UI updates
  // Automatically selects correct sync function based on oauth_provider
  const syncEmailAccountMutation = useMutation({
    mutationFn: async ({ accountId, resync = false }: { accountId: string; resync?: boolean }) => {
      // Find account to determine correct sync function
      const account = emailAccounts.find(a => a.id === accountId);
      
      // Select sync function based on OAuth provider
      let functionName = 'sync-imap-emails'; // Default: IMAP
      
      if (account?.oauth_provider === 'gmail') {
        functionName = 'sync-gmail';
      } else if (account?.oauth_provider === 'microsoft') {
        functionName = 'sync-microsoft'; // To be implemented
      }
      
      // Sync account via edge function
      
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { accountId, resync },
      });

      if (error) throw error;
      
      // Check if the response indicates an error
      if (data && !data.success) {
        throw new Error(data.error || 'Sync fehlgeschlagen');
      }
      
      return data;
    },
    onMutate: async ({ accountId }) => {
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
    onError: (error: Error, { accountId }) => {
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

  // Start OAuth flow - currently only Gmail is supported
  const startOAuth = async (provider: 'gmail') => {
    // Only Gmail is supported at the moment
    if (provider !== 'gmail') {
      toast.error('Nicht verfügbar', {
        description: 'Bitte verwende IMAP für diesen Anbieter.',
      });
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        toast.error('Nicht angemeldet', {
          description: 'Bitte melde dich an, um E-Mail-Konten zu verbinden.',
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('oauth-start', {
        body: { provider },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      
      if (!data.success || !data.authUrl) {
        throw new Error(data.error || 'OAuth konnte nicht gestartet werden');
      }

      // Redirect zu OAuth Provider
      window.location.href = data.authUrl;
      
    } catch (error: any) {
      console.error('OAuth Start Error:', error);
      toast.error('Fehler', {
        description: error.message || 'OAuth konnte nicht gestartet werden',
      });
    }
  };

  // Disconnect OAuth account
  const disconnectOAuthAccount = async (accountId: string) => {
    try {
      const { error } = await supabase
        .from('email_accounts')
        .update({
          oauth_access_token: null,
          oauth_refresh_token: null,
          oauth_token_expires_at: null,
          is_active: false,
        })
        .eq('id', accountId);

      if (error) throw error;

      toast.success('Verbindung getrennt', {
        description: 'Das E-Mail-Konto wurde getrennt.',
      });

      queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
    } catch (error: any) {
      toast.error('Fehler', {
        description: error.message,
      });
    }
  };

  // Refetch email accounts helper
  const refetchEmailAccounts = () => {
    queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
  };

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
    
    // OAuth functions
    startOAuth,
    disconnectOAuthAccount,
    refetchEmailAccounts,
    
    // Import history & attachments
    importHistory,
    emailAttachments,
    retryAttachment: retryAttachmentMutation.mutate,
    skipAttachment: skipAttachmentMutation.mutate,
    
    // Loading states
    isLoading: isLoadingConnection || isLoadingAccounts || isLoadingHistory || isLoadingAttachments,
  };
};
