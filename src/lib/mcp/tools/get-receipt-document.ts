import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { RECEIPT_FIELDS, fail, mimeFor, toBase64 } from "./_shared";

const MAX_BYTES = 8 * 1024 * 1024;

export default defineTool({
  name: "get_receipt_document",
  title: "Get receipt with original file",
  description:
    "Return one receipt's extracted data plus the original PDF or image, so it can be checked against the document.",
  inputSchema: { id: z.string().uuid().describe("Receipt id.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    if (!ctx.isAuthenticated()) return fail("Not authenticated");
    const sb = supabaseForUser(ctx);
    const { data: r, error } = await sb.from("receipts").select(`${RECEIPT_FIELDS}, file_url`).eq("id", id).maybeSingle();
    if (error) return fail(error.message);
    if (!r) return fail("Receipt not found.");
    const { file_url, ...fields } = r as Record<string, unknown> & { file_url: string | null };
    const text = { type: "text" as const, text: JSON.stringify(fields, null, 2) };
    if (!file_url) return { content: [text, { type: "text" as const, text: "No original file stored." }] };

    const { data: blob, error: dlErr } = await sb.storage.from("receipts").download(file_url);
    if (dlErr || !blob) return { content: [text, { type: "text" as const, text: `File could not be loaded: ${dlErr?.message ?? "unknown"}` }] };
    if (blob.size > MAX_BYTES) {
      return { content: [text, { type: "text" as const, text: `File is too large to attach (${Math.round(blob.size / 1024 / 1024)} MB). Check it in the app.` }] };
    }
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const mimeType = mimeFor(fields.file_type as string | null, fields.file_name as string | null);
    const data = toBase64(bytes);
    const fileContent = mimeType.startsWith("image/")
      ? { type: "image" as const, data, mimeType }
      : { type: "resource" as const, resource: { uri: `billmonk://receipts/${id}`, mimeType, blob: data } };
    return { content: [text, fileContent] };
  },
});
