import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { loadReceiptTemplates } from "@/lib/receipt-template-data";
import { ReceiptTemplateEditor } from "@/components/receipt-template-editor";
export default async function Page() {
  await requireAccess("template-struk");
  const [records, outlets] = await Promise.all([
    loadReceiptTemplates(),
    getPrisma().outlet.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return (
    <ReceiptTemplateEditor
      records={records}
      outlets={outlets}
      sampleDate={new Date().toISOString()}
    />
  );
}
