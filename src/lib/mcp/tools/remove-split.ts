import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { fail, ok } from "./_shared";
import { removeSplitBooking } from "../../splitBooking";

export default defineTool({
  name: "remove_split",
  title: "Undo split booking",
  description: "Same as 'Splitbuchung aufheben' in the app: deletes all split parts so the receipt is booked as one again. Never changes the receipt status.",
  inputSchema: { id: z.string().uuid().describe("Receipt id.") },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    if (!ctx.isAuthenticated()) return fail("Not authenticated");
    const sb = supabaseForUser(ctx);
    const { data: r, error } = await sb.from("receipts").select("id").eq("id", id).maybeSingle();
    if (error) return fail(error.message);
    if (!r) return fail("Receipt not found.");
    try { await removeSplitBooking(sb, id); } catch (e) { return fail((e as Error).message ?? "Failed"); }
    return ok("Split booking removed.", { id, is_split_booking: false });
  },
});
