/**
 * Single implementation of "Beleg löschen", shared by the app (useReceiptCrud) and MCP (delete_receipt).
 * Unmarks receipts that referenced this one as duplicate original, deletes the row, then removes the file.
 */
// deno-lint-ignore no-explicit-any
export async function deleteReceiptAndFile(sb: any, userId: string, id: string, fileUrl: string | null): Promise<{ storageError?: string }> {
  await sb
    .from("receipts")
    .update({ is_duplicate: false, duplicate_of: null, duplicate_score: null, duplicate_checked_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("duplicate_of", id);

  const { error: dbError } = await sb.from("receipts").delete().eq("id", id).eq("user_id", userId);
  if (dbError) throw new Error(`Fehler beim Löschen: ${dbError.message}`);

  if (fileUrl) {
    const { error: storageError } = await sb.storage.from("receipts").remove([fileUrl]);
    if (storageError) return { storageError: storageError.message };
  }
  return {};
}
