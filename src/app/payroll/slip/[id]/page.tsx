import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PayrollSlip } from "@/components/payroll-slip";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Slip Gaji · Corndog Kane",
  robots: { index: false, follow: false },
};

export default async function PayrollSlipPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const fromPortal = (await searchParams).from === "portal";
  const user = await requireAccess(fromPortal ? "portal-karyawan" : "payroll");
  const { id } = await params;
  const canPreview = fromPortal && user.roleSystemKey === "OWNER";
  if (fromPortal && !canPreview && !user.employeeId) notFound();

  const db = getPrisma();
  const payroll = await db.payroll.findFirst({
    where: {
      id,
      status: fromPortal ? "PAID" : { in: ["DRAFT", "PAID"] },
      ...(fromPortal && { employee: { active: true } }),
      ...(fromPortal && !canPreview && { employeeId: user.employeeId! }),
    },
    include: {
      employee: {
        select: {
          fullName: true,
          department: true,
          position: true,
          bankName: true,
          bankAccountNumber: true,
          bankAccountName: true,
        },
      },
    },
  });
  if (!payroll) notFound();
  const preparer = await db.user.findUnique({
    where: { id: payroll.createdById },
    select: { name: true },
  });
  const backHref = fromPortal
    ? "/portal-karyawan/gaji" +
      (canPreview && payroll.employeeId !== user.employeeId
        ? `?employee=${encodeURIComponent(payroll.employeeId)}`
        : "")
    : "/payroll";

  return <PayrollSlip payroll={payroll} preparedBy={preparer?.name || "Finance"} backHref={backHref} />;
}
