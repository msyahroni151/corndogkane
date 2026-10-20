"use server";
import { dateFromDisplay } from "@/lib/local-date";
import { allocateBusinessId } from "@/lib/business-id";
import { createHash } from "node:crypto";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { parseCivilDate } from "@/lib/placements";
import { attendanceSummary } from "@/lib/attendance";
import { payrollLines } from "@/lib/payroll";
import { validateSettlementPayments } from "@/lib/settlements";
import { validateLedger } from "@/lib/money";
import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/form-state";
import type { Prisma } from "@/generated/prisma/client";
function invalid(message: string): never {
  const e = new Error(message);
  e.name = "PayrollValidation";
  throw e;
}
function fail(e: unknown): FormState {
  return {
    error:
      e instanceof Error && e.name === "PayrollValidation"
        ? e.message
        : "Payroll belum tersimpan. Periksa koneksi dan coba lagi.",
  };
}
function amount(value: FormDataEntryValue | null, label: string) {
  const raw = String(value ?? "0");
  if (!/^\d+$/.test(raw) || Number(raw) > 1000000000)
    invalid(`${label} harus rupiah bulat, maksimal 1 miliar.`);
  return Number(raw);
}
async function sources(
  tx: Prisma.TransactionClient,
  employeeId: string,
  startDate: Date,
  endDate: Date,
) {
  const [days, ledger, paid, fines, settlements] = await Promise.all([
    tx.schedule.findMany({
      where: { date: { gte: startDate, lte: endDate } },
      include: { attendance: true },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    }),
    tx.moneyEntry.findMany({ where: { employeeId, status: "APPROVED" }, orderBy: { id: "asc" } }),
    tx.payroll.findMany({ where: { employeeId, status: "PAID" }, orderBy: { id: "asc" } }),
    tx.schedule.findMany({
      where: { employeeId, date: { lte: endDate } },
      include: { attendance: true },
      orderBy: { id: "asc" },
    }),
    tx.settlementReview.findMany({
      where: { employeeId, status: "APPROVED" },
      include: { deductions: { orderBy: { id: "asc" } } },
      orderBy: { id: "asc" },
    }),
  ]);
  const relevant = days.filter(
    (d) => d.employeeId === employeeId || ["CREW_GUDANG", "LEADER_SHIFT"].includes(d.role),
  );
  const hash = createHash("sha256")
    .update(
      JSON.stringify({
        relevant,
        ledger,
        paid: paid.map((p) => [p.id, p.lateDeduction]),
        fines,
        ...(settlements.length ? { settlements } : {}),
      }),
    )
    .digest("hex");
  const bonus = ledger
    .filter((e) => e.date <= endDate)
    .reduce(
      (sum, e) =>
        sum +
        (e.kind === "BONUS_EARNED" ? e.amount : e.kind === "BONUS_WITHDRAWAL" ? -e.amount : 0),
      0,
    );
  const late = Math.max(
    0,
    fines.reduce((sum, d) => sum + attendanceSummary(d, d.attendance).lateFine, 0) -
      paid.reduce((sum, p) => sum + p.lateDeduction, 0),
  );
  return {
    days: days.filter((d) => d.employeeId === employeeId),
    coworkers: relevant,
    ledger,
    settlements,
    hash,
    bonus,
    late,
  };
}
export async function createPayroll(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireAccess("payroll");
  try {
    const employeeId = String(form.get("employeeId") || ""),
      startDate = parseCivilDate(String(form.get("startDate") || "")),
      endDate = parseCivilDate(String(form.get("endDate") || ""));
    if (endDate < startDate || (endDate.getTime() - startDate.getTime()) / 86400000 > 61)
      invalid("Pilih periode berurutan maksimal 62 hari.");
    const dailyRate = amount(form.get("dailyRate"), "Tarif harian"),
      backupRate = amount(form.get("backupRate"), "Tambahan backup"),
      bonusPaid = amount(form.get("bonusPaid"), "Bonus dibayarkan"),
      lateDeduction = amount(form.get("lateDeduction"), "Potongan telat"),
      otherDeduction = amount(form.get("otherDeduction"), "Potongan lain");
    const notes = String(form.get("notes") || "").trim();
    if (notes.length > 2000 || (otherDeduction > 0 && !notes))
      invalid("Isi catatan untuk potongan lain, maksimal 2000 karakter.");
    const sales: Record<string, number> = {};
    for (const line of String(form.get("sales") || "")
      .split(/\r?\n/)
      .filter((s) => s.trim())) {
      const m = line.trim().match(/^(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})\s*[=:]\s*(\d+)$/);
      if (!m || Number(m[2]) > 1000000000)
        invalid("Omzet: satu tanggal=nominal per baris, contoh 12/10/2026=800000.");
      const salesDate = dateFromDisplay(m[1]) || m[1];
      try {
        parseCivilDate(salesDate);
      } catch {
        invalid("Tanggal omzet tidak valid.");
      }
      if (Object.hasOwn(sales, salesDate)) invalid("Tanggal omzet tidak boleh berulang.");
      sales[salesDate] = Number(m[2]);
    }
    const loanPayments: Record<string, number> = {};
    for (const [key, value] of form.entries())
      if (key.startsWith("loan:")) {
        if (Object.hasOwn(loanPayments, key.slice(5))) invalid("ID kasbon berulang.");
        const n = amount(value, "Pembayaran kasbon");
        if (n) loanPayments[key.slice(5)] = n;
      }
    const settlementPayments: Record<string, number> = {};
    const settlementKeys = new Set<string>();
    for (const [key, value] of form.entries())
      if (key.startsWith("settle:")) {
        const id = key.slice(7);
        if (settlementKeys.has(id)) invalid("ID selisih setoran berulang.");
        settlementKeys.add(id);
        const n = amount(value, "Potongan selisih setoran");
        if (n) settlementPayments[id] = n;
      }
    const settlementDeduction = Object.values(settlementPayments).reduce((a, b) => a + b, 0);
    if (settlementDeduction > 1000000000)
      invalid("Total potongan selisih setoran melebihi batas nominal.");
    await getPrisma().$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT id FROM employees WHERE id=${employeeId} FOR UPDATE`;
        const employee = await tx.employee.findUnique({ where: { id: employeeId } });
        if (!employee) invalid("Karyawan tidak ditemukan.");
        const overlap = await tx.payroll.findFirst({
          where: {
            employeeId,
            status: { not: "CANCELLED" },
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
        });
        if (overlap)
          invalid(
            `Periode bertumpang tindih dengan ${overlap.id}. Batalkan draft lama bila perlu.`,
          );
        const source = await sources(tx, employeeId, startDate, endDate);
        if (!source.days.length)
          invalid("Belum ada jadwal dalam periode ini. Isi jadwal dan absensi terlebih dahulu.");
        const settlementError = validateSettlementPayments(
          settlementPayments,
          source.settlements,
          endDate,
        );
        if (settlementError) invalid(settlementError);
        if (bonusPaid > source.bonus)
          invalid(`Bonus melebihi saldo disetujui sampai akhir periode (Rp ${source.bonus}).`);
        if (lateDeduction > source.late)
          invalid(`Potongan telat melebihi sisa denda sampai akhir periode (Rp ${source.late}).`);
        for (const id of Object.keys(loanPayments)) {
          if (!source.ledger.some((e) => e.id === id && e.kind === "LOAN"))
            invalid("Pilih kasbon yang disetujui milik karyawan ini.");
        }
        const candidates = Object.entries(loanPayments).map(([sourceId, n]) => ({
          id: `PAY:${sourceId}`,
          sourceId,
          amount: n,
          kind: "REPAYMENT",
          date: endDate,
        }));
        if (bonusPaid)
          candidates.push({
            id: "PAY:BONUS",
            sourceId: "",
            amount: bonusPaid,
            kind: "BONUS_WITHDRAWAL",
            date: endDate,
          });
        const error = validateLedger([...source.ledger, ...candidates]);
        if (error) invalid(error);
        let lines;
        try {
          lines = payrollLines(source.days, source.coworkers, dailyRate, backupRate, sales);
        } catch (e) {
          invalid((e as Error).message);
        }
        const sum = (key: "base" | "backup" | "standby" | "solo") =>
          lines.reduce((s, l) => s + l[key], 0);
        const basePay = sum("base"),
          backupPay = sum("backup"),
          standbyPay = sum("standby"),
          warehouseBonus = sum("solo"),
          loanDeduction = Object.values(loanPayments).reduce((a, b) => a + b, 0);
        const netPay =
          basePay +
          backupPay +
          standbyPay +
          warehouseBonus +
          bonusPaid -
          loanDeduction -
          lateDeduction -
          settlementDeduction -
          otherDeduction;
        if (netPay < 0 || netPay > 1000000000)
          invalid("Gaji bersih harus antara 0 dan 1 miliar. Sesuaikan potongan.");
        const payrollId = await allocateBusinessId(tx, "payroll");
        await tx.payroll.create({
          data: {
            id: payrollId,
            employeeId,
            employeeName: employee.employeeCode || employee.fullName,
            startDate,
            endDate,
            dailyRate,
            backupRate,
            paidUnits: lines.reduce((s, l) => s + l.units, 0),
            standbyDays: lines.filter((l) => l.standby > 0).length,
            basePay,
            backupPay,
            standbyPay,
            warehouseBonus,
            bonusPaid,
            lateDeduction,
            loanDeduction,
            otherDeduction,
            settlementDeduction,
            settlementPayments,
            netPay,
            details: lines,
            sales,
            loanPayments,
            sourceHash: source.hash,
            notes,
            createdById: user.id,
          },
        });
      },
      { timeout: 20000 },
    );
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/payroll");
  return { success: "Draft payroll tersimpan. Periksa rincian sebelum mencatat pembayaran." };
}
export async function decidePayroll(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireAccess("payroll"),
    id = String(form.get("id") || ""),
    decision = String(form.get("decision") || "");
  if (!["PAID", "CANCELLED"].includes(decision)) return { error: "Keputusan tidak valid." };
  try {
    await getPrisma().$transaction(
      async (tx) => {
        const candidate = await tx.payroll.findUnique({ where: { id } });
        if (!candidate) invalid("Payroll tidak ditemukan.");
        await tx.$executeRaw`SELECT id FROM employees WHERE id=${candidate.employeeId} FOR UPDATE`;
        const row = await tx.payroll.findUnique({ where: { id } });
        if (!row || row.status !== "DRAFT") invalid("Payroll sudah diproses. Muat ulang halaman.");
        if (decision === "PAID") {
          // Serialize with attendance changes, including coworkers used for solo bonuses.
          await tx.$executeRaw`SELECT id FROM schedules WHERE date >= ${row.startDate} AND date <= ${row.endDate} ORDER BY id FOR UPDATE`;
          const source = await sources(tx, row.employeeId, row.startDate, row.endDate);
          if (source.hash !== row.sourceHash)
            invalid(
              "Absensi atau saldo berubah sejak draft dibuat. Batalkan draft dan hitung ulang sebelum pembayaran.",
            );
          const settlementPayments = (row.settlementPayments ?? {}) as Record<string, number>;
          const settlementError = validateSettlementPayments(
            settlementPayments,
            source.settlements,
            row.endDate,
          );
          if (settlementError) invalid(settlementError);
          for (const [reviewId, amount] of Object.entries(settlementPayments))
            await tx.settlementDeduction.create({ data: { reviewId, payrollId: id, amount } });
          const loans = row.loanPayments as Record<string, number>;
          const postings = Object.entries(loans).map(([sourceId, amount]) => ({
            id: `${id}:KSB:${sourceId}`,
            postingKey: `${id}:KSB:${sourceId}`,
            sourceId,
            amount,
            kind: "REPAYMENT" as "REPAYMENT" | "BONUS_WITHDRAWAL",
            date: row.endDate,
          }));
          if (row.bonusPaid)
            postings.push({
              id: `${id}:BONUS`,
              postingKey: `${id}:BONUS`,
              sourceId: "",
              amount: row.bonusPaid,
              kind: "BONUS_WITHDRAWAL",
              date: row.endDate,
            });
          const error = validateLedger([...source.ledger, ...postings]);
          if (error) invalid(error);
          for (const p of postings)
            await tx.moneyEntry.create({
              data: {
                ...p,
                sourceId: p.sourceId || null,
                employeeId: row.employeeId,
                employeeName: row.employeeName,
                payrollId: id,
                notes: `Pembayaran melalui payroll ${id}`,
                status: "APPROVED",
                createdById: user.id,
                decidedById: user.id,
                decidedAt: new Date(),
              },
            });
        }
        await tx.payroll.update({
          where: { id },
          data: {
            status: decision as "PAID" | "CANCELLED",
            ...(decision === "PAID" ? { paidById: user.id, paidAt: new Date() } : {}),
          },
        });
      },
      { timeout: 20000 },
    );
  } catch (e) {
    return fail(e);
  }
  for (const path of [
    "/payroll",
    "/kasbon",
    "/bonus",
    "/absensi",
    "/selisih-setor",
    "/rekap-saldo",
  ])
    revalidatePath(path);
  return {
    success:
      decision === "PAID"
        ? "Pembayaran payroll dicatat dan saldo diperbarui."
        : "Draft dibatalkan. Riwayat tetap tersimpan.",
  };
}
