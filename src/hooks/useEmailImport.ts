import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface EmailConnection {
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

interface EmailImport {
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

  // Fetch email connection for current user
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

  // Create email connection
  const createConnectionMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Nicht angemeldet');

      const token = generateToken();
      // The import email will be configured by the user based on their email service
      // Default format: receipts+TOKEN@yourdomain.com
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

  // Toggle connection active state
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
      toast.success(isActive ? 'E-Mail-Import aktiviert' : 'E-Mail-Import deaktiviert');
    },
    onError: (error: Error) => {
      console.error('Error toggling email connection:', error);
      toast.error('Fehler beim Ändern des Status');
    },
  });

  // Regenerate token
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

  // Delete connection
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

  return {
    emailConnection,
    importHistory,
    isLoading: isLoadingConnection || isLoadingHistory,
    createConnection: createConnectionMutation.mutate,
    isCreating: createConnectionMutation.isPending,
    toggleConnection: toggleConnectionMutation.mutate,
    isToggling: toggleConnectionMutation.isPending,
    regenerateToken: regenerateTokenMutation.mutate,
    isRegenerating: regenerateTokenMutation.isPending,
    deleteConnection: deleteConnectionMutation.mutate,
    isDeleting: deleteConnectionMutation.isPending,
  };
};
