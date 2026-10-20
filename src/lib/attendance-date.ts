export function attendanceDateError(date: Date, today: string, checkInNextDay = false) {
  const actual = new Date(date);
  if (checkInNextDay) actual.setUTCDate(actual.getUTCDate() + 1);
  return actual.toISOString().slice(0, 10) > today
    ? "Absensi belum dapat diisi untuk tanggal mendatang. Tunggu sampai tanggal kehadiran tiba (WIB)."
    : null;
}
