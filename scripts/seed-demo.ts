import { Client } from "pg";
import { readFile } from "node:fs/promises";
import { randomBytes, pbkdf2Sync, createHash } from "node:crypto";
import { operationalProducts } from "../src/lib/outlet-operations";
import { outletBonus } from "../src/lib/outlet-bonus";
import { todayWib } from "../src/lib/placements";
// Guard code is shared with the startup process and never loads .env.local.
/* eslint-disable @typescript-eslint/no-require-imports -- Shared guard runs in the plain Node.js startup process. */
const {
  assertDemoTarget,
  assertDemoDatabase,
  protectDemoTables,
  demoMarker,
} = require("./demo-target.cjs");
async function main() {
  assertDemoTarget();
  const db = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 30000,
  });
  await db.connect();
  try {
    await db.query("BEGIN");
    await db.query("SELECT pg_advisory_xact_lock(hashtext('corndog-demo-bootstrap'))");
    const state = await assertDemoDatabase(db);
    if (!state.seeded) {
      const owner = "DEMO-OWNER",
        password = process.env.DEMO_ADMIN_PASSWORD!,
        salt = randomBytes(16).toString("hex");
      const hash =
        "pbkdf2-sha256:600000:" +
        salt +
        ":" +
        pbkdf2Sync(password, salt, 600000, 32, "sha256").toString("hex");
      await db.query(
        'INSERT INTO users(id,email,name,"passwordHash","roleId","updatedAt") VALUES($1,$2,$3,$4,$5,NOW())',
        [owner, process.env.DEMO_ADMIN_EMAIL!.toLowerCase(), "Owner Demo", hash, "ROLE-OWNER"],
      );
      await db.query('INSERT INTO areas(id,name,color,"updatedAt") VALUES($1,$2,$3,NOW())', [
        "DEMO-AREA",
        "Area Demo",
        "#deeddd",
      ]);
      const today = todayWib(),
        days = Array.from({ length: 7 }, (_, i) =>
          new Date(Date.parse(today + "T00:00:00Z") - (6 - i) * 86400000)
            .toISOString()
            .slice(0, 10),
        );
      const hours = Array.from({ length: 7 }, () => ({
        open: "10:00",
        close: "21:00",
        closed: false,
      }));
      const outlets = [
        ["UTARA", "Outlet Demo Utara", "UTR"],
        ["SELATAN", "Outlet Demo Selatan", "SLT"],
        ["TENGAH", "Outlet Demo Tengah", "TGH"],
      ];
      const employees = [
        ["ALFA", "Crew Demo Alfa", "CREW OUTLET", "OPERASIONAL OUTLET"],
        ["BETA", "Crew Demo Beta", "CREW OUTLET", "OPERASIONAL OUTLET"],
        ["GAMA", "Crew Demo Gama", "CREW BACKUP", "OPERASIONAL OUTLET"],
        ["DELTA", "Supervisor Demo Delta", "AREA SUPERVISOR", "OPERASIONAL OUTLET"],
        ["GUDANG", "Crew Gudang Demo", "CREW GUDANG", "GUDANG"],
      ];
      for (const [code, name, position, department] of employees)
        await db.query(
          'INSERT INTO employees(id,"fullName","employeeCode",department,position,"salaryBasis","baseSalary","joinedAt",notes,"updatedAt") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())',
          [
            "DEMO-EMP-" + code,
            name,
            code,
            department,
            position,
            "HARIAN",
            85000,
            days[0],
            "Data sintetis untuk demonstrasi.",
          ],
        );
      const coa = JSON.parse(await readFile("integrations/coa/master-coa-v1.json", "utf8"))
        .accounts as Record<string, unknown>[];
      for (const account of coa) {
        const keys = Object.keys(account);
        await db.query(
          'INSERT INTO financial_accounts(id,"createdById",' +
            keys.map((k) => '"' + k + '"').join(",") +
            ',"updatedAt") VALUES($1,$2,' +
            keys.map((_, i) => "$" + (i + 3)).join(",") +
            ",NOW())",
          ["DEMO-COA-" + account.code, owner, ...Object.values(account)],
        );
      }
      for (const [index, [code, name, nameCode]] of outlets.entries()) {
        const outletId = "DEMO-OUTLET-" + code,
          employeeId = "DEMO-EMP-" + employees[index][0],
          employeeName = employees[index][1],
          role = index === 2 ? "BACKUP" : "REGULER";
        await db.query(
          'INSERT INTO outlets(id,name,"nameCode","areaId","dailyRate","operatingHours","updatedAt") VALUES($1,$2,$3,$4,$5,$6::jsonb,NOW())',
          [outletId, name, nameCode, "DEMO-AREA", 85000, JSON.stringify(hours)],
        );
        const placementId = "DEMO-PLACE-" + code;
        await db.query(
          'INSERT INTO placements(id,"employeeId","employeeName",role,"startDate","endDate","areaId","areaName","outletId","outletName",notes,"createdById") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
          [
            placementId,
            employeeId,
            employeeName,
            role,
            days[0],
            today,
            "DEMO-AREA",
            "Area Demo",
            outletId,
            name,
            "Jadwal contoh.",
            owner,
          ],
        );
        for (const [dayIndex, date] of days.entries()) {
          const scheduleId = `DEMO-SCHEDULE-${code}-${date}`;
          await db.query(
            'INSERT INTO schedules(id,"employeeId","placementId",date,"employeeName",role,"areaName","outletId","outletName",status,"startMinutes","endMinutes","outletDailyRate","createdById","updatedAt") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())',
            [
              scheduleId,
              employeeId,
              placementId,
              date,
              employeeName,
              role,
              "Area Demo",
              outletId,
              name,
              "KERJA",
              600,
              1260,
              85000,
              owner,
            ],
          );
          await db.query(
            'INSERT INTO attendance(id,"scheduleId",status,"checkInMinutes","checkOutMinutes","updatedById","updatedAt") VALUES($1,$2,$3,$4,$5,$6,NOW())',
            [
              "DEMO-ATT-" + code + "-" + date,
              scheduleId,
              "HADIR",
              600,
              date === today ? null : 1260,
              owner,
            ],
          );
          const quantities: Record<string, number> = {
            mozarella: 45 + index * 12 + dayIndex * 3,
            mix: 10 + dayIndex,
            sosis: 8,
            cornflakes: 3,
            manis: 5,
          };
          const items = Object.fromEntries(
            operationalProducts.map((p) => [
              p.key,
              { quantity: quantities[p.key] ?? 0, unitPrice: p.price },
            ]),
          );
          const gross = Object.values(items).reduce((n, p) => n + p.quantity * p.unitPrice, 0),
            qris = 180000 + index * 40000,
            gofood = 25000 + dayIndex * 5000,
            expense = 15000,
            bonus = outletBonus(gross, 85000)!;
          const operationId = `DEMO-OP-${code}-${date}`,
            received =
              index === 1 && date === today
                ? null
                : gross - qris - gofood - expense + (index === 0 && date === today ? -5000 : 0);
          await db.query(
            'INSERT INTO outlet_operations(id,"outletId","outletName",date,"crewId","crewName",items,"totalGross",qris,gofood,"expenseAmount","expenseNotes","cashReceived","bonusAmount","bonusDailyRate","doughUsed","createdById","updatedById","updatedAt") VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$17,NOW())',
            [
              operationId,
              outletId,
              name,
              date,
              employeeId,
              employeeName,
              JSON.stringify(items),
              gross,
              qris,
              gofood,
              expense,
              "Contoh biaya gas dan air minum.",
              received,
              bonus,
              85000,
              3 + index,
              owner,
            ],
          );
          if (bonus > 0)
            await db.query(
              'INSERT INTO money_entries(id,"employeeId","employeeName",date,kind,amount,notes,status,"postingKey","createdById","decidedById","decidedAt","decisionNotes") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,NOW(),$11)',
              [
                "DEMO-BONUS-" + code + "-" + date,
                employeeId,
                employeeName,
                date,
                "BONUS_EARNED",
                bonus,
                "Bonus contoh dari " + name,
                "APPROVED",
                "OUTLET-BONUS:" + operationId,
                owner,
                "Saldo contoh, bukan pembayaran nyata.",
              ],
            );
        }
      }
      for (const [index, location] of ["KANTOR", "OUTLET"].entries()) {
        const id = "DEMO-ASSET-" + index,
          code = "AST-" + String(index + 1).padStart(5, "0"),
          name = index ? "Peralatan Outlet Demo" : "Komputer Kantor Demo",
          category = index ? "1506" : "1508",
          locationName = index ? "Outlet Demo Utara" : "Kantor Demo";
        await db.query(
          'INSERT INTO fixed_assets(id,code,name,"categoryAccountId","categoryCode","categoryName","registrationType","acquiredAt","inUseAt","acquisitionCost","locationType","outletId","locationName",condition,status,notes,"createdById","updatedById","updatedAt") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16,NOW())',
          [
            id,
            code,
            name,
            "DEMO-COA-" + category,
            category,
            index ? "Equipment Outlet" : "Komputer & Peralatan IT",
            "EXISTING",
            days[0],
            index ? 1500000 : 4500000,
            location,
            index ? "DEMO-OUTLET-UTARA" : null,
            locationName,
            "BAIK",
            "DIGUNAKAN",
            "Aset contoh untuk demonstrasi.",
            owner,
          ],
        );
        const stored = (
          await db.query("SELECT to_jsonb(a) record FROM fixed_assets a WHERE id=$1", [id])
        ).rows[0].record;
        const snapshot = { ...stored, acquisitionCost: String(stored.acquisitionCost) };
        await db.query(
          'INSERT INTO asset_events(id,"assetId",type,"requestKey","requestHash",after,notes,"actorId") VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8)',
          [
            "DEMO-ASSET-EVENT-" + index,
            id,
            "CREATED",
            `00000000-0000-4000-8000-00000000000${index}`,
            createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"),
            JSON.stringify(snapshot),
            "Pencatatan aset contoh.",
            owner,
          ],
        );
      }
      await db.query("INSERT INTO sequence_counters(name,value) VALUES($1,1)", [demoMarker]);
    }
    await protectDemoTables(db);
    await db.query("COMMIT");
    console.log(
      state.seeded
        ? "Data demo dipertahankan; proteksi database diverifikasi."
        : "Data sintetis demo berhasil disiapkan.",
    );
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    await db.end();
  }
}
main().catch((error: { code?: string; table?: string; column?: string }) => {
  console.error(
    "DEMO_SEED_FAILED",
    error.code || "configuration",
    error.table || "",
    error.column || "",
  );
  console.error(
    "Inisialisasi demo ditolak atau gagal. Data asli tidak diimpor; periksa target database dan konfigurasi demo.",
  );
  process.exitCode = 1;
});
