import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listReceiptsTool from "./tools/list-receipts";
import expenseSummaryTool from "./tools/expense-summary";
import listInvoicesTool from "./tools/list-invoices";
import listVendorsTool from "./tools/list-vendors";
import listCustomersTool from "./tools/list-customers";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "billmonk",
  title: "BillMonk",
  version: "0.1.0",
  instructions:
    "Tools for BillMonk, a document management and accounting automation app. Read the signed-in user's receipts, expense summaries, outgoing invoices, vendors and customers. All amounts are stored gross/net/VAT per receipt; prefer `expense_summary` for aggregated reporting over summing `list_receipts` yourself.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listReceiptsTool, expenseSummaryTool, listInvoicesTool, listVendorsTool, listCustomersTool],
});
