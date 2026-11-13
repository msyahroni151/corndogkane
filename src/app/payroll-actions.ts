"use server";
import { isCurrentLedgerEntry } from "@/lib/bonus-period";
import { allocateBusinessId } from "@/lib/business-id";
import { createHash } from "node:crypto";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { displayDate, isBackupEmployee, parseCivilDate } from "@/lib/placements";
import { isWarehouse, timeLabel } from "@/lib/schedules";
import { hasAction } from "@/lib/permission-actions";
import { attendanceSummary } from "@/lib/attendance";
import { payrollLines } from "@/lib/payroll";
import { settlementLeft, validateSettlementPayments } from "@/lib/settlements";
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
export type PayrollFormState = FormState & {
  preview?: {
    version: string;
    bonus: number;
    late: number;
    settlement: number;
    backupEligible: boolean;
    backup: number;
    standby: number;
    netPay: number;
    basePay: number;
    warehouseBonus: number;
    gross: number;
    loans: { id: string; left: number; amount: number }[];
    canEditAttendance: boolean;
    lateDays: {
      scheduleId: string;
      scheduleVersion: string;
      version: string;
      date: string;
      outlet: string;
      checkIn: string;
      checkOut: string;
      checkInNextDay: boolean;
      checkOutNextDay: boolean;
      scheduledIn: string;
      scheduledOut: string;
      status: string;
      minutes: number;
      fine: number;
      waiver: string;
      notes: string;
      paid: boolean;
    }[];
  };
};
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
  const employeeDays = days.filter((d) => d.employeeId === employeeId);
  const cijerahDays = employeeDays.filter(
    (day) =>
      day.outletName?.trim().toUpperCase() === "CIJERAH" &&
      attendanceSummary(day, day.attendance).paidUnits > 0,
  );
  const cijerah = cijerahDays.length
    ? await tx.outletOperation.findMany({
        where: {
          outletId: {
            in: [...new Set(cijerahDays.flatMap((d) => (d.outletId ? [d.outletId] : [])))],
          },
          date: { gte: startDate, lte: endDate },
          salesPending: false,
        },
        select: { outletId: true, date: true, totalGross: true },
      })
    : [];
  const sales = Object.fromEntries(
    cijerahDays.flatMap((day) => {
      const recap = cijerah.find((row) => row.outletId === day.outletId && +row.date === +day.date);
      return recap ? [[day.date.toISOString().slice(0, 10), recap.totalGross] as const] : [];
    }),
  );
  // Preserve hashes of existing drafts when the new attendance column is empty.
  function normalizeAttendance<T extends { attendance: { lateFineWaiver: string | null } | null }>(
    day: T,
  ) {
    if (!day.attendance || day.attendance.lateFineWaiver) return day;
    return { ...day, attendance: { ...day.attendance, lateFineWaiver: undefined } };
  }
  const hash = createHash("sha256")
    .update(
      JSON.stringify({
        relevant: relevant.map(normalizeAttendance),
        ledger,
        paid: paid.map((p) => [p.id, p.lateDeduction]),
        fines: fines.map(normalizeAttendance),
        ...(settlements.length ? { settlements } : {}),
      }),
    )
    .digest("hex");
  const bonus = ledger
    .filter((e) => e.date <= endDate && isCurrentLedgerEntry(e))
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
    days: employeeDays,
    coworkers: relevant,
    ledger,
    settlements,
    hash,
    bonus,
    late,
    sales,
    fines,
    paid,
  };
}
export async function createPayroll(
  _: PayrollFormState,
  form: FormData,
): Promise<PayrollFormState> {
  const user = await requireAccess("payroll", "create");
  try {
    const employeeId = String(form.get("employeeId") || ""),
      startDate = parseCivilDate(String(form.get("startDate") || "")),
      endDate = parseCivilDate(String(form.get("endDate") || ""));
    if (endDate < startDate || (endDate.getTime() - startDate.getTime()) / 86400000 > 61)
      invalid("Pilih periode berurutan maksimal 62 hari.");
    const commit = form.get("mode") === "save";
    const requestedLoans = new Map<string, number>();
    for (const [key, value] of form.entries())
      if (key.startsWith("loan:")) {
        const id = key.slice(5);
        if (requestedLoans.has(id)) invalid("ID kasbon berulang.");
        requestedLoans.set(id, amount(value, "Pembayaran kasbon"));
      }
    const preview = await getPrisma().$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT id FROM employees WHERE id=${employeeId} FOR UPDATE`;
        const employee = await tx.employee.findUnique({ where: { id: employeeId } });
        if (!employee?.active) invalid("Karyawan aktif tidak ditemukan.");
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
        const repaymentByLoan = new Map<string, number>();
        for (const entry of source.ledger)
          if (entry.kind === "REPAYMENT" && entry.sourceId)
            repaymentByLoan.set(
              entry.sourceId,
              (repaymentByLoan.get(entry.sourceId) ?? 0) + entry.amount,
            );
        const loans = source.ledger
          .filter((entry) => entry.kind === "LOAN" && entry.date <= endDate)
          .map((entry) => ({
            id: entry.id,
            left: entry.amount - (repaymentByLoan.get(entry.id) ?? 0),
          }))
          .filter((loan) => loan.left > 0)
          .map((loan) => ({ ...loan, amount: requestedLoans.get(loan.id) ?? loan.left }));
        for (const id of requestedLoans.keys()) {
          if (!loans.some((loan) => loan.id === id))
            invalid("Pilih kasbon yang disetujui milik karyawan ini.");
        }
        if (loans.some((loan) => loan.amount > loan.left))
          invalid("Potongan melebihi sisa kasbon.");
        const loanPayments = Object.fromEntries(
          loans.filter((loan) => loan.amount > 0).map((loan) => [loan.id, loan.amount]),
        );
        const settlementPayments = Object.fromEntries(
          source.settlements
            .filter((review) => review.date <= endDate && settlementLeft(review) > 0)
            .map((review) => [review.id, settlementLeft(review)]),
        );
        const settlementDeduction = Object.values(settlementPayments).reduce((a, b) => a + b, 0);
        const bonusPaid = Math.max(0, source.bonus);
        const lateDeduction = source.late;
        const dailyRate =
          employee.salaryBasis === "HARIAN" || employee.employeeType === "HARIAN"
            ? (employee.baseSalary ?? 0)
            : 0;
        const backupRate = 30000;
        const backupEligible =
          isBackupEmployee(employee) || employee.position.trim().toUpperCase() === "LEADER AREA";
        const { sales } = source;
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
          const legacyOutletIds = [
            ...new Set(
              source.days.flatMap((day) =>
                day.outletId && !day.outletDailyRate ? [day.outletId] : [],
              ),
            ),
          ];
          const rates = new Map(
            (legacyOutletIds.length
              ? await tx.outlet.findMany({
                  where: { id: { in: legacyOutletIds } },
                  select: { id: true, dailyRate: true },
                })
              : []
            ).map((outlet) => [outlet.id, outlet.dailyRate]),
          );
          const days = source.days.map((day) => ({
            ...day,
            role: isWarehouse(day.role) ? day.role : backupEligible ? "BACKUP" : "REGULER",
            outletDailyRate: day.outletDailyRate || rates.get(day.outletId ?? "") || null,
          }));
          lines = payrollLines(days, source.coworkers, dailyRate, backupRate, sales);
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
        const gross = basePay + backupPay + standbyPay + warehouseBonus + bonusPaid;
        const netPay = gross - loanDeduction - lateDeduction - settlementDeduction;
        const version = createHash("sha256")
          .update(JSON.stringify([source.hash, sales, lines, loans]))
          .digest("hex");
        if (!commit)
          return {
            version,
            bonus: bonusPaid,
            late: lateDeduction,
            settlement: settlementDeduction,
            backupEligible,
            backup: backupPay,
            standby: standbyPay,
            netPay,
            basePay,
            warehouseBonus,
            gross,
            loans,
            canEditAttendance: hasAction(user, "absensi", "edit"),
            lateDays: source.fines.flatMap((day) => {
              const attendance = day.attendance;
              const summary = attendanceSummary(day, attendance);
              if (!attendance || !summary.lateMinutes) return [];
              return [
                {
                  scheduleId: day.id,
                  scheduleVersion: day.updatedAt.toISOString(),
                  version: attendance.updatedAt.toISOString(),
                  date: displayDate(day.date),
                  outlet: day.outletName || day.location || "—",
                  checkIn: timeLabel(attendance.checkInMinutes),
                  checkOut: timeLabel(attendance.checkOutMinutes),
                  checkInNextDay: attendance.checkInNextDay,
                  checkOutNextDay: attendance.checkOutNextDay,
                  scheduledIn: timeLabel(day.startMinutes),
                  scheduledOut: timeLabel(day.endMinutes),
                  status: attendance.status,
                  minutes: summary.lateMinutes,
                  fine: summary.lateFine,
                  waiver: attendance.lateFineWaiver ?? "",
                  notes: hasAction(user, "absensi", "edit") ? (attendance.notes ?? "") : "",
                  paid: source.paid.some(
                    (row) => row.startDate <= day.date && day.date <= row.endDate,
                  ),
                },
              ];
            }),
          };
        if (form.get("previewVersion") !== version)
          invalid("Hitungan berubah. Tampilkan pratinjau terbaru sebelum menyimpan draft.");
        if (netPay < 0 || netPay > 1000000000)
          invalid("Gaji bersih harus antara 0 dan 1 miliar. Periksa potongan pada pratinjau.");
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
            otherDeduction: 0,
            settlementDeduction,
            settlementPayments,
            netPay,
            details: lines,
            sales,
            loanPayments,
            sourceHash:
              "auto:" +
              createHash("sha256")
                .update(JSON.stringify([source.hash, sales]))
                .digest("hex"),
            notes: "",
            createdById: user.id,
          },
        });
      },
      { timeout: 20000 },
    );
    if (preview) return { preview };
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/payroll");
  return { success: "Draft payroll tersimpan. Periksa rincian sebelum mencatat pembayaran." };
}
export async function decidePayroll(_: FormState, form: FormData): Promise<FormState> {
  await requireAccess("payroll", "approve");
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
          const hash = row.sourceHash.startsWith("auto:")
            ? "auto:" +
              createHash("sha256")
                .update(JSON.stringify([source.hash, source.sales]))
                .digest("hex")
            : source.hash;
          if (hash !== row.sourceHash)
            invalid(
              "Absensi atau saldo berubah sejak draft dibuat. Batalkan draft dan hitung ulang sebelum pembayaran.",
            );
          if (row.bonusPaid > Math.max(0, source.bonus))
            invalid(
              "Bonus pada draft melebihi saldo mulai 1 November 2026. Batalkan draft dan hitung ulang sebelum pembayaran.",
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
