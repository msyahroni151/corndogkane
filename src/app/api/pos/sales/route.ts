import { sameOrigin } from "@/lib/request-origin";
import { currentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getPrisma } from "@/lib/db";
import { parseSaleInput, SaleError } from "@/lib/sale-input";
import { postSale } from "@/lib/sale-service";
import { revalidatePath } from "next/cache";
export async function POST(request: Request) {
  const json = (data: unknown, status = 200) =>
      Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } }),
    user = await currentUser();
  if (!user) return json({ error: "Silakan masuk kembali." }, 401);
  if (!hasPermission(user, "pos")) return json({ error: "Akses ditolak." }, 403);
  if (!sameOrigin(request)) return json({ error: "Permintaan tidak diizinkan." }, 403);
  try {
    const raw = await request.text();
    if (raw.length > 30000) throw new SaleError("Data terlalu besar.");
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new SaleError("Data tidak valid.");
    }
    const receipt = await postSale(
      getPrisma(),
      { id: user.id, name: user.name, canManage: hasPermission(user, "monitoring-outlet") },
      parseSaleInput(body),
    );
    for (const path of [
      "/menu-utama/dashboard",
      "/admin-malam/monitoring-outlet",
      "/control-stok",
      "/finance/laporan-akuntansi",
    ])
      revalidatePath(path);
    return json({ receipt });
  } catch (error) {
    return json(
      {
        error:
          error instanceof SaleError
            ? error.message
            : "Transaksi belum dapat dikonfirmasi. Jangan buat transaksi baru; coba ulang pembayaran yang sama.",
      },
      error instanceof SaleError ? (error.message.startsWith("Kunci transaksi") ? 409 : 400) : 500,
    );
  }
}

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Silakan masuk kembali." }, { status: 401 });
  if (!hasPermission(user, "pos"))
    return Response.json({ error: "Akses ditolak." }, { status: 403 });
  const params = new URL(request.url).searchParams,
    id = params.get("id"),
    key = params.get("key");
  const sale = await getPrisma().saleTransaction.findFirst({
    where: {
      ...(id ? { id } : key ? { postingKey: key } : { id: "NONE" }),
      ...(!hasPermission(user, "monitoring-outlet") ? { createdById: user.id } : {}),
    },
    include: { lines: true, outlet: { select: { name: true } } },
  });
  if (!sale) return Response.json({ error: "Transaksi tidak ditemukan." }, { status: 404 });
  return Response.json(
    {
      receipt: {
        id: sale.id,
        dateISO: sale.createdAt.toISOString(),
        outletId: sale.outletId,
        outlet: sale.outlet.name,
        cashier: sale.cashierName,
        crew: sale.crewName,
        source: sale.source,
        method: sale.method,
        total: sale.total,
        received: sale.received,
        preview: false,
        stockPending: sale.lines.filter((l) => !l.stockApplied).length,
        items: sale.lines.map((l) => ({
          name: l.productName,
          quantity: l.quantity,
          price: l.unitPrice,
        })),
      },
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
