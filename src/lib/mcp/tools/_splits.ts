import type { SupabaseClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

export const SPLIT_PART_FIELDS =
  "id, receipt_id, sort_order, amount_gross, amount_net, vat_rate, vat_amount, category, tax_type, description, is_private";

type Rec = Record<string, unknown> & { id: string };
type Part = Record<string, unknown> & { id: string; receipt_id: string; sort_order: number };

/** Adds is_split_booking, split_parts and split_from_receipt_id to receipts. */
export async function withSplitInfo<T extends Rec>(sb: SupabaseClient, receipts: T[]) {
  if (receipts.length === 0) return { receipts: [] as T[], error: null };
  const ids = receipts.map((r) => r.id);
  const { data: meta, error: e1 } = await sb.from("receipts").select("id, is_split_booking, split_from_receipt_id").in("id", ids);
  if (e1) return { receipts: null, error: e1.message };
  const { data: parts, error: e2 } = await sb.from("receipt_split_lines").select(SPLIT_PART_FIELDS).in("receipt_id", ids).order("sort_order");
  if (e2) return { receipts: null, error: e2.message };
  const metaById = new Map((meta ?? []).map((m) => [m.id as string, m]));
  const partsBy = new Map<string, Part[]>();
  for (const p of (parts ?? []) as Part[]) {
    const list = partsBy.get(p.receipt_id) ?? [];
    list.push(p);
    partsBy.set(p.receipt_id, list);
  }
  return {
    receipts: receipts.map((r) => {
      const m = metaById.get(r.id);
      const isSplit = !!m?.is_split_booking;
      return {
        ...r,
        is_split_booking: isSplit,
        split_parts: isSplit
          ? (partsBy.get(r.id) ?? []).map(({ receipt_id: _r, ...p }) => p)
          : [],
        split_from_receipt_id: (m?.split_from_receipt_id as string | null) ?? null,
      };
    }),
    error: null,
  };
}

export async function currentUserId(sb: SupabaseClient, ctx: ToolContext): Promise<string | null> {
  const { data } = await sb.auth.getUser(ctx.getToken() ?? undefined);
  return data.user?.id ?? null;
}

export async function allowedCategoryNames(sb: SupabaseClient): Promise<string[]> {
  const { data } = await sb.from("categories").select("name").not("is_hidden", "is", true);
  return (data ?? []).map((c: { name: string }) => c.name);
}
