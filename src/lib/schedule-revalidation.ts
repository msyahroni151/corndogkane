import { revalidatePath } from "next/cache";
export function refreshScheduleViews() {
  for (const path of [
    "/jadwal",
    "/absensi",
    "/payroll",
    "/penempatan",
    "/menu-utama/dashboard",
    "/portal-karyawan",
    "/portal-karyawan/jadwal",
    "/portal-karyawan/absensi",
    "/portal-karyawan/gaji",
    "/pos",
    "/admin-malam/monitoring-outlet",
  ])
    revalidatePath(path);
}
