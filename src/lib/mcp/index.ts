import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listReceiptsTool from "./tools/list-receipts";
import expenseSummaryTool from "./tools/expense-summary";
import listVendorsTool from "./tools/list-vendors";
import getReviewQueueTool from "./tools/get-review-queue";
import getReceiptDocumentTool from "./tools/get-receipt-document";
import updateReceiptTool from "./tools/update-receipt";
import approveReceiptTool from "./tools/approve-receipt";
import listBankTransactionsTool from "./tools/list-bank-transactions";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "billmonk",
  title: "BillMonk",
  version: "0.2.0",
  instructions:
    "Tools for BillMonk, a private expense management app. Review workflow: call get_review_queue, then get_receipt_document for each receipt to compare the original file with the extracted data, fix mistakes with update_receipt, and call approve_receipt only when the user asks. Prefer expense_summary for totals.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listReceiptsTool,
    expenseSummaryTool,
    listVendorsTool,
    getReviewQueueTool,
    getReceiptDocumentTool,
    updateReceiptTool,
    approveReceiptTool,
    listBankTransactionsTool,
  ],
});
