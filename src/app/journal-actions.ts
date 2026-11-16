"use server";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { accountKinds, parseJournal } from "@/lib/general-journal";
import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/form-state";
import masterAccounts from "../../integrations/coa/master-coa-v1.json";
import outletAccounts from "../../integrations/coa/outlet-accounts-v1.json";
function invalid(message: string): never {
  const e = new Error(message);
  e.name = "JournalValidation";
  throw e;
}
function fail(e: unknown): FormState {
  return {
    error:
      e instanceof Error && e.name === "JournalValidation"
        ? e.message
        : "Data belum tersimpan. Periksa koneksi lalu coba lagi.",
  };
}
export async function importDefaultFinancialAccounts(): Promise<FormState> {
  const owner = await requireAccess("master-akun", "create");
  if (owner.roleSystemKey !== "OWNER") return { error: "Impor COA memerlukan akses Owner." };
  const accounts = [...masterAccounts.accounts, ...outletAccounts.accounts];
  if (
    masterAccounts.accounts.length !== 133 ||
    outletAccounts.accounts.length !== 18 ||
    new Set(accounts.map(({ code }) => code)).size !== accounts.length
  )
    return { error: "Konfigurasi daftar akun tidak valid." };
  try {
    await getPrisma().$transaction(async (tx) => {
      await tx.financialAccount.createMany({
        data: accounts.map((account) => ({
          ...account,
          id: `COA-V1-${account.code}`,
          createdById: owner.id,
        })),
        skipDuplicates: true,
      });
      const imported = await tx.financialAccount.findMany({
        where: { code: { in: accounts.map(({ code }) => code) } },
      });
      const byCode = new Map(imported.map((account) => [account.code, account]));
      for (const account of accounts) {
        const actual = byCode.get(account.code);
        if (
          !actual ||
          Object.entries(account).some(([key, value]) => actual[key as keyof typeof actual] !== value)
        )
          invalid(`Kode COA ${account.code} sudah digunakan dengan data berbeda.`);
      }
    });
  } catch (error) {
    return fail(error);
  }
  for (const route of [
    "/admin-malam/master-akun",
    "/open-transaction",
    "/finance/jurnal-umum",
    "/finance/pengeluaran-operasional",
    "/finance/laporan-akuntansi",
    "/finance/finance-ledger",
  ]) revalidatePath(route);
  return { success: "Daftar 151 akun COA berhasil disiapkan." };
}
export async function saveFinancialAccount(_: FormState, form: FormData): Promise<FormState> {
  await requireAccess("master-akun", form.get("id") || form.get("existingId") ? "edit" : "create");
  const user = await requireAccess("master-akun"),
    get = (key: string) => String(form.get(key) || "").trim(),
    code = get("code").toUpperCase(),
    name = get("name"),
    kind = get("kind"),
    id = get("id");
  const normal =
    get("normalBalance") ||
    (["KEWAJIBAN", "MODAL", "PENDAPATAN"].includes(kind) ? "CREDIT" : "DEBIT");
  if (
    !["DEBIT", "CREDIT", "BOTH"].includes(normal) ||
    get("subGroup").length > 120 ||
    get("notes").length > 2000
  )
    return { error: "Periksa saldo normal, subkelompok, dan catatan akun." };
  if (
    !/^[A-Z0-9][A-Z0-9._-]{0,29}$/.test(code) ||
    !name ||
    name.length > 120 ||
    !Object.hasOwn(accountKinds, kind)
  )
    return {
      error:
        "Isi kode akun (maksimal 30 huruf/angka), nama (maksimal 120 karakter), dan jenis akun yang valid.",
    };
  try {
    await getPrisma().$transaction(async (tx) => {
      if (id) {
        await tx.$executeRaw`SELECT id FROM financial_accounts WHERE id=${id} FOR UPDATE`;
        const existing = await tx.financialAccount.findUnique({ where: { id } });
        if (existing?.sourceType === "SYSTEM" && existing.code !== code)
          invalid("Kode akun COA sistem tidak dapat diubah.");
        if (!existing || existing.updatedAt.toISOString() !== get("version"))
          invalid("Akun sudah berubah. Tutup formulir dan muat ulang.");
      }
      const same = await tx.financialAccount.findUnique({ where: { code } });
      if (same && same.id !== id) invalid("Kode akun sudah digunakan.");
      const data = {
        code,
        name,
        kind,
        active: get("active") === "true",
        normalBalance: normal,
        subGroup: get("subGroup") || "Lainnya",
        notes: get("notes"),
      };
      if (id) await tx.financialAccount.update({ where: { id }, data });
      else await tx.financialAccount.create({ data: { ...data, createdById: user.id } });
    });
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/admin-malam/master-akun");
  revalidatePath("/open-transaction");
  revalidatePath("/finance/jurnal-umum");
  revalidatePath("/finance/pengeluaran-operasional");
  revalidatePath("/finance/laporan-akuntansi");
  revalidatePath("/finance/finance-ledger");
  return { success: "Akun berhasil disimpan." };
}
export async function createJournalTransaction(_: FormState, form: FormData): Promise<FormState> {
  await requireAccess("open-transaction", "create");
  const user = await requireAccess("open-transaction");
  let data: ReturnType<typeof parseJournal>;
  try {
    data = parseJournal(form);
  } catch (e) {
    return { error: (e as Error).message };
  }
  try {
    await getPrisma().$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"JOURNAL:" + data.postingKey}))`;
      const posted = await tx.journalTransaction.findUnique({
        where: { postingKey: data.postingKey },
      });
      if (posted) {
        if (
          posted.createdById !== user.id ||
          posted.date.getTime() !== data.date.getTime() ||
          posted.sourceAccountId !== data.sourceAccountId ||
          posted.targetAccountId !== data.targetAccountId ||
          posted.sourceSide !== data.sourceSide ||
          posted.amount !== data.amount ||
          posted.notes !== data.notes
        )
          invalid("Formulir transaksi ini sudah digunakan. Tutup dan buka kembali.");
        return;
      }
      for (const id of [data.sourceAccountId, data.targetAccountId].sort())
        await tx.$executeRaw`SELECT id FROM financial_accounts WHERE id=${id} FOR SHARE`;
      const accounts = await tx.financialAccount.findMany({
        where: { id: { in: [data.sourceAccountId, data.targetAccountId] }, active: true },
      });
      const source = accounts.find((a) => a.id === data.sourceAccountId),
        target = accounts.find((a) => a.id === data.targetAccountId);
      if (!source || !target) invalid("Pilih akun asal dan tujuan yang aktif dari Master Akun.");
      await tx.journalTransaction.create({
        data: {
          ...data,
          sourceCode: source.code,
          sourceName: source.name,
          targetCode: target.code,
          targetName: target.name,
          createdById: user.id,
        },
      });
    });
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/open-transaction");
  revalidatePath("/finance/jurnal-umum");
  revalidatePath("/finance/pengeluaran-operasional");
  revalidatePath("/finance/laporan-akuntansi");
  revalidatePath("/finance/finance-ledger");
  return { success: "Transaksi jurnal berhasil dicatat." };
}

export async function setFinancialAccountStatus(_: FormState, form: FormData): Promise<FormState> {
  await requireAccess("master-akun", "edit");
  await requireAccess("master-akun");
  const id = String(form.get("id") || ""),
    version = String(form.get("version") || ""),
    active = form.get("active");
  if (!id || !["true", "false"].includes(String(active)))
    return { error: "Status akun tidak valid." };
  try {
    await getPrisma().$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM financial_accounts WHERE id=${id} FOR UPDATE`;
      const account = await tx.financialAccount.findUnique({ where: { id } });
      if (!account || account.updatedAt.toISOString() !== version)
        invalid("Akun sudah berubah. Muat ulang halaman.");
      await tx.financialAccount.update({ where: { id }, data: { active: active === "true" } });
    });
  } catch (e) {
    return fail(e);
  }
  for (const path of [
    "/finance/laporan-akuntansi",
    "/open-transaction",
    "/finance/jurnal-umum",
    "/finance/pengeluaran-operasional",
    "/admin-malam/master-akun",
  ])
    revalidatePath(path);
  return { success: "Status akun berhasil diperbarui." };
}
