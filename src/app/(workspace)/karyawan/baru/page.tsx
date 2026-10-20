import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/auth";
export default async function NewEmployee() {
  await requireAccess("karyawan");
  redirect("/karyawan?tambah=1");
}
