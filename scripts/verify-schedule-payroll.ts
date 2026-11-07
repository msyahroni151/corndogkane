import assert from "node:assert/strict";
import { parseRegularSchedule } from "../src/lib/regular-schedules";
import { parseBackupSchedule } from "../src/lib/backup-schedules";
import { payrollLines, type PayrollDay } from "../src/lib/payroll";
import { attendanceSummary } from "../src/lib/attendance";
import { portalWindow } from "../src/lib/employee-portal";
import { outletSchedulePeriods } from "../src/lib/outlet-schedule-status";
import {
  resolveShareHomeAreas,
  shareWeeks,
  type ShareScheduleData,
} from "../src/lib/share-schedule";
import { scheduleSvg } from "../src/lib/share-schedule-image";
const regular = new FormData();
for (const [key, value] of Object.entries({
  regularOutletId: "",
  regularStartDate: "2026-11-03",
  regularEndDate: "2026-11-05",
  regularStatus: "STANBY",
}))
  regular.set(key, value);
assert.equal(parseRegularSchedule(regular).length, 3);
for (const status of ["KERJA", "OPENINGAN"]) {
  regular.set("regularStatus", status);
  assert.throws(() => parseRegularSchedule(regular), /Pilih outlet/);
}
regular.set("regularOutletId", "A");
assert.ok(parseRegularSchedule(regular).every((r) => r.status === "OPENINGAN"));
const backup = new FormData();
for (const [key, value] of Object.entries({
  backupOutletId: "",
  backupDate: "2026-11-03",
  backupStatus: "STANBY",
}))
  backup.set(key, value);
