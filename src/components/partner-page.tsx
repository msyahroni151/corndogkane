import SearchForm from "next/form";
import { SortableTable } from "@/components/sortable-table";
import Link from "next/link";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { rupiah } from "@/lib/money";
import { FormDialog } from "@/components/form-dialog";
import { PartnerForm } from "@/components/partner-form";
import { UiIcon, type IconName } from "@/components/ui-icon";
import type { PartnerKind, Prisma } from "@/generated/prisma/client";
export type PartnerFilters = { q?: string; status?: string; sort?: string; saved?: string };
export async function PartnerPage({
  kind,
  searchParams,
}: {
  kind: PartnerKind;
  searchParams: Promise<PartnerFilters>;
}) {
  await requireAccess(kind === "SUPPLIER" ? "supplier" : "pelanggan");
  const query = await searchParams,
    db = getPrisma(),
    supplier = kind === "SUPPLIER",
    route = supplier ? "/supplier" : "/pelanggan";
  const q = typeof query.q === "string" ? query.q.trim().slice(0, 100) : "",
    status = supplier && ["debt", "paid"].includes(query.status || "") ? query.status! : "all",
    sort = ["name", "name_desc", "city", ...(supplier ? ["debt_desc", "debt_asc"] : [])].includes(
      query.sort || "",
    )
      ? query.sort!
      : supplier
        ? "debt_desc"
        : "name";
  const base: Prisma.PartnerWhereInput = {
    kind,
    ...(q
      ? {
          OR: ["name", "city", "businessType", "contactPerson", "phone"].map((field) => ({
            [field]: { contains: q, mode: "insensitive" as const },
          })),
        }
      : {}),
  };
  const where: Prisma.PartnerWhereInput = {
    ...base,
    ...(status === "debt"
      ? { outstandingDebt: { gt: 0 } }
      : status === "paid"
        ? { outstandingDebt: 0 }
        : {}),
  };
  const orderBy: Prisma.PartnerOrderByWithRelationInput[] =
    supplier && sort === "debt_desc"
      ? [{ outstandingDebt: "desc" }, { name: "asc" }]
      : supplier && sort === "debt_asc"
        ? [{ outstandingDebt: "asc" }, { name: "asc" }]
        : sort === "city"
          ? [{ city: "asc" }, { name: "asc" }]
          : [{ name: sort === "name_desc" ? "desc" : "asc" }];
  const [rows, total, withDebt, aggregate, count, matching, matchingDebt, contactCount, cities] =
    await Promise.all([
      db.partner.findMany({ where, orderBy, take: 500 }),
      db.partner.count({ where: { kind } }),
      supplier ? db.partner.count({ where: { kind, outstandingDebt: { gt: 0 } } }) : 0,
      supplier ? db.partner.aggregate({ where: { kind }, _sum: { outstandingDebt: true } }) : null,
      db.partner.count({ where }),
      db.partner.count({ where: base }),
      supplier ? db.partner.count({ where: { ...base, outstandingDebt: { gt: 0 } } }) : 0,
      !supplier ? db.partner.count({ where: { kind, phone: { not: null } } }) : 0,
      !supplier
        ? db.partner.findMany({
            where: { kind, city: { not: null } },
            select: { city: true },
            distinct: ["city"],
          })
        : [],
    ]);
  const stats: { label: string; value: string; icon: IconName; tone: string }[] = supplier
    ? [
        {
          label: "Total Supplier",
          value: String(total),
          icon: "people",
          tone: "bg-blue-50 text-blue-600",
        },
        {
          label: "Ada Hutang",
          value: String(withDebt),
          icon: "alert",
          tone: "bg-amber-50 text-amber-600",
        },
        {
          label: "Total Hutang Kami",
          value: rupiah(aggregate?._sum.outstandingDebt || 0),
          icon: "wallet",
          tone: "bg-red-50 text-red-600",
        },
      ]
    : [
        {
          label: "Total Pelanggan",
          value: String(total),
          icon: "people",
          tone: "bg-blue-50 text-blue-600",
        },
        {
          label: "Dengan No. HP",
          value: String(contactCount),
          icon: "check",
          tone: "bg-emerald-50 text-emerald-600",
        },
        {
          label: "Kota Terdata",
          value: String(cities.length),
          icon: "location",
          tone: "bg-amber-50 text-amber-600",
        },
      ];
  function url(nextStatus: string) {
    const p = new URLSearchParams({ ...(q ? { q } : {}), sort, status: nextStatus });
    return route + "?" + p.toString();
  }
  const successRoute = url(status) + "&saved=1";
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <FormDialog
          title={supplier ? "Tambah Supplier Baru" : "Tambah Pelanggan"}
          trigger="+ Tambah"
          subtitle={supplier ? "Daftarkan pemasok baru" : undefined}
        >
          <PartnerForm kind={kind} successRoute={successRoute} />
        </FormDialog>
      </div>
      {query.saved && (
        <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Data berhasil disimpan.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <section key={s.label} className="panel flex items-center gap-3 p-4">
            <span className={`rounded-xl p-2.5 ${s.tone}`}>
              <UiIcon name={s.icon} size={18} />
            </span>
            <div>
              <p className="text-lg font-bold">{s.value}</p>
              <p className="mt-1 text-[10px] text-slate-500">{s.label}</p>
            </div>
          </section>
        ))}
      </div>
      <SearchForm action="" prefetch={false} scroll={false} className="flex flex-wrap gap-2">
        <input
          name="q"
          aria-label="Cari relasi"
          placeholder="Cari nama, kota, atau jenis usaha…"
          defaultValue={q}
          maxLength={100}
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs outline-none focus:border-emerald-500"
        />
        <input name="status" type="hidden" value={status} />
        <select
          name="sort"
          aria-label="Urutkan relasi"
          defaultValue={sort}
          className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs text-slate-600"
        >
          {supplier && (
            <>
              <option value="debt_desc">Hutang Terbesar</option>
              <option value="debt_asc">Hutang Terkecil</option>
            </>
          )}
          <option value="name">Nama A–Z</option>
          <option value="name_desc">Nama Z–A</option>
          <option value="city">Kota</option>
        </select>
        <button className="button-secondary">Cari</button>
      </SearchForm>
      {supplier && (
        <nav aria-label="Filter supplier" className="flex flex-wrap gap-2">
          {[
            { key: "all", label: "Semua", n: matching, icon: "people" },
            { key: "debt", label: "Ada Hutang", n: matchingDebt, icon: "alert" },
            { key: "paid", label: "Lunas", n: matching - matchingDebt, icon: "check" },
          ].map((tab) => (
            <Link
              key={tab.key}
              href={url(tab.key)}
              prefetch={false}
              aria-current={status === tab.key ? "page" : undefined}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${status === tab.key ? "border-[#335c48] bg-[#335c48] text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-emerald-50"}`}
            >
              <UiIcon name={tab.icon as IconName} size={14} />
              {tab.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] ${status === tab.key ? "bg-white/15" : "bg-slate-100"}`}
              >
                {tab.n}
              </span>
            </Link>
          ))}
        </nav>
      )}
      <section className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <SortableTable className="w-full text-left text-xs">
            <thead>
              <tr>
                <th className="w-full px-5 py-3">{supplier ? "SUPPLIER" : "PELANGGAN"}</th>
                <th className="whitespace-nowrap px-5 py-3">{supplier ? "STATUS" : "KOTA"}</th>
                <th className="whitespace-nowrap px-5 py-3">{supplier ? "HUTANG" : "KONTAK"}</th>
                <th className="px-5 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="min-w-[230px] px-5 py-4" data-sort-value={p.name}>
                    <p className="font-semibold">{p.name}</p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {[p.businessType, p.city].filter(Boolean).join(" · ") || p.id}
                    </p>
                    {supplier && (p.contactPerson || p.phone) && (
                      <p className="mt-1 text-[10px] text-slate-500">
                        {[p.contactPerson, p.phone].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4">
                    {supplier ? (
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${p.outstandingDebt > 0 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}
                      >
                        {p.outstandingDebt > 0 ? "Ada Hutang" : "Lunas"}
                      </span>
                    ) : (
                      p.city || "—"
                    )}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 font-semibold">
                    {supplier ? rupiah(p.outstandingDebt) : p.phone || p.contactPerson || "—"}
                  </td>
                  <td className="px-5 py-4">
                    <FormDialog
                      title={supplier ? "Edit Supplier" : "Edit Pelanggan"}
                      trigger="Edit"
                    >
                      <PartnerForm
                        kind={kind}
                        successRoute={successRoute}
                        initial={{
                          id: p.id,
                          version: p.updatedAt.toISOString(),
                          name: p.name,
                          defaultPaymentMethod: p.defaultPaymentMethod,
                          city: p.city || "",
                          businessType: p.businessType || "",
                          contactPerson: p.contactPerson || "",
                          phone: p.phone || "",
                          address: p.address || "",
                          notes: p.notes || "",
                          outstandingDebt: String(p.outstandingDebt),
                        }}
                      />
                    </FormDialog>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={4}>
                    <div className="flex min-h-[230px] flex-col items-center justify-center px-5 py-12 text-center">
                      <span className="mb-3 text-slate-300">
                        <UiIcon name="people" size={32} />
                      </span>
                      <h2 className="text-sm font-semibold text-slate-500">
                        Tidak ada {supplier ? "supplier" : "pelanggan"} ditemukan
                      </h2>
                      <p className="mt-2 text-xs text-slate-400">
                        {q || status !== "all"
                          ? "Coba ubah kata kunci atau filter."
                          : "Klik Tambah untuk mencatat relasi baru."}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </SortableTable>
        </div>
        <p className="border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-xs text-slate-500">
          {count ? `${count} ${supplier ? "supplier" : "pelanggan"}` : "Tidak ada data"}
          {count > 500 ? " · menampilkan 500 pertama" : ""}
        </p>
      </section>
    </div>
  );
}
