"use server";
import { readOutletLocation } from "@/lib/outlet-location";
import { readOutletHours, type OutletHours } from "@/lib/outlet-settings";
import { allocateBusinessId } from "@/lib/business-id";
import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import type { FormState } from "@/lib/form-state";
function read(form: FormData, key: string) {
  return String(form.get(key) || "").trim();
}
function name(form: FormData) {
  const value = read(form, "name").toUpperCase();
  if (!value || value.length > 100) throw new Error("Nama wajib diisi, maksimal 100 karakter.");
  return value;
}
function status(form: FormData) {
  const value = read(form, "active");
  if (!["true", "false"].includes(value)) throw new Error("Status tidak valid.");
  return value === "true";
}
function requestedId(form: FormData, prefix: string) {
  const id = read(form, "id").toUpperCase();
  if (id && (!/^[A-Z][A-Z0-9-]{1,39}$/.test(id) || id.startsWith(prefix + "-WEB-")))
    throw new Error("ID lama harus berupa huruf/angka/tanda hubung. Kosongkan untuk ID otomatis.");
  return id;
}
function failed(error: unknown): FormState {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
    return { error: "ID atau nama sudah digunakan. Periksa master yang sudah ada." };
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025")
    return { error: "Data master tidak ditemukan." };
  if (error instanceof Error && error.name === "ValidationError") return { error: error.message };
  return { error: "Data belum tersimpan. Periksa koneksi database dan coba lagi." };
}
export async function saveArea(_: FormState, form: FormData): Promise<FormState> {
  await requireAccess("master-area");
  const existingId = read(form, "existingId");
  let data: { name: string; active: boolean; color: string }, id: string;
  try {
    const areaName = name(form);
    const palette: Record<string, string> = {
      "AREA 1": "#f8d5cf",
      "AREA 2": "#ffe6a4",
      "AREA 3": "#cbe5f7",
      "AREA 4": "#e2d0f2",
    };
    const existing = existingId
      ? await getPrisma().area.findUnique({ where: { id: existingId }, select: { color: true } })
      : null;
    const color = palette[areaName.replace(/^BACKUP\s+/, "")] || existing?.color || "#deeddd";
    data = { name: areaName, active: status(form), color };
    id = existingId || requestedId(form, "BA");
  } catch (error) {
    return { error: (error as Error).message };
  }
  try {
    if (existingId) await getPrisma().area.update({ where: { id: existingId }, data });
    else
      await getPrisma().$transaction(async (tx) => {
        if (!id) {
          id = await allocateBusinessId(tx, "area");
        }
        await tx.area.create({ data: { id, ...data } });
      });
  } catch (error) {
    return failed(error);
  }
  revalidatePath("/master");
  revalidatePath("/master-area");
  revalidatePath("/master-outlet");
  revalidatePath("/penempatan");
  return { success: "Master area berhasil disimpan." };
}
export async function saveOutlet(_: FormState, form: FormData): Promise<FormState> {
  await requireAccess("master-outlet");
  const existingId = read(form, "existingId");
  let data: {
      name: string;
      nameCode: string | null;
      active: boolean;
      closed: boolean;
      areaId: string;
      dailyRate: number;
      operatingHours: OutletHours;
      latitude: number | null;
      longitude: number | null;
      address: string | null;
    },
    id: string;
  try {
    const nameCode = read(form, "nameCode").toUpperCase();
    if (nameCode.length > 40) throw Error("Kode nama maksimal 40 karakter.");
    const outletStatus = read(form, "active");
    if (!["true", "false", "closed"].includes(outletStatus))
      throw Error("Status outlet tidak valid.");
    const rawRate = read(form, "dailyRate");
    if (!/^\d+$/.test(rawRate) || Number(rawRate) < 1 || Number(rawRate) > 1000000000)
      throw Error("Isi tarif harian antara Rp1 dan Rp1.000.000.000.");
    const hours = readOutletHours(JSON.parse(read(form, "operatingHours") || "null"));
    if (!hours) throw Error("Lengkapi jam operasional untuk Senin sampai Minggu.");
    data = {
      name: name(form),
      nameCode: nameCode || null,
      active: outletStatus === "true",
      closed: outletStatus === "closed",
      areaId: read(form, "areaId"),
      dailyRate: Number(rawRate),
      operatingHours: hours,
      ...readOutletLocation(read(form, "latitude"), read(form, "longitude"), read(form, "address")),
    };
    if (!data.areaId) throw new Error("Pilih area untuk outlet.");
    id = existingId || requestedId(form, "OUT");
  } catch (error) {
    return { error: (error as Error).message };
  }
  try {
    await getPrisma().$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM areas WHERE id=${data.areaId} FOR SHARE`;
      const area = await tx.area.findUnique({ where: { id: data.areaId } });
      if (!area || (data.active && !area.active)) {
        const error = new Error("Outlet aktif harus menggunakan area yang aktif.");
        error.name = "ValidationError";
        throw error;
      }
      if (existingId) await tx.outlet.update({ where: { id: existingId }, data });
      else {
        if (!id) {
          id = await allocateBusinessId(tx, "outlet");
        }
        await tx.outlet.create({ data: { id, ...data } });
      }
    });
  } catch (error) {
    return failed(error);
  }
  revalidatePath("/master");
  revalidatePath("/master-area");
  revalidatePath("/master-outlet");
  revalidatePath("/penempatan");
  revalidatePath("/admin-malam/monitoring-outlet");
  revalidatePath("/menu-utama/dashboard");
  return { success: "Master outlet berhasil disimpan." };
}

export async function deleteArea(_: FormState, form: FormData): Promise<FormState> {
  await requireAccess("master-area");
  const id = read(form, "id"),
    version = new Date(read(form, "version"));
  if (!id || !Number.isFinite(version.getTime()))
    return { error: "Data area tidak valid. Muat ulang tabel." };
  try {
    const result = await getPrisma().area.deleteMany({ where: { id, updatedAt: version } });
    if (!result.count)
      return { error: "Area sudah berubah atau dihapus. Muat ulang tabel sebelum mencoba lagi." };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003")
      return {
        error:
          "Area masih digunakan oleh outlet, penempatan, atau catatan jadwal. Pindahkan relasinya terlebih dahulu, atau ubah status area menjadi tidak aktif.",
      };
    return failed(error);
  }
  for (const path of [
    "/master-area",
    "/master-outlet",
    "/penempatan",
    "/jadwal",
    "/menu-utama/dashboard",
  ])
    revalidatePath(path);
  return { success: "Area berhasil dihapus." };
}
