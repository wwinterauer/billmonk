import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { FieldDefaultsStats, FieldDefaults, FieldSuggestionsDismissed } from './useVendors';

const TRACKED_FIELDS = ['payment_method', 'category', 'tax_type', 'tax_rate'] as const;
type TrackedField = typeof TRACKED_FIELDS[number];

const SUGGESTION_THRESHOLD = 3;

export interface FieldSuggestion {
  field: TrackedField;
  value: string;
  count: number;
  vendorName: string;
  vendorId: string;
}

/**
 * Hook for tracking vendor field defaults and providing suggestions.
 */
export function useVendorFieldDefaults() {
  const { user } = useAuth();

  /**
   * Track a field value change for a vendor. Increments the counter in field_defaults_stats.
   */
  const trackFieldChange = useCallback(async (
    vendorId: string,
    field: TrackedField,
    value: string
  ) => {
    if (!user || !vendorId || !value) return;

    try {
      // Load current stats
      const { data: vendor, error } = await supabase
        .from('vendors')
        .select('field_defaults_stats')
        .eq('id', vendorId)
        .single();

      if (error || !vendor) return;

      const stats = (vendor.field_defaults_stats as FieldDefaultsStats) || {};
      const fieldStats = stats[field] || {};
      fieldStats[value] = (fieldStats[value] || 0) + 1;
      stats[field] = fieldStats;

      await supabase
        .from('vendors')
        .update({ field_defaults_stats: stats })
        .eq('id', vendorId);
    } catch (err) {
      console.error('Error tracking field change:', err);
    }
  }, [user]);

  /**
   * Check if there are any pending suggestions for a vendor.
   */
  const getSuggestions = useCallback(async (
    vendorId: string,
    vendorName: string
  ): Promise<FieldSuggestion[]> => {
    if (!user || !vendorId) return [];

    try {
      const { data: vendor, error } = await supabase
        .from('vendors')
        .select('field_defaults_stats, field_defaults, field_suggestions_dismissed')
        .eq('id', vendorId)
        .single();

      if (error || !vendor) return [];

      const stats = (vendor.field_defaults_stats as FieldDefaultsStats) || {};
      const defaults = (vendor.field_defaults as FieldDefaults) || {};
      const dismissed = (vendor.field_suggestions_dismissed as FieldSuggestionsDismissed) || {};

      const suggestions: FieldSuggestion[] = [];

      for (const field of TRACKED_FIELDS) {
        // Skip if already has a default for this field
        if (defaults[field]) continue;

        const fieldStats = stats[field];
        if (!fieldStats) continue;

        // Find the most common value
        let maxValue = '';
        let maxCount = 0;
        for (const [val, count] of Object.entries(fieldStats)) {
          if (count > maxCount) {
            maxCount = count;
            maxValue = val;
          }
        }

        // Check threshold and not dismissed
        if (maxCount >= SUGGESTION_THRESHOLD && maxValue) {
          const dismissedValues = dismissed[field] || [];
          if (!dismissedValues.includes(maxValue)) {
            suggestions.push({
              field,
              value: maxValue,
              count: maxCount,
              vendorName,
              vendorId,
            });
          }
        }
      }

      return suggestions;
    } catch (err) {
      console.error('Error getting suggestions:', err);
      return [];
    }
  }, [user]);

  /**
   * Accept a suggestion: save the value as a field default.
   */
  const acceptSuggestion = useCallback(async (
    vendorId: string,
    field: TrackedField,
    value: string
  ) => {
    if (!user || !vendorId) return;

    try {
      const { data: vendor, error } = await supabase
        .from('vendors')
        .select('field_defaults')
        .eq('id', vendorId)
        .single();

      if (error || !vendor) return;

      const defaults = (vendor.field_defaults as FieldDefaults) || {};
      defaults[field] = value;

      await supabase
        .from('vendors')
        .update({ field_defaults: defaults })
        .eq('id', vendorId);
    } catch (err) {
      console.error('Error accepting suggestion:', err);
    }
  }, [user]);

  /**
   * Dismiss a suggestion: save it so it won't be shown again.
   */
  const dismissSuggestion = useCallback(async (
    vendorId: string,
    field: TrackedField,
    value: string
  ) => {
    if (!user || !vendorId) return;

    try {
      const { data: vendor, error } = await supabase
        .from('vendors')
        .select('field_suggestions_dismissed')
        .eq('id', vendorId)
        .single();

      if (error || !vendor) return;

      const dismissed = (vendor.field_suggestions_dismissed as FieldSuggestionsDismissed) || {};
      const fieldDismissed = dismissed[field] || [];
      if (!fieldDismissed.includes(value)) {
        fieldDismissed.push(value);
      }
      dismissed[field] = fieldDismissed;

      await supabase
        .from('vendors')
        .update({ field_suggestions_dismissed: dismissed })
        .eq('id', vendorId);
    } catch (err) {
      console.error('Error dismissing suggestion:', err);
    }
  }, [user]);

  /**
   * Get field defaults for a vendor to pre-fill a receipt.
   */
  const getFieldDefaults = useCallback(async (
    vendorId: string
  ): Promise<FieldDefaults> => {
    if (!user || !vendorId) return {};

    try {
      const { data: vendor, error } = await supabase
        .from('vendors')
        .select('field_defaults')
        .eq('id', vendorId)
        .single();

      if (error || !vendor) return {};
      return (vendor.field_defaults as FieldDefaults) || {};
    } catch {
      return {};
    }
  }, [user]);

  return {
    trackFieldChange,
    getSuggestions,
    acceptSuggestion,
    dismissSuggestion,
    getFieldDefaults,
    TRACKED_FIELDS,
  };
}
