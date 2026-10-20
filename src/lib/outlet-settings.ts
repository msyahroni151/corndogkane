export const outletDays = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"] as const;
export type OutletHours = { open: string; close: string; closed: boolean }[];
export function readOutletHours(value: unknown): OutletHours | null {
  if (!Array.isArray(value) || value.length !== 7) return null;
  return value.map((item, index) => {
    if (!item || typeof item !== "object" || typeof item.closed !== "boolean")
      throw Error(`Pengaturan ${outletDays[index]} tidak valid.`);
    if (item.closed) return { open: "", close: "", closed: true };
    const valid = (time: unknown) =>
      typeof time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
    if (!valid(item.open) || !valid(item.close) || item.open === item.close)
      throw Error(`Isi jam buka/tutup ${outletDays[index]} yang berbeda dan valid.`);
    return { open: item.open as string, close: item.close as string, closed: false };
  });
}
export function outletHoursForDate(hours: unknown, date: Date) {
  const week = readOutletHours(hours);
  if (!week)
    throw Error(
      "Jam outlet belum diatur lengkap di Master Outlet. Lengkapi atau gunakan jam manual.",
    );
  const day = week[(date.getUTCDay() + 6) % 7];
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  return {
    ...day,
    startMinutes: day.closed ? null : minutes(day.open),
    endMinutes: day.closed ? null : minutes(day.close),
  };
}
