import { supabase } from '@/integrations/supabase/client';
import { calculateSimilarity } from './vendorDuplicateService';

export interface MatchedVendor {
  id: string;
  user_id: string;
  display_name: string;
  legal_names: string[];
  detected_names: string[];
  default_category_id: string | null;
  default_vat_rate: number | null;
  default_category?: {
    id: string;
    name: string;
    color: string | null;
  } | null;
}

export interface VendorSuggestion {
  vendor: MatchedVendor;
  score: number;
  reasons: string[];
}

export interface FindOrCreateVendorResult {
  vendor: MatchedVendor | null;
  isNew: boolean;
  suggestions: VendorSuggestion[];
  needsUserDecision: boolean;
}

/**
 * Finds or creates a vendor based on a detected name
 * @param detectedName - The vendor name detected from receipt (AI or otherwise)
 * @param userId - The user's ID
 * @returns Matched or newly created vendor
 */
export async function matchOrCreateVendor(
  detectedName: string | null,
  userId: string
): Promise<MatchedVendor | null> {
  if (!detectedName || !userId) return null;

  const normalizedName = detectedName.trim().toLowerCase();
  if (!normalizedName) return null;

  try {
    // 1. Exact search in detected_names array
    const { data: exactMatches } = await supabase
      .from('vendors')
      .select(`
        *,
        default_category:categories(id, name, color)
      `)
      .eq('user_id', userId);

    // Check for exact match in detected_names
    const exactMatch = exactMatches?.find(v => 
      v.detected_names?.some((dn: string) => 
        dn.toLowerCase() === normalizedName
      )
    );

    if (exactMatch) {
      return mapVendor(exactMatch);
    }

    // 2. Check exact display_name match
    const displayNameMatch = exactMatches?.find(v =>
      v.display_name.toLowerCase() === normalizedName
    );

    if (displayNameMatch) {
      // Add to detected_names for faster future matching
      const updatedNames = [...(displayNameMatch.detected_names || [])];
      if (!updatedNames.map((n: string) => n.toLowerCase()).includes(normalizedName)) {
        updatedNames.push(detectedName.trim());
        await supabase
          .from('vendors')
          .update({ detected_names: updatedNames })
          .eq('id', displayNameMatch.id);
      }
      return mapVendor(displayNameMatch);
    }

    // 3. Fuzzy search - check if beginning of name matches
    const prefix = normalizedName.substring(0, Math.min(5, normalizedName.length));
    const similarMatch = exactMatches?.find(v =>
      v.display_name.toLowerCase().startsWith(prefix) ||
      v.detected_names?.some((dn: string) => dn.toLowerCase().startsWith(prefix))
    );

    if (similarMatch) {
      // Add the new detected name to the matched vendor
      const updatedNames = [...(similarMatch.detected_names || [])];
      if (!updatedNames.map((n: string) => n.toLowerCase()).includes(normalizedName)) {
        updatedNames.push(detectedName.trim());
        await supabase
          .from('vendors')
          .update({ detected_names: updatedNames })
          .eq('id', similarMatch.id);
      }
      return mapVendor(similarMatch);
    }

    // 4. No match found - create new vendor
    const { data: newVendor, error } = await supabase
      .from('vendors')
      .insert({
        user_id: userId,
        display_name: detectedName.trim(),
        detected_names: [detectedName.trim()],
      })
      .select(`
        *,
        default_category:categories(id, name, color)
      `)
      .single();

    if (error) {
      console.error('Error creating vendor:', error);
      return null;
    }

    return mapVendor(newVendor);
  } catch (error) {
    console.error('Error in matchOrCreateVendor:', error);
    return null;
  }
}

/**
 * Enhanced vendor matching with similarity scoring and user decision support
 * @param userId - The user's ID
 * @param detectedName - The vendor name detected from receipt
 * @param options - Configuration options
 * @returns Vendor match result with suggestions if needed
 */
