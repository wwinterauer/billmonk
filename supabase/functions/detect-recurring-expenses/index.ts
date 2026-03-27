import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Receipt {
  id: string;
  vendor: string | null;
  vendor_id: string | null;
  description: string | null;
  notes: string | null;
  amount_gross: number | null;
  receipt_date: string | null;
  category: string | null;
}

interface RecurringPattern {
  vendor_name: string;
  category: string | null;
  average_amount: number;
  frequency: 'monthly' | 'quarterly' | 'semi_annual' | 'annual';
  last_seen_date: string;
  next_expected_date: string;
  confidence: number;
  matched_description: string;
  receipt_ids: string[];
}

function extractKeywords(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-zäöüß0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);
}

function keywordSimilarity(a: string | null, b: string | null): number {
  const kw1 = extractKeywords(a || '');
  const kw2 = extractKeywords(b || '');
  if (kw1.length === 0 && kw2.length === 0) return 0;
  if (kw1.length === 0 || kw2.length === 0) return 0;
  const set1 = new Set(kw1);
  const set2 = new Set(kw2);
  let overlap = 0;
  for (const w of set1) if (set2.has(w)) overlap++;
  const union = new Set([...set1, ...set2]).size;
  return union > 0 ? overlap / union : 0;
}

function detectFrequency(daysGaps: number[]): { frequency: 'monthly' | 'quarterly' | 'semi_annual' | 'annual'; score: number } | null {
  if (daysGaps.length === 0) return null;
  const _avgGap = daysGaps.reduce((a, b) => a + b, 0) / daysGaps.length;

  const patterns: { freq: 'monthly' | 'quarterly' | 'semi_annual' | 'annual'; target: number; tolerance: number }[] = [
    { freq: 'monthly', target: 30, tolerance: 5 },
    { freq: 'quarterly', target: 90, tolerance: 10 },
    { freq: 'semi_annual', target: 180, tolerance: 15 },
    { freq: 'annual', target: 365, tolerance: 30 },
  ];

  let best: { frequency: 'monthly' | 'quarterly' | 'semi_annual' | 'annual'; score: number } | null = null;

  for (const p of patterns) {
    const deviations = daysGaps.map(g => Math.abs(g - p.target));
    const avgDev = deviations.reduce((a, b) => a + b, 0) / deviations.length;
    if (avgDev <= p.tolerance * 2) {
      const score = Math.max(0, 1 - avgDev / (p.tolerance * 2));
      if (!best || score > best.score) {
        best = { frequency: p.freq, score };
      }
    }
  }

  return best;
}

function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

