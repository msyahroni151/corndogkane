import assert from "node:assert/strict";
import {
  csvHeaders,
  readCsv,
  encodeCsv,
  parseSalesCsv,
  salesCsvValues,
} from "../src/lib/outlet-sales-csv";
import { operationalProducts, canRecordOutletCrew, canImportOutletCrew } from "../src/lib/outlet-operations";
const raw: Record<string, string | number> = {
  tanggal: "2026-11-01",
  outlet: "OUTLET A",
  crew: "CREW A",
  mozarella: 10,
  sosis: 5,
  qris: 20000,
  pengeluaran: 5000,
  setoran_tunai: 105000,
  total_penjualan: 130000,
  keterangan_pengeluaran: 'Es batu, plastik "besar"\nbaris kedua',
  sumber_penjualan: "MANUAL",
};
const make = (extra: Record<string, string | number | undefined> = {}) =>
  encodeCsv([csvHeaders, salesCsvValues({ ...raw, ...extra })]);
let parsed = parseSalesCsv(make());
assert.deepEqual(parsed.errors, []);
assert.equal(parsed.rows[0].totalGross, 130000);
assert.equal(parsed.rows[0].expenseNotes, raw.keterangan_pengeluaran);
assert.equal(parsed.rows[0].cashReceived, 105000);
assert.equal(parsed.rows[0].doughUsed, null);
assert.deepEqual(
  readCsv(
    encodeCsv([
      ["=SUM(A1:A2)", "+1", "-1", "@name", "'ordinary", "text", '"quotes"', "line\nbreak"],
    ]),
  )[0],
  ["=SUM(A1:A2)", "+1", "-1", "@name", "'ordinary", "text", '"quotes"', "line\nbreak"],
);
const semicolon =
  csvHeaders.join(";") +
  "\r\n" +
  salesCsvValues({
    ...raw,
    keterangan_pengeluaran: "Cash",
    tanggal: "01/11/2026",
    harga_mozarella: "12.000",
    total_penjualan: 150000,
  }).join(";");
parsed = parseSalesCsv(semicolon);
assert.deepEqual(parsed.errors, []);
assert.equal(parsed.rows[0].date, "2026-11-01");
assert.equal(parsed.rows[0].totalGross, 150000);
for (const change of [
  { tanggal: "2026-02-30" },
  { mozarella: "1,5" },
  { qris: 200000 },
  { harga_mozarella: -1 },
  { harga_mozarella: "2.50" },
  { total_penjualan: 1 },
  { sumber_penjualan: "POS" },
])
  assert.equal(parseSalesCsv(make(change)).errors.length, 1);
assert.equal(
  parseSalesCsv(make({ harga_mozarella: 0, total_penjualan: 30000, qris: 0 })).rows[0].totalGross,
  30000,
);
assert.throws(() => readCsv('a,b\n"unclosed,b'), /petik/);
assert.throws(() => parseSalesCsv("tanggal,tanggal\n1,1"), /berulang/);
assert.throws(() => parseSalesCsv("tanggal,unknown\n1,1"), /tidak dikenal/);
assert.throws(
  () =>
    parseSalesCsv(
      encodeCsv([csvHeaders, ...Array.from({ length: 101 }, () => salesCsvValues(raw))]),
    ),
  /100/,
);
assert.equal(operationalProducts.length, 10);
console.log(
  "PASS: Indonesian dates and money, historical/zero prices, quantity/payment/total validation, manual-only import, BOM/CRLF/semicolon/quoted multiline CSV, formula-safe exports, malformed/oversized imports rejected.",
);

assert.ok(make().startsWith("\uFEFFsep=;\r\ntanggal;outlet;"));
assert.deepEqual(readCsv("\uFEFFsep=;\r\na;b\r\n1;2\r\n"), [
  ["a", "b"],
  ["1", "2"],
]);
assert.deepEqual(readCsv("sep=,\na,b\n1,2"), [
  ["a", "b"],
  ["1", "2"],
]);
const commaLegacy =
  csvHeaders.join(",") +
  "\n" +
  salesCsvValues({ ...raw, keterangan_pengeluaran: "Cash" }).join(",");
assert.deepEqual(parseSalesCsv(commaLegacy).errors, []);
console.log(
  "PASS: Excel delimiter hint and semicolon columns, legacy comma files, and both explicit separator declarations supported.",
);

const formerCrew = {
  active: false,
  employeeCode: "FORMER",
  fullName: "Former Crew",
  department: "OPERASIONAL OUTLET",
  position: "CREW OUTLET",
};
assert.equal(canImportOutletCrew(formerCrew), true);
assert.equal(canRecordOutletCrew(formerCrew), false);
assert.equal(canRecordOutletCrew({ ...formerCrew, active: true }), true);
for (const position of ["CREW OUTLET", "CREW BACKUP", "AREA SUPERVISOR"])
  assert.equal(canImportOutletCrew({ ...formerCrew, position }), true);
assert.equal(canImportOutletCrew({ ...formerCrew, employeeCode: " " }), false);
assert.equal(canImportOutletCrew({ ...formerCrew, position: "ADMIN" }), false);
assert.equal(canImportOutletCrew({ ...formerCrew, department: "OPERASIONAL GUDANG" }), false);
console.log("PASS: historical crew eligibility accepts inactive outlet crew without relaxing manual input or role/code requirements.");
