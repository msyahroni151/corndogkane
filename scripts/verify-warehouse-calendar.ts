import assert from "node:assert/strict";
import { warehouseScheduleSvg, type WarehouseScheduleData } from "../src/lib/warehouse-schedule-image";
import { shiftTimes, compareWarehouseSchedules } from "../src/lib/schedules";
const mixed = [
  { name: "ACEP", status: "KERJA", shift: "S2" },
  { name: "UPIS", status: "LIBUR", shift: null },
  { name: "YUSUF", status: "KERJA", shift: "S1" },
  { name: "IHSAN", status: "KERJA", shift: "S1" },
  { name: "ADI", status: "KERJA", shift: "FULL" },
];
assert.deepEqual([...mixed].sort(compareWarehouseSchedules).map(r => r.name), ["IHSAN", "YUSUF", "ACEP", "ADI", "UPIS"]);
const ordered = warehouseScheduleSvg({ from: "2026-12-02", to: "2026-12-02", employees: mixed.map(r => ({ id: r.name, name: r.name })), rows: mixed.map(r => ({ ...r, employeeId: r.name, date: "2026-12-02", startMinutes: 480, endMinutes: 1020 })) }).svg;
const positions = ["IHSAN", "YUSUF", "ACEP", "ADI", "UPIS"].map(name => ordered.indexOf(`>${name}</text>`));
assert.ok(positions.every((p, i) => p >= 0 && (!i || p > positions[i - 1])), "Share calendar must use the same shift order as desktop and mobile");
assert.deepEqual(shiftTimes("S2"), { startMinutes: 900, endMinutes: 1439 });
assert.deepEqual(shiftTimes("FULL"), { startMinutes: 480, endMinutes: 1439 });
const data: WarehouseScheduleData = { from: "2026-10-01", to: "2026-10-04", employees: [{ id: "A", name: "UPIS" }, { id: "B", name: "<CEPI & TEST>" }], rows: [
  { employeeId: "A", date: "2026-10-01", status: "KERJA", shift: "S1", startMinutes: 480, endMinutes: 1020 },
  { employeeId: "A", date: "2026-10-02", status: "KERJA", shift: "S2", startMinutes: 900, endMinutes: 1439 },
  { employeeId: "A", date: "2026-10-03", status: "KERJA", shift: "FULL", startMinutes: 480, endMinutes: 1439 },
  { employeeId: "A", date: "2026-10-04", status: "LIBUR", shift: null, startMinutes: null, endMinutes: null },
] };
const image = warehouseScheduleSvg(data);
for (const value of ["JADWAL CREW GUDANG", "01 Oktober 2026", "Senin", "Minggu", "Shift 1", "Shift 2", "Full shift", "08:00–17:00", "15:00–23:59", "LIBUR", "3 hari kerja", "1 libur", "#dceedd", "#dce8fb", "#ffe3b9", "#f8dddd", "&lt;CEPI &amp; TEST&gt;"]) assert.ok(image.svg.includes(value), value);
assert.ok(!image.svg.includes("<CEPI & TEST>"));
assert.equal((image.svg.match(/Tidak bertugas/g) || []).length, 1);
assert.equal((image.svg.match(/>UPIS<\/text>/g) || []).length, 4);
const empty = warehouseScheduleSvg({ from: "2026-11-01", to: "2026-11-30", employees: [], rows: [] });
assert.equal((empty.svg.match(/Belum dijadwalkan/g) || []).length, 30);
assert.ok(empty.height > 600 && empty.width === 1400);
console.log("PASS: calendar columns, canonical shifts ending 23:59, leave, range padding, totals and escaped names.");
