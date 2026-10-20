"use server";
import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { todayWib } from "@/lib/placements";
import {
  isExpenseAccount,
  isPaymentAccount,
  parseExpensePayment,
  parseOperationalExpense,
  type PaymentMethod,
} from "@/lib/operational-expenses";
import type { Prisma } from "@/generated/prisma/client";
import type { FormState } from "@/lib/form-state";
function invalid(message: string): never {
  const e = new Error(message);
  e.name = "ExpenseValidation";
  throw e;
}
function failure(e: unknown): FormState {
  return {
    error:
      e instanceof Error && e.name === "ExpenseValidation"
        ? e.message
        : "Pengeluaran belum tersimpan. Periksa koneksi dan coba lagi.",
  };
}
function refresh() {
  for (const path of [
    "/finance/pengeluaran-operasional",
    "/finance/finance-ledger",
    "/finance/laporan-akuntansi",
    "/open-transaction",
  ])
    revalidatePath(path);
}
async function accountsForPayment(
  tx: Prisma.TransactionClient,
  expenseId: string,
  paymentId: string,
  method: PaymentMethod,
) {
  for (const id of [expenseId, paymentId].sort())
    await tx.$executeRaw`SELECT id FROM financial_accounts WHERE id=${id} FOR SHARE`;
  const accounts = await tx.financialAccount.findMany({
      where: { id: { in: [expenseId, paymentId] } },
    }),
    expense = accounts.find((a) => a.id === expenseId),
    payment = accounts.find((a) => a.id === paymentId);
  if (!expense || !isExpenseAccount(expense))
    invalid("Akun beban harus aktif dan termasuk Beban Operasional.");
  if (expenseId === paymentId || !payment || !isPaymentAccount(payment, method))
    invalid("Pilih akun pembayaran aktif yang sesuai Kas Tunai atau Transfer / Bank.");
  return { expense, payment };
}
async function postExpense(
  tx: Prisma.TransactionClient,
  userId: string,
  source: { id: string; code: string; name: string },
  expense: { id: string; code: string; name: string },
  date: Date,
  amount: number,
  purpose: string,
  notes: string,
) {
  return tx.journalTransaction.create({
    data: {
      postingKey: randomUUID(),
      date,
      sourceAccountId: source.id,
      sourceCode: source.code,
      sourceName: source.name,
      targetAccountId: expense.id,
      targetCode: expense.code,
      targetName: expense.name,
      sourceSide: "CREDIT",
      amount,
      notes: `Pengeluaran: ${purpose}${notes ? " · " + notes : ""}`.slice(0, 2000),
      createdById: userId,
    },
  });
}
export async function createOperationalExpense(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireAccess("finance-expenses");
  let data: ReturnType<typeof parseOperationalExpense>;
  try {
    data = parseOperationalExpense(form, todayWib());
  } catch (e) {
    return { error: (e as Error).message };
  }
  const requestHash = createHash("sha256").update(JSON.stringify(data)).digest("hex");
  try {
    await getPrisma().$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"EXPENSE:" + data.postingKey}))`;
        const existing = await tx.operationalExpense.findUnique({
          where: { postingKey: data.postingKey },
        });
        if (existing) {
          if (existing.createdById !== user.id || existing.requestHash !== requestHash)
            invalid("Formulir ini sudah digunakan untuk pengeluaran lain. Tutup dan buka kembali.");
          return;
        }
        let journalId: string | null = null,
          paymentCode: string | null = null,
          paymentName: string | null = null,
          expense;
        if (data.status === "PAID") {
          const found = await accountsForPayment(
            tx,
            data.expenseAccountId,
            data.paymentAccountId!,
            data.paymentMethod,
          );
          expense = found.expense;
          paymentCode = found.payment.code;
          paymentName = found.payment.name;
          journalId = (
            await postExpense(
              tx,
              user.id,
              found.payment,
              { id: expense.id, code: expense.code, name: expense.name },
              data.paidAt!,
              data.amount,
              data.purpose,
              data.notes,
            )
          ).id;
        } else {
          await tx.$executeRaw`SELECT id FROM financial_accounts WHERE id=${data.expenseAccountId} FOR SHARE`;
          expense = await tx.financialAccount.findUnique({ where: { id: data.expenseAccountId } });
          if (!expense || !isExpenseAccount(expense))
            invalid("Pilih akun Beban Operasional yang aktif.");
        }
        await tx.operationalExpense.create({
          data: {
            ...data,
            requestHash,
            expenseCode: expense.code,
            expenseName: expense.name,
            category: expense.subGroup,
            createdById: user.id,
            paidById: data.status === "PAID" ? user.id : null,
            paymentCode,
            paymentName,
            journalTransactionId: journalId,
          },
        });
      },
      { timeout: 15000 },
    );
  } catch (e) {
    return failure(e);
  }
  refresh();
  return { success: "Pengeluaran operasional berhasil dicatat." };
}
export async function payOperationalExpense(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireAccess("finance-expenses"),
    id = String(form.get("id") || ""),
    version = String(form.get("version") || "");
  try {
    await getPrisma().$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT id FROM operational_expenses WHERE id=${id} FOR UPDATE`;
        const expense = await tx.operationalExpense.findUnique({ where: { id } });
        if (!expense) invalid("Pengeluaran tidak ditemukan.");
        let payment: ReturnType<typeof parseExpensePayment>;
        try {
          payment = parseExpensePayment(form, expense.date, todayWib());
        } catch (e) {
          invalid((e as Error).message);
        }
        if (expense.status === "PAID") {
          if (
            expense.paymentAccountId === payment.paymentAccountId &&
            expense.paymentMethod === payment.paymentMethod &&
            expense.paidAt?.getTime() === payment.paidAt.getTime()
          )
            return;
          invalid("Pengeluaran sudah lunas. Pembayaran tidak dapat dicatat lagi.");
        }
        if (expense.updatedAt.toISOString() !== version)
          invalid("Pengeluaran sudah berubah. Tutup dan muat ulang halaman.");
        const found = await accountsForPayment(
          tx,
          expense.expenseAccountId,
          payment.paymentAccountId,
          payment.paymentMethod,
        );
        const journal = await postExpense(
          tx,
          user.id,
          found.payment,
          { id: expense.expenseAccountId, code: expense.expenseCode, name: expense.expenseName },
          payment.paidAt,
          expense.amount,
          expense.purpose,
          expense.notes,
        );
        await tx.operationalExpense.update({
          where: { id },
          data: {
            ...payment,
            status: "PAID",
            paymentCode: found.payment.code,
            paymentName: found.payment.name,
            paidById: user.id,
            journalTransactionId: journal.id,
          },
        });
      },
      { timeout: 15000 },
    );
  } catch (e) {
    return failure(e);
  }
  refresh();
  return { success: "Pembayaran pengeluaran berhasil dicatat." };
}
