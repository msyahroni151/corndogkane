import { parseCivilDate } from "@/lib/placements";
/** Regular crews choose outlet periods; expand them into daily schedules only on the server. */
export function parseRegularSchedule(form: FormData) {
  const outlets = form.getAll("regularOutletId"),
    starts = form.getAll("regularStartDate"),
    ends = form.getAll("regularEndDate"),
    statuses = form.getAll("regularStatus");
  if (
    !outlets.length ||
    outlets.length > 31 ||
    starts.length !== outlets.length ||
    ends.length !== outlets.length ||
    statuses.length !== outlets.length
  )
    throw Error(
      "Isi minimal satu periode reguler, maksimal 31 baris, dengan outlet, tanggal mulai, tanggal selesai, dan status.",
    );
  const assignments: {
    outletId: string;
    date: Date;
    status: "KERJA" | "STANBY";
    holiday: boolean;
    periodEnd: Date;
  }[] = [];
  const occupied = new Set<number>();
  outlets.forEach((outlet, index) => {
    if (typeof outlet !== "string" || !outlet.trim())
      throw Error(`Pilih outlet pada periode ${index + 1}.`);
    const start = parseCivilDate(String(starts[index]).trim()),
      end = parseCivilDate(String(ends[index]).trim()),
      status = statuses[index];
    if (end < start || end.getTime() - start.getTime() > 30 * 86400000)
      throw Error(
        `Periode ${index + 1} maksimal 31 hari dan tanggal selesai tidak boleh sebelum mulai.`,
      );
    if (status !== "KERJA" && status !== "STANBY")
      throw Error(`Pilih status Kerja atau Stanby pada periode ${index + 1}.`);
    for (let date = new Date(start); date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
      if (occupied.has(date.getTime()))
        throw Error("Periode reguler tidak boleh bertumpang tindih untuk karyawan yang sama.");
      occupied.add(date.getTime());
      if (occupied.size > 366)
        throw Error("Maksimal 366 tanggal dalam satu penyimpanan jadwal reguler.");
      assignments.push({
        outletId: outlet.trim(),
        date: new Date(date),
        status,
        holiday: false,
        periodEnd: end,
      });
    }
  });
  const special = new Set<number>();
  for (const name of ["holiday", "standby"]) {
    for (const value of form.getAll(name)) {
      if (typeof value !== "string") throw Error("Tanggal libur / standby tidak valid.");
      if (!value.trim()) continue;
      const date = parseCivilDate(value.trim()),
        stamp = date.getTime();
      if (!occupied.has(stamp))
        throw Error("Tanggal libur / standby harus berada di dalam salah satu periode reguler.");
      if (special.has(stamp))
        throw Error("Tanggal libur dan standby tidak boleh berulang atau sama.");
      special.add(stamp);
      const row = assignments.find((r) => r.date.getTime() === stamp)!;
      if (name === "holiday") row.holiday = true;
      else row.status = "STANBY";
    }
  }
  return assignments.sort((a, b) => a.date.getTime() - b.date.getTime());
}
