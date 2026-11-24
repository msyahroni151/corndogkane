import { parseCivilDate } from "@/lib/placements";

/** Adapt a single grid cell to the same validated input used by the period form. */
export function gridScheduleForm(input: FormData, regular: boolean) {
  const status = String(input.get("status") || "");
  if (!["KERJA", "LIBUR", "STANBY"].includes(status))
    throw Error("Status jadwal tidak valid.");
  const date = String(input.get("date") || "");
  parseCivilDate(date);
  const areaId = String(input.get("areaId") || "").trim();
  if (!areaId) throw Error("Pilih area jadwal.");
  const outletId = status === "KERJA" ? String(input.get("outletId") || "").trim() : "";
  if (status === "KERJA" && !outletId) throw Error("Pilih outlet bertugas.");
  const form = new FormData();
  form.set("employeeId", String(input.get("employeeId") || ""));
  form.set("gridAreaId", areaId);
  const prefix = regular ? "regular" : "backup";
  form.set(prefix + "OutletId", outletId);
  // Holiday overrides a one-day standby assignment without needing a dummy outlet.
  form.set(prefix + "Status", status === "KERJA"
    ? (input.get("opening") === "on" ? "OPENINGAN" : "KERJA")
    : "STANBY");
  if (regular) {
    form.set("regularStartDate", date);
    form.set("regularEndDate", date);
  } else form.set("backupDate", date);
  if (status === "LIBUR") form.set("holiday", date);
  return form;
}
