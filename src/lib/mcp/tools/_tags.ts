import { sortTagNames } from "../../tagOrder";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ReceiptRecord = Record<string, unknown> & { id: string };

type ReceiptTagLink = {
  receipt_id: string;
  tag: { name: string } | Array<{ name: string }> | null;
};

export function mergeReceiptTagNames(receipts: ReceiptRecord[], links: ReceiptTagLink[]) {
  const namesByReceipt = new Map<string, Set<string>>();
  for (const link of links) {
    const tag = Array.isArray(link.tag) ? link.tag[0] : link.tag;
    if (!tag?.name) continue;
    const names = namesByReceipt.get(link.receipt_id) ?? new Set<string>();
    names.add(tag.name);
    namesByReceipt.set(link.receipt_id, names);
  }

  return receipts.map((receipt) => ({
    ...receipt,
    tags: sortTagNames([...(namesByReceipt.get(receipt.id) ?? [])]),
  }));
}

export async function withReceiptTagNames(sb: SupabaseClient, receipts: ReceiptRecord[]) {
  if (receipts.length === 0) return { receipts: [], error: null };
  const { data, error } = await sb
    .from("receipt_tags")
    .select("receipt_id, tag:tags(name)")
    .in("receipt_id", receipts.map((receipt) => receipt.id));
  if (error) return { receipts: null, error: error.message };
  return {
    receipts: mergeReceiptTagNames(receipts, (data ?? []) as ReceiptTagLink[]),
    error: null,
  };
}

export function resolveTagIds(requestedNames: string[], existingTags: Array<{ id: string; name: string }>) {
  const idsByName = new Map(existingTags.map((tag) => [tag.name, tag.id]));
  const unknown = [...new Set(requestedNames.filter((name) => !idsByName.has(name)))];
  if (unknown.length > 0) {
    return {
      ok: false as const,
      error: `Unknown tag name(s): ${unknown.join(", ")}. No changes were made. Use list_tags to see the available names.`,
    };
  }
  return {
    ok: true as const,
    tagIds: [...new Set(requestedNames.map((name) => idsByName.get(name)!))],
  };
}

export function planTagAssignmentChanges(currentTagIds: string[], desiredTagIds: string[]) {
  const current = new Set(currentTagIds);
  const desired = new Set(desiredTagIds);
  return {
    upsertTagIds: [...desired].filter((tagId) => !current.has(tagId)),
    deleteTagIds: [...current].filter((tagId) => !desired.has(tagId)),
  };
}

export function flattenTagCounts(rows: Array<{
  id: string;
  name: string;
  color: string;
  is_active: boolean | null;
  receipt_tags: Array<{ count: number }>;
}>) {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    is_active: row.is_active,
    receipt_count: row.receipt_tags[0]?.count ?? 0,
  }));
}