const freqDays: Record<string, number> = {
  monthly: 30,
  quarterly: 90,
  semi_annual: 180,
  annual: 365,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let userId: string | null = null;
    const authHeader = req.headers.get('Authorization');

    if (authHeader) {
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      userId = user?.id || null;
    }

    if (!userId) {
      try {
        const body = await req.json();
        userId = body.user_id || null;
      } catch { /* ignore */ }
    }

    const userIds: string[] = [];
    if (userId) {
      userIds.push(userId);
    } else {
      const { data: profiles } = await supabase.from('profiles').select('id');
      if (profiles) userIds.push(...profiles.map((p: any) => p.id));
    }

    let totalDetected = 0;

    for (const uid of userIds) {
      const { data: receipts, error: rErr } = await supabase
        .from('receipts')
        .select('id, vendor, vendor_id, description, notes, amount_gross, receipt_date, category')
        .eq('user_id', uid)
        .in('status', ['approved', 'completed', 'review'])
        .not('receipt_date', 'is', null)
        .not('vendor', 'is', null)
        .order('receipt_date', { ascending: true });

      if (rErr || !receipts || receipts.length < 2) continue;

      const vendorGroups: Record<string, Receipt[]> = {};
      for (const r of receipts) {
        const key = (r.vendor || '').trim().toLowerCase();
        if (!key) continue;
        if (!vendorGroups[key]) vendorGroups[key] = [];
        vendorGroups[key].push(r as Receipt);
      }

      const patterns: RecurringPattern[] = [];

      for (const [vendorKey, group] of Object.entries(vendorGroups)) {
        if (group.length < 2) continue;

        const amountGroups: Receipt[][] = [];
        const used = new Set<number>();

        for (let i = 0; i < group.length; i++) {
          if (used.has(i)) continue;
          const cluster: Receipt[] = [group[i]];
          used.add(i);
          const baseAmt = group[i].amount_gross || 0;

          for (let j = i + 1; j < group.length; j++) {
            if (used.has(j)) continue;
            const amt = group[j].amount_gross || 0;
            if (baseAmt === 0 && amt === 0) {
              cluster.push(group[j]);
              used.add(j);
            } else if (baseAmt > 0) {
              const diff = Math.abs(amt - baseAmt) / baseAmt;
              if (diff <= 0.15) {
                cluster.push(group[j]);
                used.add(j);
              }
            }
          }
          if (cluster.length >= 2) amountGroups.push(cluster);
        }

        for (const cluster of amountGroups) {
          cluster.sort((a, b) => new Date(a.receipt_date!).getTime() - new Date(b.receipt_date!).getTime());

          const gaps: number[] = [];
          for (let i = 1; i < cluster.length; i++) {
            const d1 = new Date(cluster[i - 1].receipt_date!).getTime();
            const d2 = new Date(cluster[i].receipt_date!).getTime();
            gaps.push(Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
          }

          const freqResult = detectFrequency(gaps);
          if (!freqResult) continue;

          const descriptions = cluster.map(r => r.description || r.notes || '');
          let descSim = 0;
          let descCount = 0;
          for (let i = 0; i < descriptions.length; i++) {
            for (let j = i + 1; j < descriptions.length; j++) {
              descSim += keywordSimilarity(descriptions[i], descriptions[j]);
              descCount++;
            }
          }
          const avgDescSim = descCount > 0 ? descSim / descCount : 0;

          const amounts = cluster.map(r => r.amount_gross || 0).filter(a => a > 0);
          const avgAmt = amounts.length > 0 ? amounts.reduce((a, b) => a + b, 0) / amounts.length : 0;
          let amtConsistency = 1;
          if (avgAmt > 0 && amounts.length > 1) {
            const maxDev = Math.max(...amounts.map(a => Math.abs(a - avgAmt) / avgAmt));
            amtConsistency = Math.max(0, 1 - maxDev);
          }

          const countBonus = Math.min(1, (cluster.length - 1) / 3);
          const confidence = (
            freqResult.score * 0.35 +
            amtConsistency * 0.25 +
            avgDescSim * 0.15 +
            countBonus * 0.25
          );

          if (confidence < 0.5) continue;

          const lastDate = cluster[cluster.length - 1].receipt_date!;
          const nextDate = addDaysToDate(lastDate, freqDays[freqResult.frequency]);

          const descFreq: Record<string, number> = {};
          for (const d of descriptions) {
            const trimmed = d.trim();
            if (trimmed) descFreq[trimmed] = (descFreq[trimmed] || 0) + 1;
          }
          const matchedDesc = Object.entries(descFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

          patterns.push({
            vendor_name: cluster[0].vendor || vendorKey,
            category: cluster[0].category,
            average_amount: Math.round(avgAmt * 100) / 100,
            frequency: freqResult.frequency,
            last_seen_date: lastDate,
            next_expected_date: nextDate,
            confidence: Math.round(confidence * 100) / 100,
            matched_description: matchedDesc,
            receipt_ids: cluster.map(r => r.id),
          });
        }
      }

      const { data: existing } = await supabase
        .from('recurring_expenses')
        .select('id, vendor_name, matched_description, status')
        .eq('user_id', uid);

      const existingMap = new Map(
        (existing || []).map((e: any) => [`${e.vendor_name.toLowerCase()}|${(e.matched_description || '').toLowerCase()}`, e])
      );

      for (const p of patterns) {
        const key = `${p.vendor_name.toLowerCase()}|${p.matched_description.toLowerCase()}`;
        const ex = existingMap.get(key);

        if (ex) {
          if (ex.status === 'dismissed' || ex.status === 'confirmed') {
            await supabase
              .from('recurring_expenses')
              .update({
                average_amount: p.average_amount,
                last_seen_date: p.last_seen_date,
                next_expected_date: p.next_expected_date,
                confidence: p.confidence,
                frequency: p.frequency,
                updated_at: new Date().toISOString(),
              })
              .eq('id', ex.id);
          } else {
            await supabase
              .from('recurring_expenses')
              .update({
                average_amount: p.average_amount,
                frequency: p.frequency,
                last_seen_date: p.last_seen_date,
                next_expected_date: p.next_expected_date,
                confidence: p.confidence,
                updated_at: new Date().toISOString(),
              })
              .eq('id', ex.id);
          }

          for (const rid of p.receipt_ids) {
            await supabase
              .from('recurring_expense_entries')
              .upsert({ recurring_expense_id: ex.id, expense_id: rid }, { onConflict: 'recurring_expense_id,expense_id' });
          }
        } else {
          let categoryId = null;
          if (p.category) {
            const { data: cat } = await supabase
              .from('categories')
              .select('id')
              .eq('name', p.category)
              .or(`user_id.eq.${uid},is_system.eq.true`)
              .limit(1)
              .single();
            categoryId = cat?.id || null;
          }

          const { data: inserted } = await supabase
            .from('recurring_expenses')
            .insert({
              user_id: uid,
              vendor_name: p.vendor_name,
              category_id: categoryId,
              average_amount: p.average_amount,
              frequency: p.frequency,
              last_seen_date: p.last_seen_date,
              next_expected_date: p.next_expected_date,
              confidence: p.confidence,
              status: 'detected',
              matched_description: p.matched_description,
            })
            .select('id')
            .single();

          if (inserted) {
            for (const rid of p.receipt_ids) {
              await supabase
                .from('recurring_expense_entries')
                .insert({ recurring_expense_id: inserted.id, expense_id: rid });
            }
          }

          totalDetected++;
        }
      }
    }

    return new Response(JSON.stringify({ success: true, detected: totalDetected }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error detecting recurring expenses:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
