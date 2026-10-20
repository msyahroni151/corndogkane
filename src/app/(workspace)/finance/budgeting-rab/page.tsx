import { requireAccess } from "@/lib/auth";
export default async function BudgetPage() {
  await requireAccess("finance-budgeting");
  return (
    <section className="panel p-6">
      <h2 className="font-semibold">Budgeting & RAB</h2>
      <p className="mt-3 text-sm leading-6 text-slate-500">
        Menu anggaran sudah disiapkan. Format RAB, periode anggaran, serta alur persetujuan belum
        dikonfigurasi.
      </p>
    </section>
  );
}
