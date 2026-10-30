import { Prisma } from "@/generated/prisma/client";
import { SaleError } from "@/lib/sale-input";
import { operationalCash } from "@/lib/outlet-operations";
export type SalesAmounts = {
  totalGross: number;
  qris: number;
  gofood: number;
  grabfood: number;
  shopeefood: number;
};
export function salesAmounts(value: unknown): SalesAmounts | null {
  if (!value || typeof value !== "object") return null;
  const b = value as Record<string, unknown>;
  if (
    !["totalGross", "qris", "gofood", "grabfood", "shopeefood"].every(
      (k) => Number.isSafeInteger(b[k]) && Number(b[k]) >= 0,
    )
  )
    return null;
  return {
    totalGross: Number(b.totalGross),
    qris: Number(b.qris),
    gofood: Number(b.gofood),
    grabfood: Number(b.grabfood),
    shopeefood: Number(b.shopeefood),
  };
}
export async function refreshDailySales(
  tx: Prisma.TransactionClient,
  id: string,
  actorId: string,
  confirmation?: { choice: "POS" | "MANUAL"; notes: string },
) {
  const day = await tx.outletOperation.findUniqueOrThrow({
    where: { id },
    include: { _count: { select: { sales: true } } },
  });
  const groups = await tx.saleTransaction.groupBy({
    by: ["source", "method"],
    where: { operationId: id },
    _sum: { total: true },
  });
  const ledger: SalesAmounts = { totalGross: 0, qris: 0, gofood: 0, grabfood: 0, shopeefood: 0 };
  let posGross = 0,
    additionalGross = 0;
  const stockPending = await tx.saleLine.count({
    where: { stockApplied: false, sale: { operationId: id } },
  });
  for (const s of groups) {
    const total = s._sum.total || 0;
    ledger.totalGross += total;
    if (s.source === "POS") posGross += total;
    else additionalGross += total;
    const key = (
      {
        QRIS: "qris",
        GoFood: "gofood",
        "Grab Food": "grabfood",
        "Shopee Food": "shopeefood",
      } as const
    )[s.method as "QRIS" | "GoFood" | "Grab Food" | "Shopee Food"];
    if (key) ledger[key] += total;
  }
  if (ledger.totalGross > 2000000000)
    throw new SaleError("Total penjualan satu hari melewati batas pencatatan.");
  const manual = day.hasManual ? salesAmounts(day.manualSales) || salesAmounts(day) : null;
  if (confirmation?.choice === "MANUAL" && !manual)
    throw new SaleError("Belum ada rekap total manual untuk dipilih.");
  if (confirmation?.choice === "POS" && !day._count.sales)
    throw new SaleError("Belum ada transaksi POS atau tambahan manual.");
  const approved = await tx.settlementReview.findFirst({
    where: { operationId: id, status: "APPROVED" },
  });
  const confirmed =
    !!confirmation || (day.reconciledRevision === day.salesRevision && !!day.salesChoice);
  const choice = confirmation?.choice || day.salesChoice;
  const changedLedger = (Object.keys(ledger) as (keyof SalesAmounts)[]).some(
    (k) => ledger[k] !== day[k],
  );
  const conflict =
    !!(manual && day._count.sales) ||
    ((!!approved || day.bonusAmount !== null || day.cashReceived !== null) &&
      day._count.sales > 0 &&
      changedLedger);
  const salesPending = conflict && !confirmed;
  const selected = salesPending
    ? salesAmounts(day)!
    : choice === "MANUAL" && manual
      ? manual
      : day._count.sales
        ? ledger
        : manual || salesAmounts(day)!;
  if (
    approved &&
    (approved.expectedCash !== operationalCash({ ...selected, expenseAmount: day.expenseAmount }) ||
      approved.receivedCash !== day.cashReceived)
  )
    throw new SaleError(
      "Selisih setoran sudah disetujui. Periksa persetujuan tersebut sebelum mengubah angka final.",
    );
  const salesSource = salesPending
    ? "REVIEW"
    : choice === "MANUAL" && manual
      ? "MANUAL"
      : day._count.sales
        ? posGross && additionalGross
          ? "POS_MANUAL_ADD"
          : posGross
            ? "POS"
            : "MANUAL_ADD"
        : "MANUAL";
  const saved = await tx.outletOperation.update({
    where: { id },
    data: {
      ...selected,
      posGross,
      additionalGross,
      stockPending,
      salesSource,
      salesPending,
      updatedById: actorId,
      ...(confirmation
        ? { salesChoice: confirmation.choice, reconciledRevision: day.salesRevision }
        : {}),
    },
  });
  if (confirmation)
    await tx.salesDecision.create({
      data: {
        operationId: id,
        actorId,
        choice: confirmation.choice,
        revision: day.salesRevision,
        notes: confirmation.notes,
        snapshot: { before: salesAmounts(day), ledger, manual, selected } as Prisma.InputJsonValue,
      },
    });
  return saved;
}
