import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Tag, ReceiptTag, CreateTagInput, UpdateTagInput, TagWithAssignment } from '@/types/tags';

const TAGS_KEY = 'tags';
const RECEIPT_TAGS_KEY = 'receipt-tags';

export function useTags() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Query: All tags for the user
  const {
    data: tags = [],
    isLoading: loading,
    error,
    refetch: fetchTags,
  } = useQuery({
    queryKey: [TAGS_KEY, user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true })
        .order('name');

      if (error) throw new Error(error.message);
      return (data || []) as Tag[];
    },
    enabled: !!user,
  });

  // Computed: Only active tags
  const activeTags = tags.filter(tag => tag.is_active);

  // Get tags for a single receipt
  const getTagsForReceipt = async (receiptId: string): Promise<Tag[]> => {
    if (!user) return [];

    const { data, error } = await supabase
      .from('receipt_tags')
      .select('tag_id, tags(*)')
      .eq('receipt_id', receiptId);

    if (error) {
      console.error('Error fetching receipt tags:', error);
      return [];
    }

    return (data || [])
      .map(item => item.tags as unknown as Tag)
      .filter(Boolean);
  };

  // Get tags for multiple receipts (for bulk operations)
  const getTagsForReceipts = async (receiptIds: string[]): Promise<TagWithAssignment[]> => {
    if (!user || receiptIds.length === 0) return [];

    const { data, error } = await supabase
      .from('receipt_tags')
      .select('receipt_id, tag_id')
      .in('receipt_id', receiptIds);

    if (error) {
      console.error('Error fetching bulk receipt tags:', error);
      return [];
    }

    // Count how many receipts have each tag
    const tagCounts = new Map<string, number>();
    (data || []).forEach(item => {
      const count = tagCounts.get(item.tag_id) || 0;
      tagCounts.set(item.tag_id, count + 1);
    });

    // Map tags with assignment info
    return tags.map(tag => ({
      ...tag,
      isAssigned: tagCounts.has(tag.id),
      assignmentCount: tagCounts.get(tag.id) || 0,
    }));
  };

  // Query for receipt-specific tags
  const useReceiptTags = (receiptId: string | null) => {
    return useQuery({
      queryKey: [RECEIPT_TAGS_KEY, receiptId],
      queryFn: async () => {
        if (!receiptId) return [];
        return getTagsForReceipt(receiptId);
      },
      enabled: !!receiptId && !!user,
    });
  };

  // Mutation: Create tag
  const createTagMutation = useMutation({
    mutationFn: async (input: CreateTagInput) => {
      if (!user) throw new Error('Nicht angemeldet');

      const maxSortOrder = Math.max(...tags.map(t => t.sort_order), 0);

      const { data, error } = await supabase
        .from('tags')
        .insert({
          user_id: user.id,
          name: input.name,
          color: input.color,
          is_active: input.is_active ?? true,
          sort_order: input.sort_order ?? maxSortOrder + 1,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as Tag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TAGS_KEY] });
      toast.success('Tag erstellt');
    },
    onError: (error: Error) => {
      toast.error(`Fehler beim Erstellen: ${error.message}`);
    },
  });

  // Mutation: Update tag
  const updateTagMutation = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateTagInput }) => {
      if (!user) throw new Error('Nicht angemeldet');

      const { data, error } = await supabase
        .from('tags')
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as Tag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TAGS_KEY] });
      toast.success('Tag aktualisiert');
    },
    onError: (error: Error) => {
      toast.error(`Fehler beim Aktualisieren: ${error.message}`);
    },
  });

  // Mutation: Delete tag
  const deleteTagMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Nicht angemeldet');

      const { error } = await supabase
        .from('tags')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TAGS_KEY] });
      queryClient.invalidateQueries({ queryKey: [RECEIPT_TAGS_KEY] });
      toast.success('Tag gelöscht');
    },
    onError: (error: Error) => {
      toast.error(`Fehler beim Löschen: ${error.message}`);
    },
  });

  // Mutation: Toggle active status
  const toggleTagActiveMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Nicht angemeldet');

      const tag = tags.find(t => t.id === id);
      if (!tag) throw new Error('Tag nicht gefunden');

      const { data, error } = await supabase
        .from('tags')
        .update({
          is_active: !tag.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as Tag;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [TAGS_KEY] });
      toast.success(data.is_active ? 'Tag aktiviert' : 'Tag deaktiviert');
    },
    onError: (error: Error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  // Mutation: Assign tag to receipt
  const assignTagMutation = useMutation({
    mutationFn: async ({ receiptId, tagId }: { receiptId: string; tagId: string }) => {
      if (!user) throw new Error('Nicht angemeldet');

      const { data, error } = await supabase
        .from('receipt_tags')
        .insert({
          receipt_id: receiptId,
          tag_id: tagId,
        })
        .select()
        .single();

      if (error) {
        // Ignore duplicate constraint violations
        if (error.code === '23505') return null;
        throw new Error(error.message);
      }
      return data as ReceiptTag;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [RECEIPT_TAGS_KEY, variables.receiptId] });
    },
    onError: (error: Error) => {
      toast.error(`Fehler beim Zuweisen: ${error.message}`);
    },
  });

  // Mutation: Remove tag from receipt
  const removeTagMutation = useMutation({
    mutationFn: async ({ receiptId, tagId }: { receiptId: string; tagId: string }) => {
      if (!user) throw new Error('Nicht angemeldet');

      const { error } = await supabase
        .from('receipt_tags')
        .delete()
        .eq('receipt_id', receiptId)
        .eq('tag_id', tagId);

      if (error) throw new Error(error.message);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [RECEIPT_TAGS_KEY, variables.receiptId] });
    },
    onError: (error: Error) => {
      toast.error(`Fehler beim Entfernen: ${error.message}`);
    },
  });

  // Mutation: Bulk assign tag to multiple receipts
  const bulkAssignTagMutation = useMutation({
    mutationFn: async ({ receiptIds, tagId }: { receiptIds: string[]; tagId: string }) => {
      if (!user) throw new Error('Nicht angemeldet');

      const inserts = receiptIds.map(receiptId => ({
        receipt_id: receiptId,
        tag_id: tagId,
      }));

      const { error } = await supabase
        .from('receipt_tags')
        .upsert(inserts, { onConflict: 'receipt_id,tag_id', ignoreDuplicates: true });

      if (error) throw new Error(error.message);
      return receiptIds.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: [RECEIPT_TAGS_KEY] });
      toast.success(`Tag zu ${count} Beleg(en) hinzugefügt`);
    },
    onError: (error: Error) => {
      toast.error(`Fehler beim Zuweisen: ${error.message}`);
    },
  });

  // Mutation: Bulk remove tag from multiple receipts
  const bulkRemoveTagMutation = useMutation({
    mutationFn: async ({ receiptIds, tagId }: { receiptIds: string[]; tagId: string }) => {
      if (!user) throw new Error('Nicht angemeldet');

      const { error } = await supabase
        .from('receipt_tags')
        .delete()
        .in('receipt_id', receiptIds)
        .eq('tag_id', tagId);

      if (error) throw new Error(error.message);
      return receiptIds.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: [RECEIPT_TAGS_KEY] });
      toast.success(`Tag von ${count} Beleg(en) entfernt`);
    },
    onError: (error: Error) => {
      toast.error(`Fehler beim Entfernen: ${error.message}`);
    },
  });

  // Helper functions for easier API
  const createTag = (input: CreateTagInput) => createTagMutation.mutateAsync(input);
  const updateTag = (id: string, input: UpdateTagInput) => updateTagMutation.mutateAsync({ id, input });
  const deleteTag = (id: string) => deleteTagMutation.mutateAsync(id);
  const toggleTagActive = (id: string) => toggleTagActiveMutation.mutateAsync(id);
  const assignTag = (receiptId: string, tagId: string) => assignTagMutation.mutateAsync({ receiptId, tagId });
  const removeTag = (receiptId: string, tagId: string) => removeTagMutation.mutateAsync({ receiptId, tagId });
  const bulkAssignTag = (receiptIds: string[], tagId: string) => bulkAssignTagMutation.mutateAsync({ receiptIds, tagId });
  const bulkRemoveTag = (receiptIds: string[], tagId: string) => bulkRemoveTagMutation.mutateAsync({ receiptIds, tagId });

  return {
    // Data
    tags,
    activeTags,
    loading,
    error: error?.message || null,

    // Queries
    fetchTags,
    getTagsForReceipt,
    getTagsForReceipts,
    useReceiptTags,

    // Mutations
    createTag,
    updateTag,
    deleteTag,
    toggleTagActive,
    assignTag,
    removeTag,
    bulkAssignTag,
    bulkRemoveTag,

    // Loading states
    isCreating: createTagMutation.isPending,
    isUpdating: updateTagMutation.isPending,
    isDeleting: deleteTagMutation.isPending,
    isAssigning: assignTagMutation.isPending || bulkAssignTagMutation.isPending,
    isRemoving: removeTagMutation.isPending || bulkRemoveTagMutation.isPending,
  };
}
