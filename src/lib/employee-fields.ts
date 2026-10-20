export const departments = [
  "MANAJEMEN",
  "OPERASIONAL OUTLET",
  "GUDANG & PRODUKSI",
  "PURCHASING",
  "MAINTENANCE & ASSET",
  "FINANCE & ACCOUNTING",
  "HR & GENERAL AFFAIRS",
  "MARKETING",
  "IT SYSTEM & DATA",
  "GENERAL MANAGER",
  "DIREKTUR",
] as const;
export const positions = [
  "AREA SUPERVISOR",
  "ADMIN OPERASIONAL MALAM",
  "CREW OUTLET",
  "CREW BACKUP",
  "LEADER GUDANG",
  "CREW GUDANG",
  ...departments,
] as const;
export const employeeFields = [
  { key: "fullName", label: "Nama lengkap", required: true },
  { key: "employeeCode", label: "Kode nama" },
  { key: "nik", label: "NIK" },
  { key: "department", label: "Departemen", required: true, options: departments },
  { key: "position", label: "Jabatan", required: true, options: positions },
  { key: "joinedAt", label: "Tanggal masuk", type: "date" },
  {
    key: "activityStatus",
    label: "Status aktif",
    options: ["AKTIF", "RESIGN"],
    required: true,
  },
  { key: "leftAt", label: "Tanggal keluar", type: "date" },
  { key: "phone", label: "No. HP", type: "tel" },
  { key: "bankName", label: "Nama bank" },
  { key: "bankAccountNumber", label: "No. rekening" },
  { key: "bankAccountName", label: "Atas nama rekening" },
] as const;

// Payroll follows the job title in employee biodata, independent of account access roles.
export function usesOutletDailyRate(employee: { position?: string | null }) {
  return employee.position?.trim().toUpperCase() === "CREW OUTLET";
}