export async function findOrCreateVendor(
  userId: string,
  detectedName: string,
  options?: {
    autoCreate?: boolean;
    minSimilarity?: number;
    legalName?: string;
  }
): Promise<FindOrCreateVendorResult> {
  const { autoCreate = false, minSimilarity = 60, legalName } = options || {};

  if (!detectedName || !userId) {
    return {
      vendor: null,
      isNew: false,
      suggestions: [],
      needsUserDecision: false
    };
  }

  const normalizedName = detectedName.trim().toLowerCase();

  try {
    // 1. Load all vendors for the user
    const { data: allVendors } = await supabase
      .from('vendors')
      .select(`
        *,
        default_category:categories(id, name, color)
      `)
      .eq('user_id', userId);

    if (!allVendors || allVendors.length === 0) {
      // No vendors exist - create new if autoCreate
      if (autoCreate) {
        const newVendor = await createVendorInternal(userId, detectedName, legalName);
        return {
          vendor: newVendor,
          isNew: true,
          suggestions: [],
          needsUserDecision: false
        };
      }
      return {
        vendor: null,
        isNew: true,
        suggestions: [],
        needsUserDecision: false
      };
    }

    // 2. Check for exact match in detected_names
    const exactMatch = allVendors.find(v =>
      v.detected_names?.some((dn: string) =>
        dn.toLowerCase() === normalizedName
      )
    );

    if (exactMatch) {
      return {
        vendor: mapVendor(exactMatch),
        isNew: false,
        suggestions: [],
        needsUserDecision: false
      };
    }

    // 3. Calculate similarity scores for all vendors
    const suggestions: VendorSuggestion[] = [];

    for (const vendor of allVendors) {
      // Display Name similarity
      const displaySim = calculateSimilarity(detectedName, vendor.display_name);

      // Detected Names similarity (find best match)
      let detectedSim = 0;
      for (const name of vendor.detected_names || []) {
        const sim = calculateSimilarity(detectedName, name);
        if (sim > detectedSim) detectedSim = sim;
      }

      // Legal Names similarity (find best match across all legal names)
      let legalSim = 0;
      for (const ln of vendor.legal_names || []) {
        const sim = calculateSimilarity(detectedName, ln);
        if (sim > legalSim) legalSim = sim;
      }

      // Take the highest similarity
      const bestScore = Math.max(displaySim, detectedSim, legalSim);

      if (bestScore >= minSimilarity) {
        const reasons: string[] = [];
        if (displaySim >= minSimilarity) reasons.push(`Ähnlicher Name (${displaySim}%)`);
        if (detectedSim >= minSimilarity) reasons.push('Bekannte Variante');
        if (legalSim >= minSimilarity) reasons.push('Ähnlicher Firmenname');

        suggestions.push({
          vendor: mapVendor(vendor),
          score: bestScore,
          reasons
        });
      }
    }

    // Sort by score descending
    suggestions.sort((a, b) => b.score - a.score);

    // 4. Decision logic
    if (suggestions.length > 0 && suggestions[0].score >= 90) {
      // Very high match - auto-assign and add variant
      const bestMatch = suggestions[0].vendor;

      await supabase
        .from('vendors')
        .update({
          detected_names: [...(bestMatch.detected_names || []), detectedName.trim()]
        })
        .eq('id', bestMatch.id);

      return {
        vendor: bestMatch,
        isNew: false,
        suggestions: [],
        needsUserDecision: false
      };
    }

    if (suggestions.length > 0 && suggestions[0].score >= minSimilarity) {
      // Medium match - ask user
      return {
        vendor: null,
        isNew: false,
        suggestions: suggestions.slice(0, 5), // Top 5
        needsUserDecision: true
      };
    }

    // No good matches - create new vendor
    if (autoCreate) {
      const newVendor = await createVendorInternal(userId, detectedName, legalName);
      return {
        vendor: newVendor,
        isNew: true,
        suggestions: [],
        needsUserDecision: false
      };
    }

    return {
      vendor: null,
      isNew: true,
      suggestions: [],
      needsUserDecision: false
    };

  } catch (error) {
    console.error('Error in findOrCreateVendor:', error);
    return {
      vendor: null,
      isNew: false,
      suggestions: [],
      needsUserDecision: false
    };
  }
}

/**
 * Create a new vendor internally
 */
async function createVendorInternal(
  userId: string,
  name: string,
  legalName?: string
): Promise<MatchedVendor | null> {
  const { data, error } = await supabase
    .from('vendors')
    .insert({
      user_id: userId,
      display_name: name.trim(),
      detected_names: [name.trim()],
      legal_name: legalName?.trim() || null
    })
    .select(`
      *,
      default_category:categories(id, name, color)
    `)
    .single();

  if (error) {
    console.error('Error creating vendor:', error);
    return null;
  }

  return mapVendor(data);
}

/**
 * Add a detected name variant to an existing vendor
 */
