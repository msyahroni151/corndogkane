"use server";
import { allocateAssetCode } from "@/lib/asset-code";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { todayWib } from "@/lib/placements";
import {
  assetInvalid,
  assetRequestKey,
  parseAssetGeneral,
  parseAssetLocation,
  assetChangeReason,
  isFixedAssetAccount,
} from "@/lib/fixed-assets";
import { Prisma, type FixedAsset } from "@/generated/prisma/client";
import type { FormState } from "@/lib/form-state";
import type { AssetActionState } from "@/lib/fixed-assets";
function failure(e: unknown): FormState {
  if (e instanceof Error && e.name === "AssetValidation") return { error: e.message };
  if (e && typeof e === "object" && "code" in e && e.code === "P2002")
    return { error: "Kode aset belum bisa diterbitkan. Tutup formulir dan coba simpan kembali." };
  return { error: "Data aset belum tersimpan. Periksa koneksi dan coba lagi." };
}
function snapshot(a: FixedAsset) {
  return JSON.parse(
    JSON.stringify(a, (_, v) => (typeof v === "bigint" ? v.toString() : v)),
  ) as Prisma.InputJsonObject;
}
function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
async function replay(tx: Prisma.TransactionClient, key: string, hash: string, userId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"ASSET:" + key},0))`;
  const old = await tx.assetEvent.findUnique({ where: { requestKey: key } });
  if (old && (old.actorId !== userId || old.requestHash !== hash))
    assetInvalid("Formulir ini sudah dipakai untuk perubahan lain. Tutup dan buka kembali.");
  return old;
}
async function category(tx: Prisma.TransactionClient, id: string, existing?: FixedAsset) {
  if (existing?.categoryAccountId === id)
    return {
      categoryAccountId: id,
      categoryCode: existing.categoryCode,
      categoryName: existing.categoryName,
    };
  await tx.$executeRaw`SELECT id FROM financial_accounts WHERE id=${id} FOR SHARE`;
  const account = await tx.financialAccount.findUnique({ where: { id } });
  if (!account || !isFixedAssetAccount(account))
    assetInvalid("Pilih kategori akun Aset Tetap yang aktif.");
  return { categoryAccountId: id, categoryCode: account.code, categoryName: account.name };
}
async function location(
  tx: Prisma.TransactionClient,
  value: ReturnType<typeof parseAssetLocation>,
) {
  if (value.locationType === "KANTOR") return value;
  await tx.$executeRaw`SELECT id FROM outlets WHERE id=${value.outletId!} FOR SHARE`;
  const outlet = await tx.outlet.findUnique({ where: { id: value.outletId! } });
  if (!outlet || !outlet.active || outlet.closed)
    assetInvalid("Pilih outlet aktif yang terdaftar.");
  return { ...value, locationName: outlet.name };
}
function version(form: FormData) {
  const id = String(form.get("id") || ""),
    version = String(form.get("version") || "");
  if (!id || id.length > 100 || !version)
    assetInvalid("Versi data aset tidak valid. Muat ulang halaman.");
  return { id, version };
}
async function existingAsset(tx: Prisma.TransactionClient, id: string, version: string) {
  await tx.$executeRaw`SELECT id FROM fixed_assets WHERE id=${id} FOR UPDATE`;
  const asset = await tx.fixedAsset.findUnique({ where: { id } });
  if (!asset || asset.updatedAt.toISOString() !== version)
    assetInvalid("Data aset sudah berubah. Tutup dan buka kembali formulir.");
  return asset;
}
function refresh() {
  revalidatePath("/finance/aset-tetap");
}
export async function createFixedAsset(_: FormState, form: FormData): Promise<AssetActionState> {
  const user = await requireAccess("finance-assets");
  try {
    const key = assetRequestKey(form),
      general = parseAssetGeneral(form, todayWib(), true),
      place = parseAssetLocation(form),
      hash = digest({ type: "CREATED", general, place });
    const assetCode = await getPrisma().$transaction(
      async (tx) => {
        const prior = await replay(tx, key, hash, user.id);
        if (prior) {
          const saved = await tx.fixedAsset.findUnique({
            where: { id: prior.assetId },
            select: { code: true },
          });
          if (!saved) assetInvalid("Aset tidak ditemukan.");
          return saved.code;
        }
        const cat = await category(tx, general.categoryAccountId),
          loc = await location(tx, place);
        const code = await allocateAssetCode(tx);
        const asset = await tx.fixedAsset.create({
          data: {
            ...general,
            code,
            ...cat,
            ...loc,
            acquisitionCost:
              general.acquisitionCost == null ? null : BigInt(general.acquisitionCost),
            createdById: user.id,
            updatedById: user.id,
          },
        });
        await tx.assetEvent.create({
          data: {
            assetId: asset.id,
            type: "CREATED",
            requestKey: key,
            requestHash: hash,
            after: snapshot(asset),
            notes:
              general.registrationType === "NEW" ? "Pencatatan aset baru." : "Pendataan aset lama.",
            actorId: user.id,
          },
        });
        return asset.code;
      },
      { timeout: 15000 },
    );
    refresh();
    return { success: "Aset " + assetCode + " berhasil didaftarkan.", assetCode };
  } catch (e) {
    return failure(e);
  }
}
export async function updateFixedAsset(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireAccess("finance-assets");
  try {
    const key = assetRequestKey(form),
      current = version(form),
      general = parseAssetGeneral(form, todayWib()),
      reason = assetChangeReason(form),
      hash = digest({ type: "UPDATED", current, general, reason });
    await getPrisma().$transaction(
      async (tx) => {
        if (await replay(tx, key, hash, user.id)) return;
        const asset = await existingAsset(tx, current.id, current.version);
        if (general.code !== asset.code)
          assetInvalid("Kode aset tidak dapat diubah setelah didaftarkan.");
        const cat = await category(tx, general.categoryAccountId, asset);
        const updated = await tx.fixedAsset.update({
          where: { id: asset.id },
          data: {
            ...general,
            ...cat,
            acquisitionCost:
              general.acquisitionCost == null ? null : BigInt(general.acquisitionCost),
            updatedById: user.id,
          },
        });
        await tx.assetEvent.create({
          data: {
            assetId: asset.id,
            type: "UPDATED",
            requestKey: key,
            requestHash: hash,
            before: snapshot(asset),
            after: snapshot(updated),
            notes: reason || "Pembaruan data aset.",
            actorId: user.id,
          },
        });
      },
      { timeout: 15000 },
    );
    refresh();
    return { success: "Data aset berhasil diperbarui." };
  } catch (e) {
    return failure(e);
  }
}
export async function moveFixedAsset(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireAccess("finance-assets");
  try {
    const key = assetRequestKey(form),
      current = version(form),
      place = parseAssetLocation(form),
      reason = assetChangeReason(form),
      responsibleRaw = form.get("responsibleName");
    if (responsibleRaw != null && typeof responsibleRaw !== "string")
      assetInvalid("Penanggung jawab tidak valid.");
    const responsibleName = String(responsibleRaw || "").trim();
    if (responsibleName.length > 160) assetInvalid("Penanggung jawab maksimal 160 karakter.");
    const hash = digest({ type: "MOVED", current, place, reason, responsibleName });
    await getPrisma().$transaction(
      async (tx) => {
        if (await replay(tx, key, hash, user.id)) return;
        const asset = await existingAsset(tx, current.id, current.version),
          loc = await location(tx, place);
        if (
          asset.locationType === loc.locationType &&
          asset.outletId === loc.outletId &&
          asset.locationName === loc.locationName &&
          asset.locationDetail === loc.locationDetail &&
          asset.responsibleName === responsibleName
        )
          assetInvalid("Lokasi dan penanggung jawab masih sama.");
        const moved = await tx.fixedAsset.update({
          where: { id: asset.id },
          data: { ...loc, responsibleName, updatedById: user.id },
        });
        await tx.assetEvent.create({
          data: {
            assetId: asset.id,
            type: "MOVED",
            requestKey: key,
            requestHash: hash,
            before: snapshot(asset),
            after: snapshot(moved),
            notes: reason || "Pemindahan aset.",
            actorId: user.id,
          },
        });
      },
      { timeout: 15000 },
    );
    refresh();
    return { success: "Lokasi aset berhasil diperbarui dan riwayat tersimpan." };
  } catch (e) {
    return failure(e);
  }
}
