import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { fail, ok } from "./_shared";

export default defineTool({
  name: "approve_receipt",
  title: "Approve receipt",
  description: "Approve a receipt that is in review. Only call this when the user asked to approve it.",
  inputSchema: { id: z.string().uuid().describe("Receipt id.") },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    if (!ctx.isAuthenticated()) return fail("Not authenticated");
    const { data, error } = await supabaseForUser(ctx)
      .from("receipts").update({ status: "approved" }).eq("id", id).eq("status", "review")
      .select("id, vendor, amount_gross, receipt_date").maybeSingle();
    if (error) return fail(error.message);
    if (!data) return fail("Receipt not found or not in review.");
    return ok(`Approved ${data.vendor ?? "receipt"} (${data.amount_gross ?? "?"}).`, { receipt: JSON.parse(JSON.stringify(data)) });
  },
});
