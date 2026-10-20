import { notFound, redirect } from "next/navigation";
import { requireAccess } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { EmployeeForm } from "@/components/employee-form";
async function Content({ params }: { params: Promise<{ id: string }> }) {
  await requireAccess("karyawan");
  const { id } = await params;
  const row = await getPrisma().employee.findUnique({ where: { id } });
  if (!row) {
    if (/^EMP-WEB-[0-9]+$/.test(id)) {
      const canonicalId = "EMP-" + String(Number(id.slice(8))).padStart(5, "0");
      const migrated = await getPrisma().employee.findUnique({
        where: { id: canonicalId },
        select: { id: true },
      });
      if (migrated) redirect("/karyawan/" + encodeURIComponent(migrated.id));
    }
    notFound();
  }
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value instanceof Date) values[key] = value.toISOString().slice(0, 10);
    else if (typeof value === "string") values[key] = value;
    else if (key === "baseSalary" && typeof value === "number") values[key] = String(value);
  }
  return <EmployeeForm key={row.id} id={row.id} values={values} />;
}
export default function EditEmployee(props: { params: Promise<{ id: string }> }) {
  return <Content {...props} />;
}
