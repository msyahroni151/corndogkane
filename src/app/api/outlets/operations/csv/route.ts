import { hasAction } from "@/lib/permission-actions";
import { sameOrigin } from "@/lib/request-origin";
import { boundedJsonText, RequestBodyError } from "@/lib/request-body";
import { currentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/db";
import { parseCivilDate } from "@/lib/placements";
import {
  encodeCsv,
  salesCsvTemplate,
  salesExportHeaders,
  salesExportValues,
} from "@/lib/outlet-sales-csv";
import { canImportOutletCrew, operationalProducts, snapshotItems } from "@/lib/outlet-operations";
import { prepareSalesImport, importSalesCsv } from "@/lib/outlet-sales-csv-service";
import { InputError } from "@/lib/outlet-operation-write";
import { revalidatePath } from "next/cache";
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
async function access() {
  const user = await currentUser();
  if (!user) return json({ error: "Silakan masuk kembali." }, 401);
  if (!hasPermission(user, "monitoring-outlet")) return json({ error: "Akses ditolak." }, 403);
  return user;
}
function download(csv: string, name: string) {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export async function GET(request: Request) {
  const user = await access();
  if (user instanceof Response) return user;
  const query = new URL(request.url).searchParams,
    db = getPrisma();
  if (query.get("mode") === "template")
    return download(salesCsvTemplate(), "template-penjualan-outlet.csv");
  if (query.get("mode") === "references") {
    const [outlets, crew] = await Promise.all([
      db.outlet.findMany({
        where: { active: true, closed: false, area: { active: true } },
        orderBy: { name: "asc" },
        select: { id: true, name: true, nameCode: true },
      }),
      db.employee.findMany({
        orderBy: { fullName: "asc" },
        select: {
          id: true,
          employeeCode: true,
          fullName: true,
          active: true,
          position: true,
          department: true,
        },
      }),
    ]);
    return download(
      encodeCsv([
        ["jenis", "id", "kode", "nama", "status"],
        ...outlets.map((o) => ["OUTLET", o.id, o.nameCode, o.name, "Aktif"]),
        ...crew
          .filter(canImportOutletCrew)
          .map((e) => ["CREW", e.id, e.employeeCode, e.fullName, e.active ? "Aktif" : "Nonaktif"]),
      ]),
      "referensi-outlet-crew.csv",
    );
  }
  if (!hasAction(user, "monitoring-outlet", "export"))
    return json({ error: "Izin ekspor ditolak." }, 403);
  try {
    const start = query.get("start") || "",
      end = query.get("end") || "",
      from = parseCivilDate(start),
      to = parseCivilDate(end),
      area = query.get("area") || "",
      search = query.get("search")?.trim() || "";
    if (to < from || to.getTime() - from.getTime() > 365 * 86400000)
      throw new InputError("Pilih rentang tanggal maksimal 366 hari.");
    const where = {
      date: { gte: from, lte: to },
      outlet: {
        ...(area ? { areaId: area } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" as const } },
                { nameCode: { contains: search, mode: "insensitive" as const } },
                { area: { name: { contains: search, mode: "insensitive" as const } } },
              ],
            }
          : {}),
      },
    };
    const entries = await db.outletOperation.findMany({
      where,
      orderBy: [{ date: "asc" }, { outletName: "asc" }],
      take: 10001,
      include: {
        outlet: { select: { name: true } },
        crew: { select: { employeeCode: true } },
      },
    });
    const closures = await db.outletDailyStatus.findMany({
      where: { ...where, closed: true },
      include: { outlet: { select: { name: true } } },
      take: 10001,
    });
    if (entries.length + closures.length > 10000)
      throw new InputError("Lebih dari 10.000 baris. Persempit rentang ekspor.");
    const data = entries.map((row) => {
      const items = snapshotItems(row.items);
      return salesExportValues({
        tanggal: row.date.toISOString().slice(0, 10),
        nama_outlet: row.outlet.name,
        nama_crew: row.crew.employeeCode?.trim() || "",
        crew_training: row.trainingCrewName,
        adonan_terpakai: row.doughUsed,
        ...Object.fromEntries(
          operationalProducts.flatMap((p) => [
            [p.key, items[p.key].quantity],
            ["harga_" + p.key, items[p.key].unitPrice],
          ]),
        ),
        qris: row.qris,
        gofood: row.gofood,
        grabfood: row.grabfood,
        shopeefood: row.shopeefood,
        pengeluaran: row.expenseAmount,
        keterangan_pengeluaran: row.expenseNotes,
        setoran_tunai: row.cashReceived,
        total_penjualan: row.totalGross,
        sumber_penjualan: row.salesSource,
        status_operasional: "BUKA",
      });
    });
    const closedRows = closures.map((row) =>
      salesExportValues({
        tanggal: row.date.toISOString().slice(0, 10),
        nama_outlet: row.outlet.name,
        nama_crew: "",
        status_operasional: "TUTUP",
        keterangan_operasional: row.notes,
        ...Object.fromEntries(operationalProducts.map((p) => [p.key, 0])),
        total_penjualan: 0,
        sumber_penjualan: "MANUAL",
      }),
    );
    const combined = [...data, ...closedRows].sort(
      (a, b) =>
        String(a[0]).localeCompare(String(b[0])) || String(a[1]).localeCompare(String(b[1])),
    );
    return download(
      encodeCsv([salesExportHeaders, ...combined]),
      `penjualan-outlet-${start}-${end}.csv`,
    );
  } catch (error) {
    if (error instanceof RequestBodyError)
      return Response.json({ error: error.message }, { status: error.status });
    return json(
      {
        error:
          error instanceof InputError
            ? error.message
            : "Ekspor belum berhasil. Periksa rentang tanggal dan koneksi.",
      },
      400,
    );
  }
}
export async function POST(request: Request) {
  const user = await access();
  if (user instanceof Response) return user;
  if (!sameOrigin(request)) return json({ error: "Permintaan tidak diizinkan." }, 403);
  if (!hasAction(user, "monitoring-outlet", "create"))
    return Response.json({ error: "Izin aksi ditolak." }, { status: 403 });
  try {
    const raw = await boundedJsonText(request, 2500000);
    if (raw.length > 2_100_000) throw new InputError("File CSV maksimal 2 MB.");
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new InputError("Permintaan tidak valid.");
    }
    if (typeof body?.csv !== "string") throw new InputError("Pilih file CSV.");
    if (body.action !== "preview" && body.action !== "import")
      throw new InputError("Aksi tidak valid.");
    if (body.action === "preview") {
      let plan;
      try {
        plan = await prepareSalesImport(getPrisma(), body.csv);
      } catch (error) {
        if (error instanceof RequestBodyError)
          return Response.json({ error: error.message }, { status: error.status });
        throw new InputError(error instanceof Error ? error.message : "CSV tidak valid.");
      }
      return json({
        preview: plan.preview,
        errors: plan.errors,
        newRows: plan.fresh.length,
        skipped: plan.skipped,
        total: plan.fresh.reduce((sum, row) => sum + row.totalGross, 0),
      });
    }
    if (body.confirmed !== true) throw new InputError("Periksa pratinjau lalu konfirmasi impor.");
    const result = await importSalesCsv(body.csv, user.id);
    for (const path of [
      "/admin-malam/monitoring-outlet",
      "/menu-utama/dashboard",
      "/bonus",
      "/payroll",
      "/rekap-saldo",
      "/selisih-setor",
      "/finance/laporan-akuntansi",
    ])
      revalidatePath(path);
    return json(result);
  } catch (error) {
    if (error instanceof RequestBodyError)
      return Response.json({ error: error.message }, { status: error.status });
    if (!(error instanceof InputError)) {
      const code = error instanceof Error && "code" in error ? String(error.code) : "UNKNOWN";
      console.error(
        JSON.stringify({
          event: "outlet_csv_import_failed",
          code: /^P[0-9]{4}$/.test(code) ? code : "UNKNOWN",
        }),
      );
    }
    return json(
      {
        error:
          error instanceof InputError
            ? error.message
            : error instanceof Error && "code" in error && error.code === "P2028"
              ? "Impor melewati batas waktu. Seluruh baris baru dibatalkan dan data lama tidak berubah. Coba kembali setelah koneksi stabil."
              : "CSV belum tersimpan. Seluruh baris baru dibatalkan; periksa data dan coba kembali.",
      },
      error instanceof InputError ? error.status : 500,
    );
  }
}