assert.equal(parseBackupSchedule(backup)[0].outletId, "");
backup.set("backupStatus", "OPENINGAN");
assert.throws(() => parseBackupSchedule(backup), /outlet/);
backup.set("backupOutletId", "A");
assert.equal(parseBackupSchedule(backup)[0].status, "OPENINGAN");
const day: PayrollDay = {
  id: "S",
  employeeId: "E",
  date: new Date("2026-11-03T00:00:00Z"),
  role: "REGULER",
  status: "STANBY",
  shift: null,
  outletName: null,
  outletDailyRate: null,
  location: null,
  startMinutes: null,
  endMinutes: null,
  attendance: null,
};
for (const role of ["REGULER", "BACKUP"]) {
  const line = payrollLines([{ ...day, role }], [], 0, 10000, {})[0];
  assert.equal(line.standby, 50000);
  assert.equal(line.base, 0);
  assert.equal(line.backup, 0);
  assert.equal(line.fine, 0);
}
const working = {
  ...day,
  status: "KERJA",
  outletName: "A",
  outletDailyRate: 95000,
  startMinutes: 600,
  endMinutes: 1200,
  attendance: {
    status: "HADIR",
    checkInMinutes: 600,
    checkOutMinutes: 1200,
    checkInNextDay: false,
    checkOutNextDay: false,
  },
};
for (const status of ["KERJA", "OPENINGAN"]) {
  const line = payrollLines([{ ...working, status }], [], 0, 0, {})[0];
  assert.equal(line.base, 95000);
  assert.equal(line.standby, 0);
  assert.equal(line.units, 1);
  assert.equal(line.validation, "LENGKAP");
  assert.equal(payrollLines([{ ...working, status, attendance: null }], [], 0, 0, {})[0].base, 0);
}
assert.equal(
  attendanceSummary(
    { ...working, status: "OPENINGAN" },
    { ...working.attendance, checkInMinutes: 605 },
  ).lateFine,
  5000,
);
assert.equal(payrollLines([{ ...day, status: "LIBUR" }], [], 0, 0, {})[0].standby, 0);
assert.equal(payrollLines([{ ...day, role: "CREW_GUDANG" }], [], 0, 0, {})[0].standby, 0);
portalWindow({ ...working, status: "OPENINGAN" }, "IN", new Date("2026-11-03T03:00:00Z"));
assert.throws(() => portalWindow(day, "IN"), /jadwal kerja/);
const row = {
  id: "S",
  employeeId: "E",
  name: "CREW",
  date: "2026-11-03",
  role: "REGULER",
  status: "OPENINGAN",
  outletId: "A",
  outletName: "A",
  homeAreaId: "AREA",
  homeAreaName: "Area",
  startMinutes: 600,
  endMinutes: 1200,
};
assert.equal(
  outletSchedulePeriods(["A"], row.date, row.date, [{ ...row, crewName: row.name }]).A.openDays,
  1,
);
assert.match(
  shareWeeks(
    {
      from: row.date,
      to: row.date,
      areas: [{ id: "AREA", name: "Area" }],
      outlets: [{ id: "A", name: "A", areaId: "AREA" }],
      rows: [row],
    },
    "",
  )[0].panels[0].outlets[0].cells[0][0].name,
  /Openingan/,
);
const shareData: ShareScheduleData = {
  from: "2026-11-12",
  to: "2026-11-15",
  areas: [
    { id: "A2", name: "AREA 2" },
    { id: "A4", name: "AREA 4" },
    { id: "archive", name: "ARSIP HISTORIS", active: false },
  ],
  outlets: [
    { id: "C", name: "CIPAMOKOLAN", areaId: "A2" },
    { id: "P", name: "PAHLAWAN", areaId: "A4" },
    { id: "old", name: "CIJAMBE", areaId: "archive" },
  ],
  rows: [
    {
      ...row,
      id: "1",
      role: "BACKUP",
      employeeId: "D",
      name: "DADAN",
      date: "2026-11-09",
      status: "KERJA",
      outletId: "P",
      homeAreaId: "A4",
    },
    {
      ...row,
      id: "2",
      role: "BACKUP",
      employeeId: "D",
      name: "DADAN",
      date: "2026-11-12",
      status: "STANBY",
      outletId: null,
      homeAreaId: null,
    },
    {
      ...row,
      id: "3",
      role: "BACKUP",
      employeeId: "D",
      name: "DADAN",
      date: "2026-11-13",
      status: "LIBUR",
      outletId: null,
      homeAreaId: null,
    },
    {
      ...row,
      id: "4",
      role: "BACKUP",
      employeeId: "Z",
      name: "AZI",
      date: "2026-11-10",
      status: "KERJA",
      outletId: "C",
      homeAreaId: "A2",
    },
    {
      ...row,
      id: "5",
      role: "BACKUP",
      employeeId: "Z",
      name: "AZI",
      date: "2026-11-14",
      status: "STANBY",
      outletId: null,
      homeAreaId: null,
    },
    {
      ...row,
      id: "6",
      date: "2026-11-13",
      status: "KERJA",
      outletId: "old",
      homeAreaId: "archive",
    },
  ],
};
const resolved = { ...shareData, rows: resolveShareHomeAreas(shareData) };
const panels = shareWeeks(resolved, "")[0].panels;
assert.deepEqual(
  panels.map((panel) => panel.id),
  ["A2", "A4"],
);
assert.deepEqual(panels[0].standby[2], ["AZI"]);
assert.deepEqual(panels[1].standby[0], ["DADAN"]);
assert.deepEqual(panels[1].leave[1], ["DADAN"]);
const crossArea = resolveShareHomeAreas({
  ...shareData,
  rows: [...shareData.rows, { ...shareData.rows[0], id: "7", date: "2026-11-11", outletId: "C" }],
});
assert.equal(crossArea.find((entry) => entry.id === "2")?.homeAreaId, null);
const preview = scheduleSvg(resolved, "", {}, true);
assert.deepEqual(
  preview.noteSlots.map((slot) => slot.areaId),
  ["A2", "A4"],
);
const exported = scheduleSvg(resolved, "A4", { A4: "Cek stok sebelum buka" });
assert.match(exported.svg, /Cek stok sebelum buka/);
assert.doesNotMatch(exported.svg, /ARSIP HISTORIS|CIJAMBE|AZI/);
assert.equal(exported.noteSlots.length, 0);
console.log(
  "PASS: area archive exclusion, backup area inference, ambiguous backup, and per-area note preview/export.",
);
console.log(
  "PASS: standby without outlet (regular/backup), required work outlets, Openingan attendance/portal/monitoring/share, standby Rp50.000, conversion pays outlet rate without double standby, absence/holiday/warehouse pay guards.",
);
