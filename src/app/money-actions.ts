"use server";
import { hasPermission } from "@/lib/permissions";
import { allocateBusinessId } from "@/lib/business-id";
import { requireUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { parseCivilDate } from "@/lib/placements";
import { moneyLabels, validateLedger } from "@/lib/money";
import { revalidatePath } from "next/cache";
import type { MoneyKind } from "@/generated/prisma/client";
import type { FormState } from "@/lib/form-state";
function invalid(message: string): never {
  const e = new Error(message);
  e.name = "MoneyValidation";
  throw e;
}
function fail(e: unknown): FormState {
  return {
    error:
      e instanceof Error && e.name === "MoneyValidation"
        ? e.message
        : "Pencatatan belum tersimpan. Periksa koneksi dan coba lagi.",
  };
}
export async function createMoneyEntry(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const get = (key: string) => String(form.get(key) || "").trim();
  const kind = get("kind");
  if (!hasPermission(user, ["LOAN", "REPAYMENT"].includes(kind) ? "kasbon" : "bonus"))
    return { error: "Anda tidak memiliki akses ke menu ini." };
  if (!Object.hasOwn(moneyLabels, kind)) return { error: "Jenis pencatatan tidak valid." };
  const raw = get("amount");
  if (!/^\d+$/.test(raw) || Number(raw) <= 0 || Number(raw) > 1000000000)
    return { error: "Nominal harus rupiah bulat antara 1 dan 1.000.000.000." };
  if (!get("notes") || get("notes").length > 2000)
    return { error: "Isi keterangan maksimal 2000 karakter." };
  let date: Date;
  try {
    date = parseCivilDate(get("date"));
  } catch (e) {
    return { error: (e as Error).message };
  }
  try {
    await getPrisma().$transaction(
      async (tx) => {
        const employee = await tx.employee.findUnique({ where: { id: get("employeeId") } });
        if (!employee) invalid("Karyawan tidak ditemukan.");
        if (!employee.active && ["LOAN", "BONUS_EARNED"].includes(kind))
          invalid(
            "Pencatatan baru ini memerlukan karyawan aktif. Riwayat pelunasan/pengambilan tetap tersedia.",
          );
        if (kind === "BONUS_EARNED") {
          await tx.$executeRaw`SELECT id FROM employees WHERE id=${employee.id} FOR UPDATE`;
          const automatic = await tx.moneyEntry.findFirst({
            where: {
              employeeId: employee.id,
              date,
              kind: "BONUS_EARNED",
              postingKey: { startsWith: "OUTLET-BONUS:" },
              status: { not: "REJECTED" },
            },
          });
          if (automatic)
            invalid(
              "Sudah ada bonus otomatis dari operasional pada tanggal ini. Proses catatan tersebut agar tidak tercatat ganda.",
            );
        }
        let sourceId: string | null = null;
        if (kind === "REPAYMENT") {
          const loan = await tx.moneyEntry.findUnique({ where: { id: get("sourceId") } });
          if (
            !loan ||
            loan.kind !== "LOAN" ||
            loan.status !== "APPROVED" ||
            loan.employeeId !== employee.id
          )
            invalid("Pilih ID kasbon yang sudah disetujui milik karyawan ini.");
          sourceId = loan.id;
        }
        const id = await allocateBusinessId(
          tx,
          kind === "LOAN" || kind === "REPAYMENT" ? "loan" : "bonus",
        );
        await tx.moneyEntry.create({
          data: {
            id,
            employeeId: employee.id,
            employeeName: employee.employeeCode || employee.fullName,
            date,
            kind: kind as MoneyKind,
            amount: Number(raw),
            notes: get("notes"),
            sourceId,
            createdById: user.id,
          },
        });
      },
      { timeout: 10000 },
    );
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/kasbon");
  revalidatePath("/bonus");
  revalidatePath("/payroll");
  revalidatePath("/rekap-saldo");
  return { success: "Catatan tersimpan dan menunggu persetujuan." };
}
export async function decideMoneyEntry(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = String(form.get("id") || "");
  const target = await getPrisma().moneyEntry.findUnique({ where: { id }, select: { kind: true } });
  if (
    !target ||
    !hasPermission(user, ["LOAN", "REPAYMENT"].includes(target.kind) ? "kasbon" : "bonus")
  )
    return { error: "Catatan tidak tersedia atau Anda tidak memiliki akses." };
  const decision = String(form.get("decision") || "");
  const notes = String(form.get("decisionNotes") || "").trim();
  if (!["APPROVED", "REJECTED"].includes(decision) || notes.length > 2000)
    return { error: "Status persetujuan atau catatan tidak valid." };
  if (decision === "REJECTED" && !notes) return { error: "Isi alasan penolakan." };
  try {
    await getPrisma().$transaction(
      async (tx) => {
        const candidate = await tx.moneyEntry.findUnique({ where: { id } });
        if (!candidate) invalid("Catatan tidak ditemukan.");
        await tx.$executeRaw`SELECT id FROM employees WHERE id=${candidate.employeeId} FOR UPDATE`;
        const row = await tx.moneyEntry.findUnique({ where: { id } });
        if (!row || row.status !== "PENDING")
          invalid("Catatan ini sudah diproses. Muat ulang untuk melihat status terbaru.");
        if (
          row.employeeId !== candidate.employeeId ||
          (row.postingKey?.startsWith("OUTLET-BONUS:") &&
            (String(form.get("decisionAmount")) !== String(row.amount) ||
              String(form.get("decisionEmployeeId")) !== row.employeeId))
        )
          invalid(
            "Nominal bonus atau crew sudah berubah. Tutup lalu buka kembali untuk memeriksa data terbaru.",
          );
        if (decision === "APPROVED") {
          const approved = await tx.moneyEntry.findMany({
            where: { employeeId: row.employeeId, status: "APPROVED" },
          });
          const error = validateLedger([...approved, row]);
          if (error) invalid(error);
        }
        await tx.moneyEntry.update({
          where: { id },
          data: {
            status: decision as "APPROVED" | "REJECTED",
            decidedById: user.id,
            decidedAt: new Date(),
            decisionNotes: notes || null,
          },
        });
      },
      { timeout: 10000 },
    );
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/kasbon");
  revalidatePath("/bonus");
  revalidatePath("/payroll");
  revalidatePath("/rekap-saldo");
  return { success: "Status pencatatan diperbarui." };
}
