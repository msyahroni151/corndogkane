import { parseCivilDate } from "@/lib/placements";
export function parseBackupAssignments(form: FormData) {
  const outlets = form.getAll("backupOutletId"),
    dates = form.getAll("backupDate"),
    statuses = form.getAll("backupStatus");
  if (!outlets.length || outlets.length !== dates.length)
    throw Error("Tambahkan minimal satu pasangan outlet dan tanggal jaga.");
  if (statuses.length !== dates.length)
    throw Error("Pilih status Kerja atau Stanby pada setiap tanggal jaga.");
  const assignments = outlets.map((outlet, index) => {
    if (
      typeof outlet !== "string" ||
      typeof dates[index] !== "string" ||
      !outlet.trim() ||
      !String(dates[index]).trim()
    )
      throw Error("Lengkapi outlet dan tanggal jaga pada setiap baris.");
    let date: Date;
    try {
      date = parseCivilDate(String(dates[index]).trim());
    } catch {
      throw Error(`Tanggal jaga pada baris ${index + 1} tidak valid.`);
    }
    const status = statuses[index];
    if (status !== "KERJA" && status !== "STANBY")
      throw Error(`Status jaga pada baris ${index + 1} tidak valid.`);
    return { outletId: outlet.trim(), date, status };
  });
  if (new Set(assignments.map((row) => row.date.getTime())).size !== assignments.length)
    throw Error("Tanggal jaga tidak boleh berulang untuk crew yang sama.");
  return assignments.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** Holidays can be separate dates or override a selected work date. */
export function parseBackupSchedule(form: FormData) {
  const work = parseBackupAssignments(form);
  const holidays = form
    .getAll("holiday")
    .map((v) => {
      if (typeof v !== "string") throw Error("Tanggal libur tidak valid.");
      return v.trim();
    })
    .filter(Boolean)
    .map((v) => parseCivilDate(v));
  if (new Set(holidays.map((d) => d.getTime())).size !== holidays.length)
    throw Error("Tanggal libur khusus tidak boleh berulang.");
  const off = new Set(holidays.map((d) => d.getTime()));
  const result = work.map((row) => ({ ...row, holiday: off.has(row.date.getTime()) }));
  for (const date of holidays)
    if (!work.some((row) => row.date.getTime() === date.getTime())) {
      const home = work.filter((row) => row.date <= date).at(-1) ?? work[0];
      result.push({ outletId: home.outletId, date, holiday: true, status: "KERJA" });
    }
  return result.sort((a, b) => a.date.getTime() - b.date.getTime());
}