export async function addVendorVariant(vendorId: string, newName: string): Promise<void> {
  const { data: vendor } = await supabase
    .from('vendors')
    .select('detected_names')
    .eq('id', vendorId)
    .single();

  if (vendor) {
    const existingNames = vendor.detected_names || [];
    const normalizedNew = newName.trim().toLowerCase();
    
    // Only add if not already present
    if (!existingNames.some((n: string) => n.toLowerCase() === normalizedNew)) {
      await supabase
        .from('vendors')
        .update({
          detected_names: [...existingNames, newName.trim()]
        })
        .eq('id', vendorId);
    }
  }
}

/**
 * Finds an existing vendor by name (for autocomplete)
 * @param searchTerm - The search term
 * @param userId - The user's ID
 * @param limit - Maximum results to return
 * @returns Array of matching vendors
 */
export async function searchVendors(
  searchTerm: string,
  userId: string,
  limit: number = 5
): Promise<MatchedVendor[]> {
  if (!searchTerm || !userId) return [];

  const normalizedTerm = searchTerm.trim().toLowerCase();
  if (!normalizedTerm) return [];

  try {
    const { data: vendors } = await supabase
      .from('vendors')
      .select(`
        *,
        default_category:categories(id, name, color)
      `)
      .eq('user_id', userId);

    if (!vendors) return [];

    // Filter and score vendors
    const matches = vendors
      .map(v => {
        let score = 0;
        const displayLower = v.display_name.toLowerCase();
        const legalLower = v.legal_name?.toLowerCase() || '';
        const detectedLower = v.detected_names?.map((n: string) => n.toLowerCase()) || [];

        // Exact display_name match = highest score
        if (displayLower === normalizedTerm) score = 100;
        // Starts with = high score
        else if (displayLower.startsWith(normalizedTerm)) score = 80;
        // Contains = medium score
        else if (displayLower.includes(normalizedTerm)) score = 60;
        // Legal name match
        else if (legalLower.includes(normalizedTerm)) score = 50;
        // Detected names match
        else if (detectedLower.some((n: string) => n.includes(normalizedTerm))) score = 40;

        return { vendor: v, score };
      })
      .filter(m => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(m => mapVendor(m.vendor));

    return matches;
  } catch (error) {
    console.error('Error searching vendors:', error);
    return [];
  }
}

/**
 * Import unique vendor names from existing receipts
 * @param userId - The user's ID
 * @returns Number of vendors imported
 */
export async function importVendorsFromReceipts(userId: string): Promise<{
  imported: number;
  skipped: number;
}> {
  try {
    // Get all unique vendor names from receipts
    const { data: receipts, error: receiptsError } = await supabase
      .from('receipts')
      .select('vendor, vendor_brand')
      .eq('user_id', userId)
      .not('vendor', 'is', null);

    if (receiptsError) throw receiptsError;

    // Collect unique names
    const vendorNames = new Set<string>();
    receipts?.forEach(r => {
      if (r.vendor) vendorNames.add(r.vendor.trim());
      if (r.vendor_brand && r.vendor_brand !== r.vendor) {
        vendorNames.add(r.vendor_brand.trim());
      }
    });

    // Get existing vendors
    const { data: existingVendors, error: vendorsError } = await supabase
      .from('vendors')
      .select('display_name, detected_names')
      .eq('user_id', userId);

    if (vendorsError) throw vendorsError;

    // Build set of existing names (normalized)
    const existingNames = new Set<string>();
    existingVendors?.forEach(v => {
      existingNames.add(v.display_name.toLowerCase());
      v.detected_names?.forEach((n: string) => existingNames.add(n.toLowerCase()));
    });

    // Filter new vendors
    const newVendorNames = Array.from(vendorNames).filter(
      name => !existingNames.has(name.toLowerCase())
    );

    if (newVendorNames.length === 0) {
      return { imported: 0, skipped: vendorNames.size };
    }

    // Create new vendors
    const newVendors = newVendorNames.map(name => ({
      user_id: userId,
      display_name: name,
      detected_names: [name],
    }));

    const { error: insertError } = await supabase
      .from('vendors')
      .insert(newVendors);

    if (insertError) throw insertError;

    return {
      imported: newVendorNames.length,
      skipped: vendorNames.size - newVendorNames.length,
    };
  } catch (error) {
    console.error('Error importing vendors:', error);
    throw error;
  }
}

function mapVendor(data: any): MatchedVendor {
  return {
    id: data.id,
    user_id: data.user_id,
    display_name: data.display_name,
    legal_name: data.legal_name,
    detected_names: data.detected_names || [],
    default_category_id: data.default_category_id,
    default_vat_rate: data.default_vat_rate,
    default_category: data.default_category ? {
      id: data.default_category.id,
      name: data.default_category.name,
      color: data.default_category.color,
    } : null,
  };
}
