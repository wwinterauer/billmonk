import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Category {
  id: string;
  user_id: string | null;
  name: string;
  icon: string | null;
  color: string | null;
  is_system: boolean;
  is_hidden: boolean;
  sort_order: number;
  created_at: string;
}

export function useCategories(options?: { includeHidden?: boolean }) {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const includeHidden = options?.includeHidden ?? false;

  const fetchCategories = async () => {
    if (!user) {
      setCategories([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name');

      // Filter hidden unless explicitly included
      if (!includeHidden) {
        query = query.eq('is_hidden', false);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      // Map data with defaults for new columns
      const mappedData = (data || []).map(cat => ({
        ...cat,
        is_hidden: cat.is_hidden ?? false,
        sort_order: cat.sort_order ?? 0,
      })) as Category[];

      setCategories(mappedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Kategorien');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [user, includeHidden]);

  const addCategory = async (
    name: string, 
    icon?: string, 
    color?: string
  ): Promise<Category> => {
    if (!user) throw new Error('Nicht angemeldet');

    const maxSortOrder = Math.max(...categories.map(c => c.sort_order), 0);

    const { data, error } = await supabase
      .from('categories')
      .insert({
        user_id: user.id,
        name,
        icon: icon || null,
        color: color || null,
        is_system: false,
        is_hidden: false,
        sort_order: maxSortOrder + 1,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    const newCategory = {
      ...data,
      is_hidden: data.is_hidden ?? false,
      sort_order: data.sort_order ?? 0,
    } as Category;
    
    setCategories(prev => [...prev, newCategory]);
    return newCategory;
  };

  const updateCategory = async (
    id: string, 
    updates: Partial<Pick<Category, 'name' | 'icon' | 'color' | 'is_hidden' | 'sort_order'>>
  ): Promise<Category> => {
    if (!user) throw new Error('Nicht angemeldet');

    const { data, error } = await supabase
      .from('categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    const updated = {
      ...data,
      is_hidden: data.is_hidden ?? false,
      sort_order: data.sort_order ?? 0,
    } as Category;
    
    setCategories(prev => prev.map(c => c.id === id ? updated : c));
    return updated;
  };

  const deleteCategory = async (id: string): Promise<void> => {
    if (!user) throw new Error('Nicht angemeldet');

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);

    setCategories(prev => prev.filter(c => c.id !== id));
  };

  return {
    categories,
    loading,
    error,
    fetchCategories,
    addCategory,
    updateCategory,
    deleteCategory,
  };
}
