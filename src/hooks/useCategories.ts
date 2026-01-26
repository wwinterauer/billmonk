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
  created_at: string;
}

export function useCategories() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = async () => {
    if (!user) {
      setCategories([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('categories')
        .select('*')
        .order('is_system', { ascending: false })
        .order('name');

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setCategories((data || []) as Category[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Kategorien');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [user]);

  const addCategory = async (name: string, icon?: string, color?: string): Promise<Category> => {
    if (!user) throw new Error('Nicht angemeldet');

    const { data, error } = await supabase
      .from('categories')
      .insert({
        user_id: user.id,
        name,
        icon: icon || null,
        color: color || null,
        is_system: false,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    const newCategory = data as Category;
    setCategories(prev => [...prev, newCategory]);
    return newCategory;
  };

  const updateCategory = async (id: string, updates: Partial<Pick<Category, 'name' | 'icon' | 'color'>>): Promise<Category> => {
    if (!user) throw new Error('Nicht angemeldet');

    const { data, error } = await supabase
      .from('categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    const updated = data as Category;
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
