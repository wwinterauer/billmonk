import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { user_id, vendor_name, category, country, pattern_type, vat_rate } = body;

    if (!user_id || !category) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Check if platform learning is active
    const { data: settings } = await supabase
      .from('platform_learning_settings')
      .select('is_active, verification_threshold, auto_verify')
      .eq('id', 1)
      .single();

    if (!settings?.is_active) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "Platform learning disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Check if user has opted out
    const { data: profile } = await supabase
      .from('profiles')
      .select('community_opt_out, plan')
      .eq('id', user_id)
      .single();

    if (profile?.community_opt_out && profile?.plan !== 'free') {
      return new Response(
        JSON.stringify({ skipped: true, reason: "User opted out" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Normalize vendor name
    const vendorNormalized = vendor_name
      ? vendor_name.toLowerCase().trim().replace(/\s+/g, ' ')
      : null;

    const type = pattern_type || 'vendor_category';

    // 4. Find existing pattern
    let query = supabase
      .from('community_patterns')
      .select('id, contributor_count, total_confirmations, is_rejected')
      .eq('pattern_type', type)
      .eq('suggested_category', category);

    if (vendorNormalized) {
      query = query.eq('vendor_name_normalized', vendorNormalized);
    }
    if (country) {
      query = query.eq('country', country);
    }

    const { data: existing } = await query.maybeSingle();

    // Skip if pattern was rejected by admin
    if (existing?.is_rejected) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "Pattern rejected by admin" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let patternId: string;

    if (existing) {
      // Check if this user already contributed
      const { data: existingContrib } = await supabase
        .from('community_contributions')
        .select('id')
        .eq('user_id', user_id)
        .eq('pattern_id', existing.id)
        .maybeSingle();

      const isNewContributor = !existingContrib;

      // Update pattern
      const updates: Record<string, unknown> = {
        total_confirmations: existing.total_confirmations + 1,
        updated_at: new Date().toISOString(),
      };

      if (isNewContributor) {
        updates.contributor_count = existing.contributor_count + 1;

        // Check auto-verify threshold
        if (settings.auto_verify && (existing.contributor_count + 1) >= settings.verification_threshold) {
          updates.is_verified = true;
        }
      }

      await supabase
        .from('community_patterns')
        .update(updates)
        .eq('id', existing.id);

      patternId = existing.id;

      // Insert contribution if new
      if (isNewContributor) {
        await supabase
          .from('community_contributions')
          .insert({ user_id, pattern_id: existing.id });
      }
    } else {
      // Create new pattern
      const newPattern: Record<string, unknown> = {
        pattern_type: type,
        vendor_name_normalized: vendorNormalized,
        suggested_category: category,
        country: country || null,
        contributor_count: 1,
        total_confirmations: 1,
        is_verified: settings.auto_verify && settings.verification_threshold <= 1,
      };

      if (vat_rate !== undefined && vat_rate !== null) {
        newPattern.suggested_vat_rate = vat_rate;
      }

      const { data: inserted, error } = await supabase
        .from('community_patterns')
        .insert(newPattern)
        .select('id')
        .single();

      if (error) throw error;
      patternId = inserted.id;

      // Insert contribution
      await supabase
        .from('community_contributions')
        .insert({ user_id, pattern_id: patternId });
    }

    return new Response(
      JSON.stringify({ success: true, pattern_id: patternId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error aggregating community pattern:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
