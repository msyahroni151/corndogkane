"use server";
import { revalidatePath } from "next/cache";
import { getPrisma } from "@/lib/db";
import { portalIdentity } from "@/lib/portal-access";
import { portalLeaveDates, leaveKinds } from "@/lib/employee-portal";
import { allocateBusinessId } from "@/lib/business-id";
import { todayWib } from "@/lib/placements";
import type { FormState } from "@/lib/form-state";
const get = (f: FormData, k: string) => String(f.get(k) || "").trim();
function keyOf(f: FormData) {
  const key = get(f, "requestKey");
  if (!/^[a-f0-9-]{36}$/.test(key)) throw Error("Form kedaluwarsa. Muat ulang halaman.");
  return key;
}
export async function requestPortalLoan(_: FormState, f: FormData): Promise<FormState> {
  const { user, employee } = await portalIdentity();
  try {
    const key = keyOf(f),
      raw = get(f, "amount"),
      notes = get(f, "reason");
    if (!/^\d+$/.test(raw) || Number(raw) < 1000 || Number(raw) > 1000000000)
      throw Error("Nominal kasbon harus rupiah bulat antara 1.000 dan 1.000.000.000.");
    if (notes.length < 5 || notes.length > 2000)
      throw Error("Isi alasan pengajuan antara 5 dan 2000 karakter.");
    await getPrisma().$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM employees WHERE id=${employee.id} FOR UPDATE`;
      const prior = await tx.moneyEntry.findUnique({ where: { postingKey: "PORTAL-LOAN:" + key } });
      if (prior) {
        if (prior.employeeId !== employee.id) throw Error("Permintaan tidak valid.");
        return;
      }
      await tx.moneyEntry.create({
        data: {
          id: await allocateBusinessId(tx, "loan"),
          postingKey: "PORTAL-LOAN:" + key,
          employeeId: employee.id,
          employeeName: employee.fullName,
          date: new Date(todayWib() + "T00:00:00Z"),
          kind: "LOAN",
          amount: Number(raw),
          notes: "Pengajuan portal: " + notes,
          createdById: user.id,
          status: "PENDING",
        },
      });
    });
    revalidatePath("/kasbon");
    revalidatePath("/portal-karyawan", "layout");
    return { success: "Pengajuan kasbon terkirim. Tunggu persetujuan admin." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Pengajuan belum tersimpan." };
  }
}
export async function requestPortalLeave(_: FormState, f: FormData): Promise<FormState> {
  const { user, employee } = await portalIdentity();
  try {
    const key = keyOf(f),
      kind = get(f, "kind"),
      reason = get(f, "reason");
    if (!Object.hasOwn(leaveKinds, kind) || reason.length < 5 || reason.length > 2000)
      throw Error("Pilih jenis dan isi alasan antara 5 dan 2000 karakter.");
    const { from, to } = portalLeaveDates(get(f, "startDate"), get(f, "endDate"));
    await getPrisma().$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM employees WHERE id=${employee.id} FOR UPDATE`;
      const prior = await tx.portalLeave.findUnique({ where: { requestKey: key } });
      if (prior) {
        if (prior.employeeId !== employee.id) throw Error("Permintaan tidak valid.");
        return;
      }
      if (
        await tx.portalLeave.findFirst({
          where: {
            employeeId: employee.id,
            status: { in: ["PENDING", "APPROVED"] },
            startDate: { lte: to },
            endDate: { gte: from },
          },
        })
      )
        throw Error("Sudah ada pengajuan aktif pada rentang tanggal tersebut.");
      await tx.portalLeave.create({
        data: {
          requestKey: key,
          employeeId: employee.id,
          kind,
          startDate: from,
          endDate: to,
          reason,
          createdById: user.id,
        },
      });
    });
    revalidatePath("/portal-karyawan", "layout");
    return {
      success: "Pengajuan terkirim dan menunggu persetujuan. Jadwal mengikuti keputusan admin.",
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Pengajuan belum tersimpan." };
  }
}
export async function cancelPortalLeave(_: FormState, f: FormData): Promise<FormState> {
  const { employee } = await portalIdentity();
  const changed = await getPrisma().portalLeave.updateMany({
    where: { id: get(f, "id"), employeeId: employee.id, status: "PENDING" },
    data: { status: "CANCELLED" },
  });
  revalidatePath("/portal-karyawan", "layout");
  return changed.count
    ? { success: "Pengajuan dibatalkan." }
    : { error: "Pengajuan sudah diproses atau tidak tersedia." };
}
