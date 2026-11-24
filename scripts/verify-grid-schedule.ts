import assert from "node:assert/strict";
import { gridScheduleForm } from "../src/lib/grid-schedule";
import { parseRegularSchedule } from "../src/lib/regular-schedules";
import { parseBackupSchedule } from "../src/lib/backup-schedules";
import { resolveShareHomeAreas } from "../src/lib/share-schedule";

function cell(status: string, opening = false) {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    employeeId: "crew", areaId: "area", outletId: "outlet", date: "2026-11-23", status,
  })) form.set(key, value);
  if (opening) form.set("opening", "on");
  return form;
}
for (const regular of [true, false]) {
  const parse = regular ? parseRegularSchedule : parseBackupSchedule;
  for (const status of ["KERJA", "LIBUR", "STANBY"]) {
    const form = gridScheduleForm(cell(status), regular);
    const [row] = parse(form);
    assert.equal(row.date.toISOString().slice(0, 10), "2026-11-23");
    assert.equal(row.outletId, status === "KERJA" ? "outlet" : "");
    assert.equal(row.holiday, status === "LIBUR");
    assert.equal(row.status, status === "KERJA" ? "KERJA" : "STANBY");
    assert.equal(form.get("gridAreaId"), "area");
  }
  assert.equal(parse(gridScheduleForm(cell("KERJA", true), regular))[0].status, "OPENINGAN");
  assert.equal(parse(gridScheduleForm(cell("STANBY", true), regular))[0].status, "STANBY");
}
assert.throws(() => gridScheduleForm(cell("INVALID"), true));
const bad = cell("KERJA");
bad.set("date", "2026-02-30");
assert.throws(() => gridScheduleForm(bad, true));
bad.set("date", "2026-11-23");
bad.delete("outletId");
assert.throws(() => gridScheduleForm(bad, true));
bad.set("outletId", "outlet");
bad.delete("areaId");
assert.throws(() => gridScheduleForm(bad, true));
console.log("PASS: regular and backup grid cells preserve work, opening, leave and standby; invalid dates, statuses, outlets and areas are rejected.");
assert.equal(resolveShareHomeAreas({
  from: "2026-11-23", to: "2026-11-23",
  areas: [{ id: "A", name: "AREA 1" }], outlets: [],
  rows: [{ id: "S", employeeId: "E", name: "CREW", date: "2026-11-23", role: "REGULER", status: "LIBUR", outletId: null, outletName: null, homeAreaId: null, homeAreaName: "AREA 1", startMinutes: null, endMinutes: null }],
})[0].homeAreaId, "A");
console.log("PASS: holiday home area remains available in share output when only the area name was recorded.");
