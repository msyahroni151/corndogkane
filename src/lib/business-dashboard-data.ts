import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { isPaymentAccount } from "@/lib/operational-expenses";
import { parseCivilDate } from "@/lib/placements";
import { rupiah } from "@/lib/money";
import { quantityLabel } from "@/lib/goods-receipts";
export type DashboardModule = {
  id: string;
  title: string;
  scope: string;
  href: string;
  rows: { label: string; value: string }[];
  note: string;
};
export type BusinessSnapshot = {
  modules: DashboardModule[];
  alerts: { label: string; detail: string; href: string }[];
  losses: Record<string, { count: number; value: number; unknown: number }>;
  canSeeLoss: boolean;
};
const rp = (n: number) => rupiah(Math.round(n));
export async function loadBusinessSnapshot(
  db: PrismaClient,
  permissions: readonly string[],
  from: string,
  to: string,
  outletIds: string[],
): Promise<BusinessSnapshot> {
  const result: BusinessSnapshot = {
    modules: [],
    alerts: [],
    losses: {},
    canSeeLoss: permissions.includes("control-stok"),
  };
  const can = (p: string) => permissions.includes(p),
    period = { gte: parseCivilDate(from), lte: parseCivilDate(to) };
  const jobs: Promise<void>[] = [];
  if (can("monitoring-outlet"))
    jobs.push(
      (async () => {
        const count = await db.outletOperation.count({
          where: { date: period, outletId: { in: outletIds }, salesPending: true },
        });
        if (count)
          result.alerts.push({
            label: "Sumber penjualan perlu dikonfirmasi",
            detail: count + " rekap memiliki sumber yang perlu direkonsiliasi.",
            href: "/admin-malam/monitoring-outlet",
          });
      })(),
    );
  if (can("stok-inventory"))
    jobs.push(
      (async () => {
        const items = await db.inventoryItem.findMany({
          where: { kind: { in: ["RAW", "SUB", "FINISHED"] } },
          select: {
            active: true,
            baseUnit: true,
            minimumStock: true,
            batches: { select: { baseUnit: true, remainingQuantity: true, remainingValue: true } },
          },
        });
        const total = items.reduce(
            (n, i) => n + i.batches.reduce((s, b) => s + Number(b.remainingValue), 0),
            0,
          ),
          low = items.filter(
            (i) =>
              i.active &&
              Number(i.minimumStock) > 0 &&
              i.batches
                .filter((b) => b.baseUnit === i.baseUnit)
                .reduce((n, b) => n + Number(b.remainingQuantity), 0) <= Number(i.minimumStock),
          ).length;
        result.modules.push({
          id: "stock",
          title: "Stok Gudang",
          scope: "Posisi saat ini · seluruh gudang",
          href: "/stok-inventory",
          rows: [
            { label: "Nilai persediaan tercatat", value: rp(total) },
            { label: "Jenis bahan aktif", value: String(items.filter((i) => i.active).length) },
            { label: "Di bawah stok minimum", value: String(low) },
          ],
          note: "Termasuk sisa produksi dan bahan di Sampah yang masih memiliki stok; tidak dijumlahkan ulang.",
        });
        if (low)
          result.alerts.push({
            label: "Stok gudang menipis",
            detail: low + " bahan berada pada / di bawah batas minimum.",
            href: "/stok-inventory",
          });
      })(),
    );
  if (can("control-stok"))
    jobs.push(
      (async () => {
        const begin = new Date(parseCivilDate(from).getTime() - 7 * 3600000),
          end = new Date(parseCivilDate(to).getTime() + 17 * 3600000);
        const [stocks, orders, losses, returns] = await Promise.all([
          db.outletStock.findMany({
            where: { outletId: { in: outletIds } },
            select: { value: true },
          }),
          db.outletStockOrder.groupBy({
            by: ["status"],
            where: { outletId: { in: outletIds }, status: { in: ["REQUESTED", "SENT"] } },
            _count: { _all: true },
          }),
          db.outletStockEvent.findMany({
            where: {
              outletId: { in: outletIds },
              kind: "LOSS",
              createdAt: { gte: begin, lt: end },
            },
            select: { outletId: true, valueBefore: true, valueAfter: true },
          }),
          db.stockReturn.findMany({
            where: {
              outletId: { in: outletIds },
              status: { in: ["REQUESTED", "APPROVED", "SENT", "PARTIAL"] },
            },
            select: { status: true },
          }),
        ]);
        for (const e of losses) {
          const row = (result.losses[e.outletId] ??= { count: 0, value: 0, unknown: 0 });
          row.count++;
          if (e.valueBefore === null || e.valueAfter === null) row.unknown++;
          else row.value += Math.max(0, Number(e.valueBefore) - Number(e.valueAfter));
        }
        const pending = orders.reduce((n, o) => n + o._count._all, 0),
          unknown = stocks.filter((s) => s.value === null).length;
        result.modules.push({
          id: "outletstock",
          title: "Control Stok Outlet",
          scope: "Stok saat ini · outlet terpilih",
          href: "/control-stok",
          rows: [
            {
              label: "Nilai stok yang diketahui",
              value: rp(stocks.reduce((n, s) => n + Number(s.value ?? 0), 0)),
            },
            { label: "Stok tanpa nilai perolehan", value: String(unknown) },
            { label: "Permintaan / pengiriman terbuka", value: String(pending) },
            { label: "Spoil tercatat dalam periode", value: losses.length + " catatan" },
            { label: "Retur terbuka saat ini", value: String(returns.length) },
            {
              label: "Retur dalam perjalanan",
              value: String(returns.filter((r) => ["SENT", "PARTIAL"].includes(r.status)).length),
            },
          ],
          note: "Spoil mengikuti tanggal pencatatan WIB. Nilai yang belum diketahui tidak dianggap nol; jurnal spoil belum otomatis.",
        });
        if (returns.length)
          result.alerts.push({
            label: "Retur Barang perlu diproses",
            detail: returns.length + " retur outlet belum selesai.",
            href: "/control-stok?tab=returns",
          });
        if (pending)
          result.alerts.push({
            label: "Pengiriman perlu ditindaklanjuti",
            detail: pending + " permintaan / pengiriman belum selesai.",
            href: "/control-stok?tab=requests",
          });
        if (unknown)
          result.alerts.push({
            label: "Nilai stok outlet belum lengkap",
            detail: unknown + " catatan stok belum memiliki nilai perolehan.",
            href: "/control-stok",
          });
      })(),
    );
  if (can("barang-masuk"))
    jobs.push(
      (async () => {
        const [periodRows, unpaid] = await Promise.all([
          db.goodsReceipt.aggregate({
            where: { date: period },
            _sum: { total: true },
            _count: { _all: true },
          }),
          db.goodsReceipt.aggregate({
            where: { paid: false },
            _sum: { total: true },
            _count: { _all: true },
          }),
        ]);
        result.modules.push({
          id: "purchase",
          title: "Pembelian & Supplier",
          scope: "Perusahaan · pembelian sesuai periode",
          href: "/barang-masuk",
          rows: [
            { label: "Nilai pembelian termasuk porter", value: rp(periodRows._sum.total ?? 0) },
            { label: "Transaksi pembelian", value: String(periodRows._count._all) },
            { label: "Tagihan belum dibayar saat ini", value: rp(unpaid._sum.total ?? 0) },
          ],
          note: "Pembelian adalah penerimaan persediaan; tidak otomatis menjadi HPP penjualan. Tagihan belum dibayar mencakup seluruh tanggal.",
        });
        if (unpaid._count._all)
          result.alerts.push({
            label: "Tagihan pembelian belum dibayar",
            detail: unpaid._count._all + " transaksi · " + rp(unpaid._sum.total ?? 0),
            href: "/barang-masuk?method=HUTANG",
          });
      })(),
    );
  if (can("produksi-gudang"))
    jobs.push(
      (async () => {
        const [operations, remainders] = await Promise.all([
          db.inventoryOperation.findMany({
            where: { kind: "PRODUCTION", date: period },
            select: {
              movements: {
                select: {
                  quantityBefore: true,
                  quantityAfter: true,
                  valueBefore: true,
                  valueAfter: true,
                  batch: { select: { baseUnit: true } },
                },
              },
            },
          }),
          db.productionRemainder.findMany({
            where: { stockBatch: { remainingQuantity: { gt: 0 } } },
            select: { stockBatch: { select: { remainingValue: true } } },
          }),
        ]);
        const quantities = new Map<string, number>();
        let value = 0;
        for (const o of operations)
          for (const m of o.movements) {
            const delta = Number(m.quantityAfter) - Number(m.quantityBefore);
            if (delta > 0) {
              quantities.set(m.batch.baseUnit, (quantities.get(m.batch.baseUnit) || 0) + delta);
              value += Number(m.valueAfter) - Number(m.valueBefore);
            }
          }
        result.modules.push({
          id: "production",
          title: "Produksi & Sisa Produksi",
          scope: "Gudang · produksi sesuai periode",
          href: "/produksi-gudang",
          rows: [
            { label: "Pencatatan produksi", value: String(operations.length) },
            {
              label: "Hasil produksi bruto",
              value:
                [...quantities].map(([u, n]) => quantityLabel(n, u)).join(" / ") ||
                "Belum ada produksi",
            },
            { label: "Nilai hasil produksi bruto", value: rp(value) },
            {
              label: "Nilai sisa tersedia saat ini",
              value: rp(remainders.reduce((n, r) => n + Number(r.stockBatch.remainingValue), 0)),
            },
          ],
          note: "Produksi memindahkan nilai bahan; bukan beban tambahan. Nilai bruto dapat mencakup sisa yang dipakai ulang. Sisa sudah termasuk stok gudang.",
        });
      })(),
    );
  if (can("finance-expenses"))
    jobs.push(
      (async () => {
        const rows = await db.operationalExpense.findMany({
          where: { date: period },
          select: { amount: true, status: true },
        });
        result.modules.push({
          id: "expense",
          title: "Pengeluaran Operasional",
          scope: "Perusahaan · sesuai periode",
          href: "/finance/pengeluaran-operasional",
          rows: [
            {
              label: "Total pengeluaran tercatat",
              value: rp(rows.reduce((n, r) => n + r.amount, 0)),
            },
            {
              label: "Sudah dibayar",
              value: rp(rows.filter((r) => r.status === "PAID").reduce((n, r) => n + r.amount, 0)),
            },
            {
              label: "Belum dibayar",
              value: rp(
                rows.filter((r) => r.status === "UNPAID").reduce((n, r) => n + r.amount, 0),
              ),
            },
          ],
          note: "Belum dialokasikan per outlet. Ditampilkan terpisah dari pengeluaran rekap untuk menghindari penghitungan ganda.",
        });
      })(),
    );
  if (can("master-akun") || can("finance-ledger") || can("open-transaction"))
    jobs.push(
      (async () => {
        const rows = await db.journalTransaction.findMany({
          where: { date: period },
          include: { sourceAccount: true, targetAccount: true },
        });
        let cash = 0,
          bank = 0;
        for (const r of rows)
          for (const [a, side] of [
            [r.sourceAccount, r.sourceSide],
            [r.targetAccount, r.sourceSide === "DEBIT" ? "CREDIT" : "DEBIT"],
          ] as const) {
            const sign = side === "DEBIT" ? 1 : -1;
            if (isPaymentAccount({ ...a, active: true }, "CASH")) cash += r.amount * sign;
            else if (isPaymentAccount({ ...a, active: true }, "BANK")) bank += r.amount * sign;
          }
        result.modules.push({
          id: "finance",
          title: "Kas, Bank & Jurnal",
          scope: "Perusahaan · mutasi jurnal sesuai periode",
          href: can("master-akun")
            ? "/finance/laporan-akuntansi"
            : can("finance-ledger")
              ? "/finance/finance-ledger"
              : "/open-transaction",
          rows: [
            { label: "Mutasi bersih kas dari jurnal", value: rp(cash) },
            { label: "Mutasi bersih bank dari jurnal", value: rp(bank) },
            { label: "Transaksi jurnal", value: String(rows.length) },
            { label: "Saldo kas / bank akhir", value: "Belum direkonsiliasi" },
          ],
          note: "Mutasi bukan saldo akhir. Saldo awal dan jurnal lengkap diperlukan. Transfer kas ke bank tidak dihitung sebagai pendapatan.",
        });
      })(),
    );
  if (can("karyawan"))
    jobs.push(
      (async () => {
        const n = await db.employee.count({ where: { active: true } });
        result.modules.push({
          id: "people",
          title: "Karyawan",
          scope: "Perusahaan · posisi saat ini",
          href: "/karyawan",
          rows: [{ label: "Karyawan aktif", value: String(n) }],
          note: "Penugasan outlet mengikuti jadwal HR. Pergantian crew tidak mengubah outlet pada rekap lama.",
        });
      })(),
    );
  if (can("absensi"))
    jobs.push(
      (async () => {
        const schedules = await db.schedule.findMany({
          where: { date: period, status: "KERJA", outletId: { in: outletIds } },
          select: { attendance: { select: { status: true } } },
        });
        const missing = schedules.filter((s) => !s.attendance).length;
        result.modules.push({
          id: "attendance",
          title: "Jadwal & Absensi",
          scope: "Outlet terpilih · sesuai periode",
          href: can("absensi") ? "/absensi" : "/jadwal",
          rows: [
            { label: "Penugasan kerja", value: String(schedules.length) },
            { label: "Absensi tercatat", value: String(schedules.length - missing) },
            { label: "Belum tercatat", value: String(missing) },
          ],
          note: "Jumlah penugasan, bukan jumlah orang unik. Absensi belum diisi tidak otomatis dianggap alpa.",
        });
        if (missing)
          result.alerts.push({
            label: "Absensi belum lengkap",
            detail: missing + " penugasan kerja belum memiliki catatan absensi.",
            href: can("absensi") ? "/absensi" : "/jadwal",
          });
      })(),
    );
  if (can("jadwal") && !can("absensi"))
    jobs.push(
      (async () => {
        const count = await db.schedule.count({
          where: { date: period, status: "KERJA", outletId: { in: outletIds } },
        });
        result.modules.push({
          id: "attendance",
          title: "Jadwal",
          scope: "Outlet terpilih · sesuai periode",
          href: "/jadwal",
          rows: [{ label: "Penugasan kerja", value: String(count) }],
          note: "Ringkasan absensi memerlukan hak akses Absensi.",
        });
      })(),
    );
  if (can("payroll"))
    jobs.push(
      (async () => {
        const rows = await db.payroll.findMany({
          where: {
            status: { not: "CANCELLED" },
            startDate: { lte: period.lte },
            endDate: { gte: period.gte },
          },
          select: { startDate: true, endDate: true, netPay: true, status: true },
        });
        const full = rows.filter((r) => r.startDate >= period.gte && r.endDate <= period.lte);
        result.modules.push({
          id: "payroll",
          title: "Payroll",
          scope: "Perusahaan · periode gaji di dalam filter",
          href: "/payroll",
          rows: [
            { label: "Gaji bersih terproses", value: rp(full.reduce((n, r) => n + r.netPay, 0)) },
            {
              label: "Gaji bersih berstatus dibayar",
              value: rp(full.filter((r) => r.status === "PAID").reduce((n, r) => n + r.netPay, 0)),
            },
            {
              label: "Draft payroll",
              value: String(full.filter((r) => r.status === "DRAFT").length),
            },
          ],
          note: `Hanya periode payroll yang sepenuhnya berada dalam filter; ${rows.length - full.length} periode tumpang tindih belum dialokasikan. Nilai bersih bukan total beban gaji akuntansi.`,
        });
      })(),
    );
  if (can("kasbon"))
    jobs.push(
      (async () => {
        const rows = await db.moneyEntry.groupBy({
          by: ["kind"],
          where: { status: "APPROVED", kind: { in: ["LOAN", "REPAYMENT"] } },
          _sum: { amount: true },
        });
        const loan = rows.find((r) => r.kind === "LOAN")?._sum.amount ?? 0,
          paid = rows.find((r) => r.kind === "REPAYMENT")?._sum.amount ?? 0;
        const pending = await db.moneyEntry.count({ where: { kind: "LOAN", status: "PENDING" } });
        result.modules.push({
          id: "loans",
          title: "Kasbon Karyawan",
          scope: "Perusahaan · posisi saat ini",
          href: "/kasbon",
          rows: [
            { label: "Kasbon disetujui dikurangi pembayaran", value: rp(loan - paid) },
            { label: "Pengajuan menunggu keputusan", value: String(pending) },
          ],
          note: "Kasbon adalah piutang karyawan; pencairan kasbon tidak dihitung sebagai beban gaji.",
        });
      })(),
    );
  if (can("finance-assets"))
    jobs.push(
      (async () => {
        const rows = await db.fixedAsset.findMany({
          select: { acquisitionCost: true, condition: true },
        });
        result.modules.push({
          id: "assets",
          title: "Aset Tetap",
          scope: "Perusahaan · daftar aset saat ini",
          href: "/finance/aset-tetap",
          rows: [
            { label: "Aset terdaftar", value: String(rows.length) },
            {
              label: "Nilai perolehan yang diketahui",
              value: rp(rows.reduce((n, r) => n + Number(r.acquisitionCost ?? 0), 0)),
            },
            {
              label: "Nilai perolehan belum diisi",
              value: String(rows.filter((r) => r.acquisitionCost === null).length),
            },
            {
              label: "Kondisi selain baik",
              value: String(rows.filter((r) => r.condition !== "BAIK").length),
            },
          ],
          note: "Daftar aset fisik, bukan nilai buku neraca. Penyusutan belum dihitung sebagai beban dashboard.",
        });
      })(),
    );
  if (can("setting-menu") || can("pos"))
    jobs.push(
      (async () => {
        const rows = await db.inventoryItem.findMany({
          where: { kind: "PRODUCT", active: true },
          select: { _count: { select: { recipe: true } } },
        });
        const transactions = await db.saleTransaction.count({
          where: { date: period, outletId: { in: outletIds } },
        });
        result.modules.push({
          id: "sales",
          title: "Penjualan & Kasir",
          scope: "Kesiapan POS · posisi saat ini",
          href: can("setting-menu") ? "/setting-menu" : "/pos",
          rows: [
            { label: "Menu jual aktif", value: String(rows.length) },
            { label: "Transaksi tersimpan dalam periode", value: String(transactions) },
            {
              label: "Menu belum memiliki resep",
              value: String(rows.filter((r) => !r._count.recipe).length),
            },
            {
              label: "Sumber transaksi",
              value: "POS + tambahan manual + rekap total terkonfirmasi",
            },
          ],
          note: "Omzet memakai rekap kanonis yang sama dengan Monitoring Outlet. HPP dan laba masih menunggu perhitungan laporan lengkap.",
        });
      })(),
    );
  if (can("finance-budgeting"))
    result.modules.push({
      id: "budget",
      title: "Budgeting & RAB",
      scope: "Perusahaan",
      href: "/finance/budgeting-rab",
      rows: [{ label: "Target vs realisasi", value: "Belum tersedia" }],
      note: "Anggaran dan pemetaan realisasi perlu dilengkapi sebelum pencapaian target dapat dihitung.",
    });
  if (can("supplier") || can("pelanggan"))
    jobs.push(
      (async () => {
        const values: { label: string; value: string }[] = [];
        if (can("supplier"))
          values.push({
            label: "Supplier terdaftar",
            value: String(await db.partner.count({ where: { kind: "SUPPLIER" } })),
          });
        if (can("pelanggan"))
          values.push({
            label: "Pelanggan terdaftar",
            value: String(await db.partner.count({ where: { kind: "CUSTOMER" } })),
          });
        result.modules.push({
          id: "relations",
          title: "Supplier & Pelanggan",
          scope: "Perusahaan · posisi saat ini",
          href: can("supplier") ? "/supplier" : "/pelanggan",
          rows: values,
          note: "Data master relasi. Frekuensi belanja dan pelanggan berulang menunggu transaksi POS yang terhubung.",
        });
      })(),
    );
  if (can("portal-review"))
    jobs.push(
      (async () => {
        const count = await db.portalLeave.count({ where: { status: "PENDING" } });
        result.modules.push({
          id: "portal",
          title: "Portal Karyawan",
          scope: "Perusahaan · pengajuan saat ini",
          href: "/portal-karyawan/persetujuan",
          rows: [{ label: "Pengajuan cuti / libur menunggu keputusan", value: String(count) }],
          note: "Ringkasan gaji dan kasbon tersedia di kartu Payroll dan Kasbon. Detail pengajuan mengikuti hak akses persetujuan.",
        });
        if (count)
          result.alerts.push({
            label: "Pengajuan karyawan menunggu keputusan",
            detail: count + " pengajuan cuti / libur belum diputuskan.",
            href: "/portal-karyawan/persetujuan",
          });
      })(),
    );
  if (can("bonus"))
    jobs.push(
      (async () => {
        const rows = await db.moneyEntry.groupBy({
          by: ["kind"],
          where: {
            date: period,
            status: "APPROVED",
            kind: { in: ["BONUS_EARNED", "BONUS_WITHDRAWAL"] },
          },
          _sum: { amount: true },
        });
        result.modules.push({
          id: "bonus",
          title: "Bonus Karyawan",
          scope: "Perusahaan · sesuai periode",
          href: "/bonus",
          rows: [
            {
              label: "Bonus diperoleh dan disetujui",
              value: rp(rows.find((r) => r.kind === "BONUS_EARNED")?._sum.amount ?? 0),
            },
            {
              label: "Bonus dicairkan dan disetujui",
              value: rp(rows.find((r) => r.kind === "BONUS_WITHDRAWAL")?._sum.amount ?? 0),
            },
          ],
          note: "Hak bonus dan pencairan adalah dua hal berbeda. Nilai tidak ditambahkan kembali ke payroll atau beban dashboard.",
        });
      })(),
    );
  await Promise.all(jobs);
  const order = [
    "finance",
    "expense",
    "stock",
    "outletstock",
    "purchase",
    "production",
    "people",
    "attendance",
    "payroll",
    "loans",
    "assets",
    "sales",
    "budget",
    "relations",
    "portal",
    "bonus",
  ];
  result.modules.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  return result;
}
