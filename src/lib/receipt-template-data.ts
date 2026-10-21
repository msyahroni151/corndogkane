import "server-only";
import { getPrisma } from "@/lib/db";
import {
  parseReceiptSettings,
  defaultReceiptSettings,
  receiptKinds,
  type ReceiptKind,
  type ReceiptTemplateRecord,
} from "@/lib/receipt-templates";
export async function loadReceiptTemplates(): Promise<ReceiptTemplateRecord[]> {
  const rows = await getPrisma().receiptTemplate.findMany();
  return rows
    .filter((row) => receiptKinds.includes(row.kind as ReceiptKind))
    .map((row) => {
      let settings;
      try {
        settings = parseReceiptSettings(row.settings);
      } catch {
        settings = defaultReceiptSettings(row.kind as ReceiptKind);
      }
      return { scope: row.scope, kind: row.kind as ReceiptKind, revision: row.revision, settings };
    });
}
